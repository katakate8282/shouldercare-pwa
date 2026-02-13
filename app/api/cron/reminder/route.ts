import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { messaging } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const REMINDER_MESSAGES = [
  {
    title: '💪 운동할 시간이에요!',
    body: '꾸준한 재활운동이 회복의 핵심이에요. 오늘 운동을 시작해 보세요!',
  },
  {
    title: '🏃 어깨가 기다리고 있어요!',
    body: '3일 넘게 운동을 쉬었어요. 가볍게라도 시작해 볼까요?',
  },
  {
    title: '📊 꾸준함이 실력이에요!',
    body: '재활 운동은 꾸준히 하는 것이 중요해요. 오늘도 화이팅!',
  },
]

export async function GET(req: Request) {
  try {
    // Vercel Cron 인증
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

    // 1. 환자 목록 조회 (admin, trainer 제외)
    const { data: patients } = await supabase
      .from('users')
      .select('id, name')
      .not('role', 'in', '("trainer","admin")')

    if (!patients || patients.length === 0) {
      return NextResponse.json({ message: 'No patients', sent: 0 })
    }

    let totalSent = 0
    let totalSkipped = 0

    for (const patient of patients) {
      // 2. 최근 3일 이내 운동 기록 확인
      const { data: recentLogs } = await supabase
        .from('exercise_logs')
        .select('id')
        .eq('user_id', patient.id)
        .gte('completed_at', threeDaysAgo.toISOString())
        .limit(1)

      // 운동 기록이 있으면 스킵
      if (recentLogs && recentLogs.length > 0) {
        totalSkipped++
        continue
      }

      // 3. FCM 토큰 조회
      const { data: tokens } = await supabase
        .from('fcm_tokens')
        .select('token')
        .eq('user_id', patient.id)

      if (!tokens || tokens.length === 0) continue

      // 4. 랜덤 메시지 선택
      const msg = REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)]

      // 5. 푸시 발송
      for (const { token } of tokens) {
        try {
          await messaging.send({
            token,
            notification: { title: msg.title, body: msg.body },
            data: { url: '/dashboard' },
            webpush: {
              fcmOptions: { link: '/dashboard' },
              notification: {
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-72x72.png',
              },
            },
          })
          totalSent++
        } catch (err: any) {
          if (
            err?.code === 'messaging/invalid-registration-token' ||
            err?.code === 'messaging/registration-token-not-registered'
          ) {
            await supabase.from('fcm_tokens').delete().eq('token', token)
          }
        }
      }
    }

    return NextResponse.json({
      message: 'Reminder cron completed',
      sent: totalSent,
      skipped: totalSkipped,
      total: patients.length,
    })
  } catch (error) {
    console.error('Reminder cron error:', error)
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 })
  }
}
