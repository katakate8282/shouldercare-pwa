import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const kakaoClientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID
  
  // 현재 요청의 호스트를 기반으로 Redirect URI 생성
  const host = request.headers.get('host')
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https'
  const redirectUri = `${protocol}://${host}/api/auth/kakao/callback`

  if (!kakaoClientId) {
    return NextResponse.json(
      { error: 'Kakao OAuth 설정이 누락되었습니다.' },
      { status: 500 }
    )
  }

  // 카카오 OAuth 인증 URL
  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${kakaoClientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code`

  return NextResponse.redirect(kakaoAuthUrl)
}
