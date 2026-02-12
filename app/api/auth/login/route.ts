import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: '이메일과 비밀번호를 입력해주세요.' }, { status: 400 })
    }

    // Find user
    const { data: user, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (dbError || !user) {
      return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    // Check password
    if (user.password_hash !== hashPassword(password)) {
      return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    // Update last login
    await supabase
      .from('users')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', user.id)

    // Decide redirect based on onboarding status
    const redirect = user.onboarding_completed === true ? '/dashboard' : '/onboarding'

    // Create session
    const sessionData = {
      userId: user.id,
      email: user.email,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000
    }
    const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64')

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      redirect
    })

    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    })

    response.cookies.set('user_id', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
