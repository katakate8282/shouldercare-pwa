import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const kakaoClientId = process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID
    const redirectUri = process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI

    if (!kakaoClientId || !redirectUri) {
      return NextResponse.json({ error: 'Kakao OAuth 설정이 누락되었습니다.' }, { status: 500 })
    }

    // URL 파라미터에서 state (병원코드 정보) 가져오기
    const state = request.nextUrl.searchParams.get('state') || ''

    let kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${kakaoClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&prompt=login`

    if (state) {
      kakaoAuthUrl += `&state=${encodeURIComponent(state)}`
    }

    return NextResponse.redirect(kakaoAuthUrl)
  } catch (error) {
    return NextResponse.json({ error: '카카오 로그인 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
