import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  console.log('Kakao Callback - Code:', code)
  console.log('Kakao Callback - Error:', error)

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${error}`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url))
  }

  try {
    // 현재 요청의 호스트를 기반으로 Redirect URI 생성
    const host = request.headers.get('host')
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
    const redirectUri = `${protocol}://${host}/api/auth/kakao/callback`

    console.log('Token exchange - Redirect URI:', redirectUri)

    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID!,
        redirect_uri: redirectUri,
        code,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error('Token exchange failed:', errorData)
      throw new Error('토큰 교환 실패')
    }
    
    const tokenData = await tokenResponse.json()
    console.log('Token received:', tokenData.access_token ? 'Success' : 'Failed')
    
    const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!userResponse.ok) throw new Error('사용자 정보 조회 실패')
    const kakaoUser = await userResponse.json()
    console.log('Kakao User ID:', kakaoUser.id)

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('kakao_id', kakaoUser.id.toString())
      .single()

    let userId: string

    if (existingUser) {
      await supabase.from('users').update({
        name: kakaoUser.properties?.nickname || '사용자',
        email: kakaoUser.kakao_account?.email || null,
        profile_image: kakaoUser.properties?.profile_image || null,
        updated_at: new Date().toISOString(),
      }).eq('kakao_id', kakaoUser.id.toString())
      userId = existingUser.id
    } else {
      const { data: newUser } = await supabase.from('users').insert({
        kakao_id: kakaoUser.id.toString(),
        name: kakaoUser.properties?.nickname || '사용자',
        email: kakaoUser.kakao_account?.email || null,
        profile_image: kakaoUser.properties?.profile_image || null,
        user_type: 'UNSUBSCRIBED',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select().single()
      userId = newUser!.id
    }

    const sessionToken = Buffer.from(JSON.stringify({
      userId,
      kakaoId: kakaoUser.id.toString(),
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })).toString('base64')

    const response = NextResponse.redirect(new URL('/dashboard', request.url))
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })
    
    console.log('Login successful, redirecting to dashboard')
    return response
  } catch (error) {
    console.error('카카오 로그인 에러:', error)
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
  }
}
