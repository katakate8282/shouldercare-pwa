import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { messaging } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  try {
    // Vercel Cron 인증
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 이번 주 범위 계산 (월요일 ~ 일요일)
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    
    const weekEnd = new Date(now)
    weekEnd.setDate(now.getDate() + mondayOffset - 1) // 지난 일요일
    weekEnd.setHours(23, 59, 59, 999)
    
    const weekStart = new Date(weekEnd)
    weekStart.setDate(weekEnd.getDate() - 6) // 지난 월요일
    weekStart.setHours(0, 0, 0, 0)

    const weekStartISO = weekStart.toISOString()
    const weekEndISO = weekEnd.toISOString()

    // 활성 환자 목록 가져오기 (PLATINUM_PATIENT + PREMIUM)
    const { data: users } = await supabase
      .from('users')
      .select('id, name, subscription_tier, fcm_token')
      .in('subscription_tier', ['PLATINUM_PATIENT', 'PREMIUM', 'TRIAL'])

    if (!users || users.length === 0) {
      return NextResponse.json({ message: 'No active users', count: 0 })
    }

    let reportCount = 0

    for (const user of users) {
      try {
        // 1. 운동 기록 집계
        const { data: exerciseLogs } = await supabase
          .from('exercise_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('completed_at', weekStartISO)
          .lte('completed_at', weekEndISO)

        // 2. 통증 기록 집계
        const { data: painLogs } = await supabase
          .from('pain_logs')
          .select('pain_level, logged_at')
          .eq('user_id', user.id)
          .gte('logged_at', weekStartISO)
          .lte('logged_at', weekEndISO)
          .order('logged_at', { ascending: true })

        // 3. 처방 건수
        const { count: prescriptionCount } = await supabase
          .from('prescriptions')
          .select('*', { count: 'exact', head: true })
          .eq('patient_id', user.id)
          .gte('created_at', weekStartISO)
          .lte('created_at', weekEndISO)

        // 4. 메시지 건수
        const { count: messageCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .gte('created_at', weekStartISO)
          .lte('created_at', weekEndISO)

        // 5. 자가테스트 결과
        const { data: selfTests } = await supabase
          .from('self_test_results')
          .select('estimated_rom, pain_level')
          .eq('user_id', user.id)
          .gte('created_at', weekStartISO)
          .lte('created_at', weekEndISO)
          .order('created_at', { ascending: false })
          .limit(1)

        // 6. AI 영상 분석 집계
        const { data: aiAnalyses } = await supabase
          .from('exercise_video_analyses')
          .select('id, exercise_id, analysis_metrics, ai_feedback, analysis_status, created_at')
          .eq('user_id', user.id)
          .eq('analysis_status', 'completed')
          .gte('created_at', weekStartISO)
          .lte('created_at', weekEndISO)
          .order('created_at', { ascending: false })

        // AI 분석 통계 계산
        const aiAnalysisCount = aiAnalyses?.length || 0
        let aiAvgQualityScore: number | null = null
        let aiBestExercise: string | null = null
        let aiSummary: string | null = null

        if (aiAnalyses && aiAnalyses.length > 0) {
          // 평균 자세 점수
          const scores = aiAnalyses
            .map(a => a.analysis_metrics?.quality_score)
            .filter((s): s is number => typeof s === 'number')
          
          if (scores.length > 0) {
            aiAvgQualityScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10
          }

          // 최고 점수 운동 찾기
          const bestAnalysis = aiAnalyses.reduce((best, curr) => {
            const currScore = curr.analysis_metrics?.quality_score || 0
            const bestScore = best.analysis_metrics?.quality_score || 0
            return currScore > bestScore ? curr : best
          }, aiAnalyses[0])

          if (bestAnalysis.exercise_id) {
            const { data: exerciseData } = await supabase
              .from('exercises')
              .select('name_ko')
              .eq('id', bestAnalysis.exercise_id)
              .single()
            aiBestExercise = exerciseData?.name_ko || null
          }

          // AI 요약 생성 (최신 분석의 피드백에서 핵심 추출)
          const latestFeedback = aiAnalyses[0]?.ai_feedback
          if (latestFeedback) {
            // 피드백에서 첫 2문장 정도만 추출
            const sentences = latestFeedback.split(/[.!]\s/).filter((s: string) => s.trim().length > 5)
            aiSummary = sentences.slice(0, 2).join('. ').trim()
            if (aiSummary.length > 200) aiSummary = aiSummary.substring(0, 197) + '...'
          }
        }

        // 운동 일수 계산
        const exerciseDays = new Set(
          (exerciseLogs || []).map(l => new Date(l.completed_at).toISOString().split('T')[0])
        ).size

        // 총 운동 횟수
        const totalExercises = (exerciseLogs || []).length

        // 통증 평균
        const painAvg = painLogs && painLogs.length > 0
          ? Math.round(painLogs.reduce((s, l) => s + l.pain_level, 0) / painLogs.length * 10) / 10
          : null

        // 통증 변화 (첫 기록 vs 마지막 기록)
        const painChange = painLogs && painLogs.length >= 2
          ? painLogs[painLogs.length - 1].pain_level - painLogs[0].pain_level
          : null

        // 리포트 데이터
        const reportData = {
          user_id: user.id,
          week_start: weekStartISO.split('T')[0],
          week_end: weekEndISO.split('T')[0],
          exercise_days: exerciseDays,
          total_exercises: totalExercises,
          exercise_completion_rate: Math.round((exerciseDays / 7) * 100),
          pain_average: painAvg,
          pain_change: painChange,
          pain_logs_count: painLogs?.length || 0,
          prescription_count: prescriptionCount || 0,
          message_count: messageCount || 0,
          self_test_rom: selfTests?.[0]?.estimated_rom || null,
          self_test_pain: selfTests?.[0]?.pain_level || null,
          ai_analysis_count: aiAnalysisCount,
          ai_avg_quality_score: aiAvgQualityScore,
          ai_best_exercise: aiBestExercise,
          ai_summary: aiSummary,
          created_at: new Date().toISOString(),
        }

        // weekly_reports 테이블에 저장
        const { error: insertError } = await supabase
          .from('weekly_reports')
          .upsert(reportData, { onConflict: 'user_id,week_start' })

        if (insertError) {
          console.error(`Report insert error for ${user.id}:`, insertError)
          continue
        }

        // 7. 푸시 알림 전송
        if (user.fcm_token) {
          try {
            const completionEmoji = exerciseDays >= 5 ? '🎉' : exerciseDays >= 3 ? '💪' : '📊'
            const aiPart = aiAnalysisCount > 0 ? ` · AI 분석 ${aiAnalysisCount}건` : ''
            await messaging.send({
              token: user.fcm_token,
              notification: {
                title: `${completionEmoji} 주간 리포트가 도착했어요!`,
                body: `이번 주 ${exerciseDays}일 운동 완료 (${Math.round((exerciseDays / 7) * 100)}%)${painAvg !== null ? ` · 평균 통증 ${painAvg}` : ''}${aiPart}`,
              },
              webpush: {
                fcmOptions: {
                  link: '/weekly-report',
                },
              },
            })
          } catch (pushError) {
            console.error(`Push error for ${user.id}:`, pushError)
          }
        }

        reportCount++
      } catch (userError) {
        console.error(`Error processing user ${user.id}:`, userError)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Weekly reports generated`,
      count: reportCount,
      week: `${weekStartISO.split('T')[0]} ~ ${weekEndISO.split('T')[0]}`,
    })
  } catch (error) {
    console.error('Weekly report cron error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
