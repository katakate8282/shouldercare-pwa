import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import crypto from 'crypto'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    token = req.cookies.get('session')?.value || null
  }
  if (!token) return null

  try {
    const secret = process.env.JWT_SECRET as string
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString())
    const { data, sig } = decoded

    const expectedSig = crypto.createHmac('sha256', secret).update(JSON.stringify(data)).digest('hex')
    if (sig !== expectedSig) return null

    if (data.exp && data.exp * 1000 < Date.now()) return null

    return { id: data.userId, email: data.email, role: data.role || null }
  } catch {
    return null
  }
}

const SYSTEM_PROMPT = `당신은 어깨 재활 운동 자세 분석 AI 어시스턴트입니다.

역할 및 규칙:
- MediaPipe에서 추출된 관절 각도 데이터를 기반으로 운동 자세를 분석합니다.
- 친절하고 격려하는 톤으로 피드백합니다.
- 절대 의학적 진단, 처방, 치료 지시를 하지 않습니다.
- '~증후군', '~파열', '~손상', '~염증', '~충돌', '~불안정', '~탈구', '~석회', '~건염', '~활액막염', '~관절염', '~신경병증' 등 진단명을 언급하지 않습니다.
- '진단', '처방', '치료', '복용', '투약' 단어를 사용하지 않습니다.
- '~일 수 있습니다'(진단 추정), '~해야 합니다'(치료 지시), '~증후군으로 보입니다'(진단) 같은 패턴을 사용하지 않습니다.
- '자세 제안', '운동 팁' 범위로만 피드백합니다.
- 통증이 있다면 반드시 '담당 의사와 상담하세요'를 권합니다.
- 반복 횟수가 부족하다는 피드백은 하지 마세요. 영상 길이 제한(15초)으로 전체 세트가 촬영되지 않을 수 있습니다.
- 한국어로 응답합니다.

응답 형식:
📊 측정 데이터
(관절 각도, 동작 속도 등 객관적 수치)

✅ 잘한 점
(최소 1개, 구체적으로)

⚠️ 개선이 필요한 점
(구체적 교정 방법 포함)

[비교 분석이 있는 경우]
📈 지난 분석과 비교
(이전 데이터 대비 변화, 격려)

💡 다음 운동 시 집중 포인트
(1~2개 핵심 포인트)

응원 한마디로 마무리해주세요.`

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { video_id, exercise_id, joint_data, analysis_metrics } = body

    if (!video_id || !exercise_id || !joint_data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1) 주간 분석 횟수 체크
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)
    weekStart.setHours(0, 0, 0, 0)

    const { count: weekCount } = await supabaseAdmin
      .from('exercise_video_analyses')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('analysis_status', 'completed')
      .gte('created_at', weekStart.toISOString())

    if ((weekCount || 0) >= 5) {
      return NextResponse.json({
        error: '이번 주 AI 분석 횟수를 모두 사용했어요. 다음 주 월요일에 초기화됩니다.',
        code: 'WEEKLY_LIMIT_EXCEEDED'
      }, { status: 429 })
    }

    // 2) 운동 정보 조회
    const { data: exercise } = await supabaseAdmin
      .from('exercises')
      .select('name_ko, category, ai_analysis_enabled, ai_analysis_config')
      .eq('id', exercise_id)
      .single()

    if (!exercise || !exercise.ai_analysis_enabled) {
      return NextResponse.json({ error: '이 운동은 AI 분석을 지원하지 않습니다.', code: 'NOT_SUPPORTED' }, { status: 400 })
    }

    // 3) 분석 레코드 생성 (pending)
    const { data: analysisRecord, error: insertError } = await supabaseAdmin
      .from('exercise_video_analyses')
      .insert({
        video_id,
        user_id: user.id,
        exercise_id,
        joint_data,
        analysis_metrics: analysis_metrics || null,
        analysis_status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Analysis insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // 4) 이전 분석 결과 조회 (같은 운동)
    const { data: prevAnalysis } = await supabaseAdmin
      .from('exercise_video_analyses')
      .select('analysis_metrics, ai_feedback, created_at')
      .eq('user_id', user.id)
      .eq('exercise_id', exercise_id)
      .eq('analysis_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)

    // 5) 환자 컨텍스트 조회
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('name, diagnosis, treatment, rehab_goal')
      .eq('id', user.id)
      .single()

    const { data: latestPain } = await supabaseAdmin
      .from('pain_logs')
      .select('pain_level, pain_location')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(1)

    // 6) Claude API 프롬프트 구성
    const config = exercise.ai_analysis_config || {}
    let userPrompt = `운동 정보:
- 운동명: ${exercise.name_ko}
- 카테고리: ${exercise.category}
- 운동 설명: ${config.prompt_context || ''}

환자 정보:
- 이름: ${userData?.name || '회원'}
${userData?.diagnosis ? `- 참고 정보: ${userData.diagnosis}` : ''}
${latestPain?.[0] ? `- 최근 통증 점수: ${latestPain[0].pain_level}/10${latestPain[0].pain_location ? ` (${latestPain[0].pain_location})` : ''}` : ''}

관절 분석 데이터:
${JSON.stringify(analysis_metrics || joint_data, null, 2)}
`

    // 이전 분석 비교 데이터
    let comparisonData = null
    if (prevAnalysis && prevAnalysis.length > 0) {
      const prev = prevAnalysis[0]
      comparisonData = {
        prev_metrics: prev.analysis_metrics,
        prev_date: prev.created_at,
      }
      userPrompt += `
이전 분석 데이터 (${new Date(prev.created_at).toLocaleDateString('ko-KR')}):
${JSON.stringify(prev.analysis_metrics, null, 2)}

추가 요청: 이전 분석과 비교하여 개선된 점, 아직 부족한 점, 추세를 분석해주세요.`
    } else {
      userPrompt += `
이 회원의 첫 번째 분석입니다. 현재 상태를 기준점으로 설정하고, 앞으로의 목표를 제시해주세요.`
    }

    // 7) Claude API 호출
    let aiFeedback = ''
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })

      aiFeedback = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('\n')
    } catch (aiError) {
      console.error('Claude API error:', aiError)

      // AI 호출 실패 시 → failed 처리 (횟수 미차감)
      await supabaseAdmin
        .from('exercise_video_analyses')
        .update({
          analysis_status: 'failed',
          failure_reason: 'Claude API 호출 실패',
        })
        .eq('id', analysisRecord.id)

      return NextResponse.json({
        error: '분석 서버가 응답하지 않습니다. 잠시 후 다시 시도해주세요.',
        code: 'AI_ERROR'
      }, { status: 503 })
    }

    // 8) 분석 결과 저장
    const { error: updateError } = await supabaseAdmin
      .from('exercise_video_analyses')
      .update({
        ai_feedback: aiFeedback,
        comparison_data: comparisonData,
        analysis_status: 'completed',
      })
      .eq('id', analysisRecord.id)

    if (updateError) {
      console.error('Analysis update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    // 9) 영상 레코드에 분석 ID 연결
    await supabaseAdmin
      .from('user_exercise_videos')
      .update({ ai_analysis_id: analysisRecord.id })
      .eq('id', video_id)

    // 10) 잔여 횟수 계산
    const remaining = Math.max(0, 4 - (weekCount || 0))

    return NextResponse.json({
      success: true,
      analysis: {
        id: analysisRecord.id,
        ai_feedback: aiFeedback,
        analysis_metrics: analysis_metrics,
        comparison_data: comparisonData,
        analysis_status: 'completed',
        created_at: analysisRecord.created_at,
      },
      remaining_analyses: remaining,
    })

  } catch (err) {
    console.error('AI analysis error:', err)
    return NextResponse.json({
      error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      code: 'SERVER_ERROR'
    }, { status: 500 })
  }
}
