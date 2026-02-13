import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: '이메일과 비밀번호를 입력해주세요.' }, { status: 400 })
    }

    // 기존 users 테이블에서 유저 확인
    const { data: user, error: dbError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (dbError || !user) {
      return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    if (user.password_hash !== hashPassword(password)) {
      return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    // Supabase Auth에 유저가 없으면 마이그레이션
    if (!user.auth_id) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: user.name },
      })

      if (!authError && authData.user) {
        await supabaseAdmin
          .from('users')
          .update({ auth_id: authData.user.id, updated_at: new Date().toISOString() })
          .eq('id', user.id)
      }
    }

    await supabaseAdmin
      .from('users')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', user.id)

    const redirect = user.onboarding_completed === true ? '/dashboard' : '/onboarding'

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      redirect,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
