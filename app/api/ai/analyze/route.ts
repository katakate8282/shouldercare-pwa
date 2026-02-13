import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SYSTEM_PROMPT = `너는 어깨 재활 전문 AI 분석가야.
환자의 통증 설문과 ROM(관절가동범위) 측정 결과를 분석해서 상태를 추정하고 맞춤 운동을 추천해.

⚠️ 반드시 지킬 규칙:
1. 의학적 "진단"이라고 하지 마. "추정 상태" 또는 "가능성"이라고 표현해.
2. 반드시 면책 문구를 포함해: "이 결과는 AI 참고용이며 의학적 진단이 아닙니다. 정확한 진단은 전문의 상담을 받으세요."
3. 응답은 반드시 JSON 형식으로만 (마크다운 코드블록 없이 순수 JSON).
4. 통증 강도가 높을수록 저강도 운동 위주로 추천.
5. 한국어로 응답해.
6. 운동 추천은 3~5개로 제한.

[ROM 정상 범위 기준]
- 굴곡(Flexion): 150~180° (120° 미만 = 심한 제한, 120~150° = 중간 제한)
- 외전(Abduction): 150~180° (120° 미만 = 심한 제한, 120~150° = 중간 제한)  
- 외회전(External Rotation): 60~90° (40° 미만 = 심한 제한, 40~60° = 중간 제한)

[추정 상태 가이드라인]
- 야간 통증 심함 + 팔 올리기 통증 + ROM 중간제한 → 충돌증후군 가능성
- ROM 전반적 심한 제한 + 경직 + 6개월 이상 → 동결견(오십견) 가능성
- 외회전 심한 제한 + 뒤쪽 통증 + 물건 들기 통증 → 회전근개 손상 가능성
- 가만히 있어도 극심한 통증 + 야간통 → 석회성건염 가능성
- 던지기/팔 올리기 통증 + 젊은 환자 → 슬랩/방카르트 가능성

[운동 추천 가이드라인]
- 통증 8~10: 통증 완화 + 가벼운 스트레칭만 (난이도 1). "병원 방문 권장" 반드시 포함.
- 통증 5~7: 스트레칭 + 가벼운 강화 운동 (난이도 1~2)
- 통증 1~4: 스트레칭 + 강화 + 기능적 운동 (난이도 1~3)
- ROM 심한 제한: 관절가동범위 회복 운동 우선
- 수술 후 재활 중: 보수적 접근, 저강도만

[위험 신호 - see_doctor_flag를 true로]
- 통증 8 이상
- 가만히 있어도 극심한 통증
- ROM 심한 제한 (굴곡 < 90° 또는 외전 < 90°)
- 수술 후 재활 중인데 통증 악화
- 야간 통증이 "항상"

[응답 JSON 형식]
{
  "estimated_condition": "추정 상태명 (예: 어깨 충돌증후군 가능성)",
  "confidence": "high/medium/low",
  "analysis": "상세 분석 (자연어, 환자에게 설명하듯 친근하게 3~5문장)",
  "recommended_exercises": [
    {
      "name": "운동명",
      "sets": 3,
      "reps": 10,
      "reason": "이 운동을 추천하는 이유 (1~2문장)"
    }
  ],
  "weekly_frequency": "주 N회",
  "progression_note": "향후 운동 진행 가이드 (1~2문장)",
  "precautions": "주의사항 (1~2문장)",
  "see_doctor_flag": true/false,
  "see_doctor_reason": "전문의 상담이 필요한 경우 이유 (해당 없으면 빈 문자열)",
  "disclaimer": "이 결과는 AI 참고용이며 의학적 진단이 아닙니다. 정확한 진단은 전문의 상담을 받으세요."
}`

