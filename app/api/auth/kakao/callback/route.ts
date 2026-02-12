import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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

    if (!kakaoClientId || !kakaoClientSecret || !redirectUri || !supabaseUrl || !supabaseServiceKey) {
      return NextResponse.redirect(new URL('/login?error=config_error', request.url))
    }

    // Exchange code for token
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: kakaoClientId,
        client_secret: kakaoClientSecret,
        redirect_uri: redirectUri,
        code
      })
    })

    if (!tokenResponse.ok) return NextResponse.redirect(new URL('/login?error=token_exchange_failed', request.url))

    const tokenData = await tokenResponse.json()

    // Get user info from Kakao
    const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    })

    if (!userResponse.ok) return NextResponse.redirect(new URL('/login?error=user_info_failed', request.url))

    const kakaoUser = await userResponse.json()

    // Upsert user in Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const email = kakaoUser.kakao_account?.email || `kakao_${kakaoUser.id}@shouldercare.app`
    const userData = {
      email: email,
      name: kakaoUser.kakao_account?.profile?.nickname || '사용자',
      updated_at: new Date().toISOString()
    }

    const { data: user, error: dbError } = await supabase
      .from('users')
      .upsert(userData, { onConflict: 'email', ignoreDuplicates: false })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.redirect(new URL('/login?error=database_error', request.url))
    }

    // Create session cookie (same format as email login)
    const sessionData = {
      userId: user.id,
      email: user.email,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    }
    const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64')

    // Redirect to dashboard with cookies
    const response = NextResponse.redirect(new URL('/dashboard', request.url))

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
    console.error('Unexpected error:', error)
    return NextResponse.redirect(new URL('/login?error=unexpected_error', request.url))
  }
}
