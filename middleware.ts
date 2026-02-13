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
    // 기존 쿠키 확인
    const legacyCookie = request.cookies.get('user_id')
    const sessionCookie = request.cookies.get('session')

    if (legacyCookie || sessionCookie) {
      // 쿠키가 있으면 통과
      return NextResponse.next()
    }

    // 쿠키 없으면 클라이언트에서 localStorage 체크 (AuthProvider에서 처리)
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|firebase-messaging-sw.js).*)'],
}
