import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function sha256Hash(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

function generateToken(userId: string, email: string): string {
  const payload = {
    userId,
    email,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    iat: Date.now(),
  }
  const secret = process.env.JWT_SECRET
  const data = JSON.stringify(payload)
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex')
  return Buffer.from(JSON.stringify({ data: payload, sig: signature })).toString('base64url')
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: '이메일과 비밀번호를 입력해주세요.' }, { status: 400 })
    }

    const { data: user, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single()

    if (dbError || !user) {
      return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    const storedHash = user.password_hash
    let passwordValid = false

    if (storedHash && (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$'))) {
      passwordValid = await bcrypt.compare(password, storedHash)
    } else if (storedHash) {
      passwordValid = storedHash === sha256Hash(password)
      if (passwordValid) {
        const bcryptHash = await bcrypt.hash(password, 10)
        await supabase
          .from('users')
          .update({ password_hash: bcryptHash, updated_at: new Date().toISOString() })
          .eq('id', user.id)
      }
    }

    if (!passwordValid) {
      return NextResponse.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 })
    }

    await supabase
      .from('users')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', user.id)

    const redirect = user.onboarding_completed === true ? '/dashboard' : '/onboarding'
    const token = generateToken(user.id, user.email)

    const response = NextResponse.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name },
      redirect,
    })

    response.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })

    response.cookies.set('user_id', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
