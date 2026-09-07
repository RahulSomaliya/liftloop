// Auth proxy (Next 16's name for middleware; spec §10.2). Everything except the sign-in surfaces and
// static assets needs a valid ll_session cookie. Runs on the Node runtime.
import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_NAME, verifySession } from '@/lib/auth/session'

const PUBLIC_PREFIXES = ['/login', '/api/login', '/manifest.webmanifest', '/icons/', '/sw.js', '/_next/', '/favicon.ico']

export async function proxy(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next()
  const secret = process.env.SESSION_SECRET
  const ok = secret ? await verifySession(req.cookies.get(COOKIE_NAME)?.value, secret) : false
  if (ok) return NextResponse.next()
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