// 병원 진단/시술 데이터 조회
async function getHospitalData(userId: string): Promise<{ diagnosis: string | null; surgery_name: string | null; surgery_date: string | null; hospital_name: string | null; program_week: number | null } | null> {
  try {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('active_hospital_patient_id, hospital_id')
      .eq('id', userId)
      .single()

    if (!user?.active_hospital_patient_id) return null

    const { data: hp } = await supabaseAdmin
      .from('hospital_patients')
      .select('diagnosis, surgery_name, surgery_date, program_start_date')
      .eq('id', user.active_hospital_patient_id)
      .single()

    if (!hp) return null

    // 주차 계산
    let program_week = null
    if (hp.program_start_date) {
      const startDate = new Date(hp.program_start_date)
      const now = new Date()
      const diffDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      program_week = Math.min(Math.max(Math.ceil(diffDays / 7), 1), 12)
    }

    // 병원명 조회
    let hospital_name = null
    if (user.hospital_id) {
      const { data: hospital } = await supabaseAdmin
        .from('hospitals')
        .select('name')
        .eq('id', user.hospital_id)
        .single()
      hospital_name = hospital?.name || null
    }

    return {
      diagnosis: hp.diagnosis,
      surgery_name: hp.surgery_name,
      surgery_date: hp.surgery_date,
      hospital_name,
      program_week,
    }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { survey, rom, userId } = await req.json()

    if (!survey) {
      return NextResponse.json({ error: '설문 데이터가 없습니다' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다' }, { status: 500 })
    }

    // 병원 데이터 조회
    let hospitalSection = ''
    if (userId) {
      const hospitalData = await getHospitalData(userId)
      if (hospitalData && (hospitalData.diagnosis || hospitalData.surgery_name)) {
        hospitalSection = `\n[🏥 병원 진단 정보 — 최우선 참고]
- 병원: ${hospitalData.hospital_name || '알 수 없음'}
- 의사 진단명: ${hospitalData.diagnosis || '미입력'}
- 시술/수술명: ${hospitalData.surgery_name || '없음'}
- 시술일: ${hospitalData.surgery_date || '미입력'}
- 재활 프로그램: ${hospitalData.program_week}주차 / 12주
⚠️ 위 병원 진단 정보는 전문의가 확인한 정보이므로, 설문 기반 추정보다 우선하여 반영하세요.
운동 추천 시 진단명과 시술 후 경과(주차)를 반드시 고려하세요.\n`
      }
    }

    // 사용자 데이터를 프롬프트로 구성
    const userMessage = `아래 환자의 통증 설문과 ROM 측정 결과를 분석해주세요.
${hospitalSection}
[통증 설문]
- 아픈 쪽: ${survey.side === 'left' ? '왼쪽' : survey.side === 'right' ? '오른쪽' : '양쪽'}
- 통증 부위: ${(survey.pain_location || []).join(', ')}
- 통증 강도: ${survey.pain_intensity}/10
- 통증 시작 시기: ${survey.duration}
- 야간 통증: ${survey.night_pain}
- 통증이 심한 동작: ${(survey.painful_movements || []).join(', ')}
- 이전 진단: ${(survey.previous_diagnosis || []).join(', ')}
- 현재 치료: ${(survey.current_treatment || []).join(', ')}
${survey.treatment_detail && survey.treatment_detail.length > 0 ? `- 치료 상세: ${survey.treatment_detail.join(', ')}` : ''}
${survey.chronic_disease ? `- 만성질환: 있음 (복용약: ${survey.chronic_medication || '미입력'})` : '- 만성질환: 없음'}
${survey.regular_exercise ? `- 정기 운동: 있음 (${survey.regular_exercise_detail || '미입력'})` : '- 정기 운동: 없음'}

[ROM 측정 결과]
${rom && rom.flexion !== null ? `- 굴곡: ${rom.flexion}° (정상: 150~180°)` : '- 굴곡: 미측정'}
${rom && rom.abduction !== null ? `- 외전: ${rom.abduction}° (정상: 150~180°)` : '- 외전: 미측정'}
${rom && rom.external_rotation !== null ? `- 외회전: ${rom.external_rotation}° (정상: 60~90°)` : '- 외회전: 미측정'}

위 데이터를 기반으로 추정 상태와 맞춤 운동을 JSON 형식으로 응답해주세요.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userMessage }
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Claude API error:', response.status, errorText)
      return NextResponse.json({ error: `AI 분석 실패 (${response.status})` }, { status: 500 })
    }

    const data = await response.json()
    const aiText = data.content?.[0]?.text || ''

    // JSON 파싱
    let aiResult
    try {
      const cleaned = aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      aiResult = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Raw:', aiText)
      aiResult = {
        estimated_condition: 'AI 분석 완료',
        confidence: 'medium',
        analysis: aiText,
        recommended_exercises: [],
        weekly_frequency: '주 3~5회',
        progression_note: '통증이 줄면 단계적으로 강도를 높여주세요.',
        precautions: '통증이 심해지면 즉시 중단하세요.',
        see_doctor_flag: false,
        see_doctor_reason: '',
        disclaimer: '이 결과는 AI 참고용이며 의학적 진단이 아닙니다.',
      }
    }

    // DB 저장
    let savedId = null
    if (userId) {
      try {
        const { data: insertData, error: insertError } = await supabaseAdmin
          .from('self_test_results')
          .insert({
            user_id: userId,
            survey_data: survey,
            rom_data: rom || null,
            ai_result: aiResult,
            estimated_condition: aiResult.estimated_condition || null,
            pain_intensity: survey.pain_intensity || null,
            see_doctor_flag: aiResult.see_doctor_flag || false,
          })
          .select('id')
          .single()

        if (insertError) {
          console.error('DB insert error:', insertError)
        } else {
          savedId = insertData?.id
        }
      } catch (dbErr) {
        console.error('DB save error:', dbErr)
      }
    }

    return NextResponse.json({ result: aiResult, savedId })

  } catch (error: any) {
    console.error('Analyze API error:', error)
    return NextResponse.json({ error: error.message || 'AI 분석 중 오류가 발생했습니다' }, { status: 500 })
  }
}
