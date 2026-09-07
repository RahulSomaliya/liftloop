import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { recordLoginAttempt } from '@/lib/auth/rate-limit'
import { createDb, type Db } from '../client'
import { runMigrations } from '../migrate'

let db: Db
let close: () => Promise<void>

beforeAll(async () => {
  const c = await createDb('pglite:memory')
  db = c.db
  close = c.close
  await runMigrations(db, 'pglite')
})
afterAll(async () => close())

describe('login rate limit (§10.2)', () => {
  it('allows 5 failures then blocks; successes do not count', async () => {
    for (let i = 0; i < 5; i += 1) expect((await recordLoginAttempt(db, { success: false, ip: null })).allowed).toBe(true)
    const blocked = await recordLoginAttempt(db, { success: false, ip: '1.2.3.4' })
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterMin).toBeGreaterThanOrEqual(1)
    expect(blocked.retryAfterMin).toBeLessThanOrEqual(15)
    // a correct passcode is also blocked while the window is hot
    expect((await recordLoginAttempt(db, { success: true, ip: null })).allowed).toBe(false)
    await db.execute(sql`delete from login_attempt`)
    for (let i = 0; i < 3; i += 1) await recordLoginAttempt(db, { success: true, ip: null })
    for (let i = 0; i < 5; i += 1) expect((await recordLoginAttempt(db, { success: false, ip: null })).allowed).toBe(true)
    expect((await recordLoginAttempt(db, { success: false, ip: null })).allowed).toBe(false)
  })
  it('never lets more than 5 failures through concurrently', async () => {
    await db.execute(sql`delete from login_attempt`)
    const results = await Promise.all(Array.from({ length: 20 }, () => recordLoginAttempt(db, { success: false, ip: null })))
    expect(results.filter((r) => r.allowed)).toHaveLength(5)
    const [{ n }] = ((await db.execute(sql`select count(*)::int as n from login_attempt`)) as unknown as { rows: { n: number }[] }).rows
    expect(Number(n)).toBe(5)
  })
})
