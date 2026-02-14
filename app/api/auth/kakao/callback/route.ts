import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function generateToken(userId: string, email: string): string {
  const payload = {
    userId,
    email,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    iat: Date.now(),
  }
  const secret = process.env.JWT_SECRET as string
  const data = JSON.stringify(payload)
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex')
  return Buffer.from(JSON.stringify({ data: payload, sig: signature })).toString('base64url')
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state') // 병원코드 정보가 여기에 담김

    if (!code) return NextResponse.redirect(new URL('/login?error=no_code', request.url))

    const kakaoClientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID
    const kakaoClientSecret = process.env.KAKAO_CLIENT_SECRET
    const redirectUri = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!kakaoClientId || !redirectUri || !supabaseUrl || !supabaseServiceKey) {
      return NextResponse.redirect(new URL('/login?error=config_error', request.url))
    }

    // state에서 병원코드 정보 파싱
    let hospitalInfo: { hospitalId: string; phoneDigits: string } | null = null
    if (state) {
      try {
        hospitalInfo = JSON.parse(decodeURIComponent(state))
      } catch {}
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
      .select('id, onboarding_completed, subscription_type')
      .eq('email', email)
      .single()

    let userId: string
    let onboardingDone = false
    let hospitalCode: string | null = null

    if (existingUser) {
      userId = existingUser.id
      onboardingDone = existingUser.onboarding_completed === true

      const updateData: Record<string, any> = {
        name,
        updated_at: new Date().toISOString(),
      }

      if (hospitalInfo && (!existingUser.subscription_type || existingUser.subscription_type === 'FREE')) {
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 84) // 12주 = 84일
        hospitalCode = `${hospitalInfo.hospitalId}-${hospitalInfo.phoneDigits}`
        updateData.subscription_type = 'PLATINUM_PATIENT'
        updateData.subscription_expires_at = expiresAt.toISOString()
        updateData.hospital_id = hospitalInfo.hospitalId
        updateData.hospital_code = hospitalCode
      }

      await supabase
        .from('users')
        .update(updateData)
        .eq('id', existingUser.id)
    } else {
      // 신규 유저 생성
      const insertData: Record<string, any> = {
        email,
        name,
        onboarding_completed: false,
        subscription_type: 'FREE',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      if (hospitalInfo) {
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + 84)
        hospitalCode = `${hospitalInfo.hospitalId}-${hospitalInfo.phoneDigits}`
        insertData.subscription_type = 'PLATINUM_PATIENT'
        insertData.subscription_expires_at = expiresAt.toISOString()
        insertData.hospital_id = hospitalInfo.hospitalId
        insertData.hospital_code = hospitalCode
      }

      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert(insertData)
        .select('id')
        .single()

      if (insertError || !newUser) {
        console.error('Database error:', insertError)
        return NextResponse.redirect(new URL('/login?error=database_error', request.url))
      }

      userId = newUser.id
      onboardingDone = false
    }

    // hospital_patients 테이블에 user_id 연결
    if (hospitalCode && userId) {
      const { data: hospitalPatient } = await supabase
        .from('hospital_patients')
        .select('id')
        .eq('hospital_code', hospitalCode)
        .is('user_id', null)
        .single()

      if (hospitalPatient) {
        // hospital_patients에 user_id 연결
        await supabase
          .from('hospital_patients')
          .update({ user_id: userId })
          .eq('id', hospitalPatient.id)

        // users에 active_hospital_patient_id 설정
        await supabase
          .from('users')
          .update({ active_hospital_patient_id: hospitalPatient.id })
          .eq('id', userId)
      }
    }

    // 토큰 생성
    const token = generateToken(userId, email)
    const redirectPath = onboardingDone ? '/dashboard' : '/onboarding'

    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('token', token)
    loginUrl.searchParams.set('redirect', redirectPath)

    const response = NextResponse.redirect(loginUrl)

    response.cookies.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })

    response.cookies.set('user_id', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })

    return response
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.redirect(new URL('/login?error=unexpected_error', request.url))
  }
}
