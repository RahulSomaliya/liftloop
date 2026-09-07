import { eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))

import { upsertBodyMetric } from '@/actions/body'
import { endEasyWeek, startEasyWeek } from '@/actions/program'
import { logWalk } from '@/actions/session'
import { getPhase } from '@/lib/domain/phase'
import { addDaysIST, todayIST, weekBoundsIST } from '@/lib/domain/time'
import { getDb, type Db } from '../client'
import { runMigrations } from '../migrate'
import { loadBodyPage } from '../queries/body'
import { loadProgram } from '../queries/home'
import { bodyMetric, session } from '../schema'
import { seedProgram } from '../seed'

let db: Db
const today = todayIST()

beforeAll(async () => {
  db = await getDb()
  await runMigrations(db, 'pglite')
  await seedProgram(db)
})

describe('walk day (§2.3.4)', () => {
  it('creates a finished walk session that never advances the loop', async () => {
    const before = (await loadProgram(db)).nextIndex
    const { sessionId } = await logWalk({ minutes: 22, note: 'easy pace' })
    const [s] = await db.select().from(session).where(eq(session.id, sessionId))
    expect(s).toMatchObject({ type: 'walk', durationMin: 22, advancedLoop: false, note: 'easy pace', date: today })
    expect(s.finishedAt).not.toBeNull()
    expect((await loadProgram(db)).nextIndex).toBe(before)
    await expect(logWalk({ minutes: 0, note: null })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})

describe('manual easy week (§2.2)', () => {
  it('starts today until Sunday, is idempotent, and ends yesterday', async () => {
    const r = await startEasyWeek()
    expect(r).toEqual({ from: today, to: weekBoundsIST(today).weekEnd })
    expect(await startEasyWeek()).toEqual(r)
    let prog = await loadProgram(db)
    expect(prog.easyWeekOverrides).toHaveLength(1)
    expect(getPhase(today, prog)).toMatchObject({ name: 'Easy', source: 'manual', loadMultiplier: 0.8 })
    await endEasyWeek()
    prog = await loadProgram(db)
    expect(prog.easyWeekOverrides).toHaveLength(0) // started today → removed
    expect(getPhase(today, prog).source).toBe('schedule')
  })
})

describe('body metrics (§6.6)', () => {
  it('partial upserts merge fields and feed the body page', async () => {
    await upsertBodyMetric({ date: today, weightKg: 73.64 })
    await upsertBodyMetric({ date: today, sleepGood: true, cardioType: 'Walk', cardioMin: 22 })
    await upsertBodyMetric({ date: addDaysIST(today, -1), weightKg: 73.2 })
    const [row] = await db.select().from(bodyMetric).where(eq(bodyMetric.date, today))
    expect(row).toMatchObject({ weightKg: 73.6, sleepGood: true, cardioType: 'Walk', cardioMin: 22 })
    await upsertBodyMetric({ date: today, cardioType: null, cardioMin: null })
    const [after] = await db.select().from(bodyMetric).where(eq(bodyMetric.date, today))
    expect(after).toMatchObject({ weightKg: 73.6, cardioType: null, cardioMin: null })
    const page = await loadBodyPage(db, today)
    expect(page.today?.weightKg).toBe(73.6)
    expect(page.avg7Today).toBe(73.4)
    expect(page.series.map((p) => p.avg7)).toEqual([73.2, 73.4])
    await expect(upsertBodyMetric({ date: addDaysIST(today, 1), weightKg: 70 })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})
