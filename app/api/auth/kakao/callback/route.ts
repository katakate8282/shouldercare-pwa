import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  console.log('=== Kakao Callback Start ===')
  console.log('Code:', code ? 'Received' : 'Missing')
  console.log('Error:', error)

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${error}`, request.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url))
  }

  try {
    const clientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID!
    const clientSecret = process.env.KAKAO_CLIENT_SECRET!
    const redirectUri = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI || 'https://shouldercare-pwa.vercel.app/api/auth/kakao/callback'
    
    console.log('Client ID:', clientId)
    console.log('Client Secret:', clientSecret ? 'Present' : 'Missing')
    console.log('Redirect URI:', redirectUri)

    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    })

    const tokenText = await tokenResponse.text()
    console.log('Token Response Status:', tokenResponse.status)
    console.log('Token Response:', tokenText)

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenText}`)
    }
    
    const tokenData = JSON.parse(tokenText)
    console.log('Access Token:', tokenData.access_token ? 'Received' : 'Missing')
    
    const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!userResponse.ok) {
      const userError = await userResponse.text()
      throw new Error(`User info failed: ${userError}`)
    }
    
    const kakaoUser = await userResponse.json()
    console.log('Kakao User ID:', kakaoUser.id)

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('kakao_id', kakaoUser.id.toString())
      .single()

    let userId: string

    if (existingUser) {
      console.log('Existing user found:', existingUser.id)
      await supabase.from('users').update({
        name: kakaoUser.properties?.nickname || '사용자',
        email: kakaoUser.kakao_account?.email || null,
        profile_image: kakaoUser.properties?.profile_image || null,
        updated_at: new Date().toISOString(),
      }).eq('kakao_id', kakaoUser.id.toString())
      userId = existingUser.id
    } else {
      console.log('Creating new user')
      const { data: newUser, error: insertError } = await supabase.from('users').insert({
        kakao_id: kakaoUser.id.toString(),
        name: kakaoUser.properties?.nickname || '사용자',
        email: kakaoUser.kakao_account?.email || null,
        profile_image: kakaoUser.properties?.profile_image || null,
        user_type: 'UNSUBSCRIBED',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).select().single()
      
      if (insertError) {
        console.error('Supabase insert error:', insertError)
        throw new Error(`Database error: ${insertError.message}`)
      }
      
      userId = newUser!.id
    }

    const sessionToken = Buffer.from(JSON.stringify({
      userId,
      kakaoId: kakaoUser.id.toString(),
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })).toString('base64')

    console.log('Login successful, creating session')
    
    const response = NextResponse.redirect(new URL('/dashboard', request.url))
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })
    
    return response
  } catch (error) {
    console.error('=== Kakao Login Error ===')
    console.error('Error:', error)
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
  }
}
