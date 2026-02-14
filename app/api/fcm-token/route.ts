import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function verifyToken(token: string): { userId: string; email: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString())
    const { data, sig } = decoded
    const secret = process.env.JWT_SECRET
    const expectedSig = crypto.createHmac('sha256', secret).update(JSON.stringify(data)).digest('hex')
    if (sig !== expectedSig) return null
    if (data.exp < Date.now()) return null
    return { userId: data.userId, email: data.email }
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    // Authorization 헤더에서 토큰 확인
    const authHeader = req.headers.get('authorization')
    let userId: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      const payload = verifyToken(authHeader.substring(7))
      if (payload) userId = payload.userId
    }

    // Fallback: 쿠키
    if (!userId) {
      const sessionCookie = req.cookies.get('session')
      if (sessionCookie) {
        const payload = verifyToken(sessionCookie.value)
        if (payload) userId = payload.userId
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { fcmToken } = await req.json()

    if (!fcmToken) {
      return NextResponse.json({ error: 'fcmToken required' }, { status: 400 })
    }

    // 기존 토큰 삭제 후 새로 삽입 (같은 디바이스 토큰 중복 방지)
    await supabase
      .from('fcm_tokens')
      .delete()
      .eq('token', fcmToken)

    const { error } = await supabase
      .from('fcm_tokens')
      .upsert(
        {
          user_id: userId,
          token: fcmToken,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' }
      )

    if (error) {
      console.error('FCM token save error:', error)
      return NextResponse.json({ error: 'Failed to save token' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('FCM token API error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
