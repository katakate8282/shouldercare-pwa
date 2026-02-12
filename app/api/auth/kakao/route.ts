import { NextResponse } from 'next/server'

export async function GET() {
  const kakaoClientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID
  const redirectUri = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI || 'https://shouldercare-pwa.vercel.app/api/auth/kakao/callback'

  if (!kakaoClientId) {
    return NextResponse.json(
      { error: 'Kakao OAuth 설정이 누락되었습니다.' },
      { status: 500 }
    )
  }

  console.log('Kakao OAuth - Client ID:', kakaoClientId)
  console.log('Kakao OAuth - Redirect URI:', redirectUri)

  // 카카오 OAuth 인증 URL
  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${kakaoClientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code`

  return NextResponse.redirect(kakaoAuthUrl)
}
