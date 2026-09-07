// Global login rate limit (spec §10.2): 5 failed attempts per 15 minutes, counted in the DB because
// serverless instances share no memory. The count → check → insert runs under a transaction-level
// advisory lock so concurrent requests cannot all slip past the count. Single user: locking the
// owner out during an attack is acceptable.
import { sql } from 'drizzle-orm'
import type { Db } from '@/db/client'

export const LOGIN_LOCK_KEY = 7719301
export const MAX_FAILURES = 5
export const WINDOW_MINUTES = 15

export interface AttemptResult {
  allowed: boolean
  retryAfterMin: number
}

function rowsOf(res: unknown): Record<string, unknown>[] {
  if (Array.isArray(res)) return res as Record<string, unknown>[]
  const r = res as { rows?: Record<string, unknown>[] }
  return r.rows ?? []
}

/**
 * Records one login attempt. Returns `allowed: false` (and records nothing) when the window already
 * holds MAX_FAILURES failures. Call it with the timing-safe compare result as `success`.
 */
export async function recordLoginAttempt(db: Db, attempt: { success: boolean; ip: string | null }): Promise<AttemptResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${LOGIN_LOCK_KEY})`)
    const countRes = await tx.execute(
      sql`select count(*)::int as n, min(attempted_at) as oldest from login_attempt
          where success = false and attempted_at > now() - (${WINDOW_MINUTES} || ' minutes')::interval`,
    )
    const row = rowsOf(countRes)[0] ?? {}
    const n = Number(row.n ?? 0)
    if (n >= MAX_FAILURES) {
      const oldest = row.oldest ? new Date(String(row.oldest)) : new Date()
      const elapsedMin = (Date.now() - oldest.getTime()) / 60000
      return { allowed: false, retryAfterMin: Math.max(1, Math.ceil(WINDOW_MINUTES - elapsedMin)) }
    }
    await tx.execute(sql`insert into login_attempt (attempted_at, success, ip) values (now(), ${attempt.success}, ${attempt.ip})`)
    return { allowed: true, retryAfterMin: 0 }
  })
}
