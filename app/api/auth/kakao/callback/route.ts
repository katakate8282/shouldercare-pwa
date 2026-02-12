import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    if (error) return NextResponse.redirect(new URL('/login?error=kakao_auth_failed', request.url))
    if (!code) return NextResponse.redirect(new URL('/login?error=no_code', request.url))
    const kakaoClientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID
    const kakaoClientSecret = process.env.KAKAO_CLIENT_SECRET
    const redirectUri = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!kakaoClientId || !kakaoClientSecret || !redirectUri) return NextResponse.redirect(new URL('/login?error=config_error', request.url))
    if (!supabaseUrl || !supabaseServiceKey) return NextResponse.redirect(new URL('/login?error=database_error', request.url))
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', client_id: kakaoClientId, client_secret: kakaoClientSecret, redirect_uri: redirectUri, code })
    })
    if (!tokenResponse.ok) return NextResponse.redirect(new URL('/login?error=token_exchange_failed', request.url))
    const tokenData = await tokenResponse.json()
    const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', { headers: { Authorization: `Bearer ${tokenData.access_token}` } })
    if (!userResponse.ok) return NextResponse.redirect(new URL('/login?error=user_info_failed', request.url))
    const kakaoUser = await userResponse.json()
    const supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    const userData = {
      kakao_id: String(kakaoUser.id),
      email: kakaoUser.kakao_account?.email || `kakao_${kakaoUser.id}@temp.com`,
      name: kakaoUser.kakao_account?.profile?.nickname || '사용자',
      profile_image: kakaoUser.kakao_account?.profile?.profile_image_url || null,
      updated_at: new Date().toISOString()
    }
    const { data: user, error: dbError } = await supabase.from('users').upsert(userData, { onConflict: 'kakao_id', ignoreDuplicates: false }).select().single()
    if (dbError) return NextResponse.redirect(new URL('/login?error=database_error', request.url))
    const response = NextResponse.redirect(new URL('/dashboard', request.url))
    response.cookies.set('user_id', user.id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 })
    response.cookies.set('kakao_access_token', tokenData.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: tokenData.expires_in || 60 * 60 * 6 })
    return response
  } catch (error) {
    return NextResponse.redirect(new URL('/login?error=unexpected_error', request.url))
  }
}
