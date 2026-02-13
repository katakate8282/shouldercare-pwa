import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export async function GET(request: NextRequest) {
  try {
    // 1. Authorization 헤더에서 Supabase 토큰 확인
    const authHeader = request.headers.get('authorization')
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      
      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token)

      if (!authError && authUser) {
        // auth_id로 users 테이블 조회
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('auth_id', authUser.id)
          .single()

        if (user) {
          return NextResponse.json({ user })
        }

        // auth_id 없으면 email로 찾아서 연결
        const email = authUser.email || `kakao_${authUser.user_metadata?.provider_id || authUser.id}@shouldercare.app`
        const { data: userByEmail } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', email)
          .single()

        if (userByEmail) {
          await supabaseAdmin
            .from('users')
            .update({ auth_id: authUser.id, updated_at: new Date().toISOString() })
            .eq('id', userByEmail.id)
          return NextResponse.json({ user: { ...userByEmail, auth_id: authUser.id } })
        }

        return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
      }
    }

    // 2. Fallback: 기존 쿠키 세션 확인 (마이그레이션 기간용)
    const sessionCookie = request.cookies.get('session')
    if (sessionCookie) {
      const sessionData = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString())
      if (sessionData.exp < Date.now()) {
        return NextResponse.json({ error: '세션이 만료되었습니다.' }, { status: 401 })
      }

      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', sessionData.userId)
        .single()

      if (error || !user) {
        return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 })
      }

      return NextResponse.json({ user })
    }

    return NextResponse.json({ user: null }, { status: 401 })
  } catch (error) {
    console.error('세션 확인 에러:', error)
    return NextResponse.json({ error: '세션 확인 실패' }, { status: 500 })
  }
}
