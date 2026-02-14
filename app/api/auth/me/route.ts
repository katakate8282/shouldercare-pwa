import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

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

export async function GET(request: NextRequest) {
  try {
    // 1. Authorization 헤더에서 토큰 확인
    const authHeader = request.headers.get('authorization')

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const payload = verifyToken(token)

      if (payload) {
        const { data: user, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', payload.userId)
          .single()

        if (!error && user) {
          return NextResponse.json({ user })
        }
      }

      return NextResponse.json({ error: '세션이 만료되었습니다.' }, { status: 401 })
    }

    // 2. Fallback: 쿠키 세션 확인
    const sessionCookie = request.cookies.get('session')
    if (sessionCookie) {
      // 새 토큰 형식 시도
      const tokenPayload = verifyToken(sessionCookie.value)
      if (tokenPayload) {
        const { data: user, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', tokenPayload.userId)
          .single()

        if (!error && user) {
          return NextResponse.json({ user })
        }
      }

      // 기존 base64 형식 시도 (하위 호환)
      try {
        const sessionData = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString())
        if (sessionData.exp >= Date.now()) {
          const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', sessionData.userId)
            .single()

          if (!error && user) {
            return NextResponse.json({ user })
          }
        }
      } catch {
        // 파싱 실패 무시
      }
    }

    return NextResponse.json({ user: null }, { status: 401 })
  } catch (error) {
    console.error('세션 확인 에러:', error)
    return NextResponse.json({ error: '세션 확인 실패' }, { status: 500 })
  }
}
