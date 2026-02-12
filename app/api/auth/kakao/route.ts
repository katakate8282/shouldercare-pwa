import { NextResponse } from 'next/server'
export async function GET() {
  try {
    const kakaoClientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID
    const redirectUri = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI
    if (!kakaoClientId) {
      return NextResponse.json({ error: 'Kakao OAuth 설정이 누락되었습니다.' }, { status: 500 })
    }
    if (!redirectUri) {
      return NextResponse.json({ error: 'Redirect URI가 설정되지 않았습니다.' }, { status: 500 })
    }
    const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${kakaoClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&prompt=login`
    return NextResponse.redirect(kakaoAuthUrl)
  } catch (error) {
    return NextResponse.json({ error: '카카오 로그인 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
