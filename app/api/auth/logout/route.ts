import { NextResponse } from 'next/server'

export async function POST() {
  // Supabase Auth 세션은 클라이언트에서 signOut() 호출로 처리
  // 서버에서는 기존 쿠키만 정리 (하위 호환)
  const response = NextResponse.json({ success: true })

  // 기존 쿠키 정리 (마이그레이션 기간용)
  response.cookies.set('session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  response.cookies.set('user_id', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  return response
}
