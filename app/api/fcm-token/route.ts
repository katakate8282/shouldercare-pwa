import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    const userId = decoded.userId

    const { fcmToken } = await req.json()

    if (!fcmToken) {
      return NextResponse.json({ error: 'fcmToken required' }, { status: 400 })
    }

    // upsert: 같은 유저+토큰이면 updated_at만 갱신
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
