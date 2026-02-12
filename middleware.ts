import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
const protectedRoutes = ['/dashboard', '/exercises', '/progress', '/pain', '/settings']
const publicRoutes = ['/login', '/api/auth']
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (publicRoutes.some(route => pathname.startsWith(route))) return NextResponse.next()
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  if (isProtectedRoute) {
    const userId = request.cookies.get('user_id')
    if (!userId) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }
  return NextResponse.next()
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
