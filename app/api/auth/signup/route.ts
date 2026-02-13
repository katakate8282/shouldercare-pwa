import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { authId, email, name } = body

    if (!email || !name) {
      return NextResponse.json({ error: '이름과 이메일을 입력해주세요.' }, { status: 400 })
    }

    // 이미 존재하는지 확인
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      // 기존 유저에 auth_id 연결
      if (authId) {
        await supabaseAdmin
          .from('users')
          .update({ auth_id: authId, updated_at: new Date().toISOString() })
          .eq('id', existingUser.id)
      }
      return NextResponse.json({
        success: true,
        user: { id: existingUser.id },
        redirect: '/onboarding',
      })
    }

    // 새 유저 생성
    const { data: user, error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        auth_id: authId || null,
        email,
        name,
        onboarding_completed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dbError) {
      console.error('Signup DB error:', dbError)
      return NextResponse.json({ error: '회원가입 처리 중 오류가 발생했습니다.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
      redirect: '/onboarding',
    })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: '회원가입 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
