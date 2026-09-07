import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/db/client'
import { recordLoginAttempt } from '@/lib/auth/rate-limit'
import { COOKIE_NAME, cookieOptions, signSession } from '@/lib/auth/session'
import { env, isProd } from '@/lib/env'

const bodySchema = z.object({ passcode: z.string().min(1).max(200) })

// Compare digests so the comparison is constant-time regardless of length.
function passcodeMatches(candidate: string): boolean {
  const a = createHash('sha256').update(candidate).digest()
  const b = createHash('sha256').update(env.APP_PASSCODE).digest()
  return timingSafeEqual(a, b)
}

export async function POST(req: Request): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter your passcode' }, { status: 400 })

  const ok = passcodeMatches(parsed.data.passcode)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const attempt = await recordLoginAttempt(await getDb(), { success: ok, ip })
  if (!attempt.allowed) {
    return NextResponse.json({ error: `Too many attempts, try again in ${attempt.retryAfterMin} min` }, { status: 429 })
  }
  if (!ok) return NextResponse.json({ error: 'Wrong passcode' }, { status: 401 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, await signSession(env.SESSION_SECRET), cookieOptions(isProd()))
  return res
}
