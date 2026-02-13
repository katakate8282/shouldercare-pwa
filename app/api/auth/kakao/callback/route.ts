import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function generateToken(userId: string, email: string): string {
  const payload = {
    userId,
    email,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30일
    iat: Date.now(),
  }
  const secret = process.env.TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'shouldercare-secret'
  const data = JSON.stringify(payload)
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex')
  return Buffer.from(JSON.stringify({ data: payload, sig: signature })).toString('base64url')
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')

    if (!code) return NextResponse.redirect(new URL('/login?error=no_code', request.url))

    const kakaoClientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID
    const kakaoClientSecret = process.env.KAKAO_CLIENT_SECRET
    const redirectUri = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!kakaoClientId || !redirectUri || !supabaseUrl || !supabaseServiceKey) {
      return NextResponse.redirect(new URL('/login?error=config_error', request.url))
    }

    // 카카오 토큰 교환
    const tokenBody: Record<string, string> = {
      grant_type: 'authorization_code',
      client_id: kakaoClientId,
      redirect_uri: redirectUri,
      code,
    }
    if (kakaoClientSecret) tokenBody.client_secret = kakaoClientSecret

    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(tokenBody),
    })

    if (!tokenResponse.ok) return NextResponse.redirect(new URL('/login?error=token_exchange_failed', request.url))

    const tokenData = await tokenResponse.json()

    // 카카오 유저 정보
    const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!userResponse.ok) return NextResponse.redirect(new URL('/login?error=user_info_failed', request.url))

    const kakaoUser = await userResponse.json()

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const email = kakaoUser.kakao_account?.email || `kakao_${kakaoUser.id}@shouldercare.app`
    const name = kakaoUser.kakao_account?.profile?.nickname || '사용자'

    const { data: existingUser } = await supabase
      .from('users')
      .select('id, onboarding_completed')
      .eq('email', email)
      .single()

    let userId: string
    let onboardingDone = false

    if (existingUser) {
      userId = existingUser.id
      onboardingDone = existingUser.onboarding_completed === true

      await supabase
        .from('users')
        .update({
          name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id)
    } else {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          email,
          name,
          onboarding_completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (insertError || !newUser) {
        console.error('Database error:', insertError)
        return NextResponse.redirect(new URL('/login?error=database_error', request.url))
      }

      userId = newUser.id
      onboardingDone = false
    }

    // JWT-like 토큰 생성
    const token = generateToken(userId, email)
    const redirectPath = onboardingDone ? '/dashboard' : '/onboarding'

    // 토큰을 login 페이지로 전달 → 클라이언트에서 localStorage에 저장 후 리다이렉트
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('token', token)
    loginUrl.searchParams.set('redirect', redirectPath)

    return NextResponse.redirect(loginUrl)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.redirect(new URL('/login?error=unexpected_error', request.url))
  }
}
