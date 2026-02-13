import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { messaging } from '@/lib/firebase-admin'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId, title, body, url, secret } = await req.json()

    // 인증: CRON_SECRET 또는 SERVICE_ROLE_KEY 앞 32자
    const validSecrets = [
      process.env.CRON_SECRET,
      process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 32),
    ].filter(Boolean)

    if (!secret || !validSecrets.includes(secret)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!userId || !title || !body) {
      return NextResponse.json({ error: 'userId, title, body required' }, { status: 400 })
    }

    const { data: tokens } = await supabase
      .from('fcm_tokens')
      .select('token')
      .eq('user_id', userId)

    if (!tokens || tokens.length === 0) {
      return NextResponse.json({ sent: 0, reason: 'no_tokens' })
    }

    let sent = 0
    const invalidTokens: string[] = []

    for (const { token } of tokens) {
      try {
        await messaging.send({
          token,
          notification: { title, body },
          data: { url: url || '/dashboard' },
          webpush: {
            fcmOptions: { link: url || '/dashboard' },
            notification: {
              icon: '/icons/icon-192x192.png',
              badge: '/icons/icon-72x72.png',
            },
          },
        })
        sent++
      } catch (err: any) {
        if (
          err?.code === 'messaging/invalid-registration-token' ||
          err?.code === 'messaging/registration-token-not-registered'
        ) {
          invalidTokens.push(token)
        }
        console.error(`Push failed for token ${token.slice(0, 20)}...`, err?.code || err)
      }
    }

    if (invalidTokens.length > 0) {
      await supabase
        .from('fcm_tokens')
        .delete()
        .in('token', invalidTokens)
    }

    return NextResponse.json({ sent, total: tokens.length, cleaned: invalidTokens.length })
  } catch (error) {
    console.error('Send push error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
