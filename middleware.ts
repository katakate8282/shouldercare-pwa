import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const protectedRoutes = ['/dashboard', '/exercises', '/progress', '/pain', '/settings', '/my-stats', '/messages', '/trainer', '/admin', '/onboarding']
const publicRoutes = ['/login', '/api/auth']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 공개 라우트는 통과
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))

  if (isProtectedRoute) {
    // 1. Supabase Auth 토큰 확인 (sb-*-auth-token 쿠키)
    const supabaseAuthCookie = request.cookies.getAll().find(c => c.name.includes('auth-token'))
    
    // 2. 기존 쿠키 확인 (마이그레이션 기간용)
    const legacyCookie = request.cookies.get('user_id')

    if (!supabaseAuthCookie && !legacyCookie) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|firebase-messaging-sw.js).*)'],
}
