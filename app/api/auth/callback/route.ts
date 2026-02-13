import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const next = searchParams.get('next') || '/dashboard'

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url))
  }

  try {
    // Supabase 클라이언트로 code → session 교환
    const supabaseAuth = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    const { data: sessionData, error: authError } = await supabaseAuth.auth.exchangeCodeForSession(code)

    if (authError || !sessionData.user) {
      console.error('Auth error:', authError)
      return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
    }

    const authUser = sessionData.user
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 기존 users 테이블에서 유저 찾기
    const email = authUser.email || `kakao_${authUser.user_metadata?.provider_id || authUser.id}@shouldercare.app`
    const name = authUser.user_metadata?.full_name || authUser.user_metadata?.name || '사용자'

    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, onboarding_completed')
      .eq('email', email)
      .single()

    let redirectPath = next
    
    if (existingUser) {
      // 기존 유저: auth_id 연결 + 업데이트
      await supabaseAdmin
        .from('users')
        .update({
          auth_id: authUser.id,
          name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id)

      redirectPath = existingUser.onboarding_completed ? '/dashboard' : '/onboarding'
    } else {
      // 신규 유저: users 테이블에 생성
      const { error: insertError } = await supabaseAdmin
        .from('users')
        .insert({
          auth_id: authUser.id,
          email,
          name,
          onboarding_completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

      if (insertError) {
        console.error('Insert error:', insertError)
        return NextResponse.redirect(new URL('/login?error=database_error', request.url))
      }

      redirectPath = '/onboarding'
    }

    // 리다이렉트 (Supabase Auth 세션은 클라이언트에서 자동 관리)
    return NextResponse.redirect(new URL(redirectPath, request.url))
  } catch (error) {
    console.error('Callback error:', error)
    return NextResponse.redirect(new URL('/login?error=unexpected_error', request.url))
  }
}
