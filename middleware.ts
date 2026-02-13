import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const protectedRoutes = ['/dashboard', '/exercises', '/progress', '/pain', '/settings', '/my-stats', '/messages', '/trainer', '/admin', '/onboarding']
const publicRoutes = ['/login', '/api/auth']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 공개 라우트는 통과
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute) {
    // 기존 쿠키 확인 (하위 호환)
    const legacyCookie = request.cookies.get('user_id')
    const sessionCookie = request.cookies.get('session')

    // 미들웨어에서는 localStorage 접근 불가 → 쿠키만 체크
    // localStorage 토큰은 클라이언트에서 AuthProvider가 체크
    // 쿠키가 없으면 클라이언트로 넘겨서 AuthProvider가 처리하도록 함
    if (!legacyCookie && !sessionCookie) {
      // 클라이언트 사이드 체크를 위해 일단 통과 (AuthProvider에서 리다이렉트)
      return NextResponse.next()
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|firebase-messaging-sw.js).*)'],
}
