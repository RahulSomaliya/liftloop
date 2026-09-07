import { asc, eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))

import { finishSession, logWalk, startSession } from '@/actions/session'
import { logSet } from '@/actions/sets'
import { todayIST, weekBoundsIST } from '@/lib/domain/time'
import { getDb, type Db } from '../client'
import { runMigrations } from '../migrate'
import { adherence, exerciseSeries, weeklyMuscleSets } from '../queries/progress'
import { sessionExercise, template } from '../schema'
import { seedProgram } from '../seed'

let db: Db
const today = todayIST()
const S1 = '66666666-6666-4666-8666-666666666666'

beforeAll(async () => {
  db = await getDb()
  await runMigrations(db, 'pglite')
  await seedProgram(db)
  const [pushA] = await db.select().from(template).orderBy(asc(template.orderIndex))
  await startSession({ id: S1, templateId: pushA.id })
  const rows = await db.select().from(sessionExercise).where(eq(sessionExercise.sessionId, S1)).orderBy(asc(sessionExercise.orderIndex))
  await logSet({ sessionExerciseId: rows[0].id, setIndex: 0, rev: 1, load: 25, reps: 12, toFailure: false, unit: 'kg' })
  await logSet({ sessionExerciseId: rows[0].id, setIndex: 1, rev: 1, load: 25, reps: 10, toFailure: false, unit: 'kg' })
  await finishSession({ sessionId: S1, type: 'normal', sleepGood: true, shoulderPain: 0, elbowPain: 0, note: null })
  await logWalk({ minutes: 20, note: null })
})

describe('progress queries (§5.2)', () => {
  it('exerciseSeries: best load, e1RM and volume per session', async () => {
    const [se] = await db.select().from(sessionExercise).where(eq(sessionExercise.sessionId, S1)).orderBy(asc(sessionExercise.orderIndex))
    const pts = await exerciseSeries(db, se.exerciseId)
    expect(pts).toHaveLength(1)
    expect(pts[0]).toMatchObject({ date: today, bestLoad: 25, volume: 25 * 12 + 25 * 10, label: 'Push A', verdict: 'done' })
    expect(pts[0].e1rm).toBe(35) // 25 × (1 + 12/30)
  })
  it('weeklyMuscleSets: this week counts the chest press sets', async () => {
    const r = await weeklyMuscleSets(db, today, 4)
    const cur = r.weeks[r.weeks.length - 1]
    expect(cur.totals.chest).toBe(2)
    expect(cur.totals.triceps).toBe(1)
    expect(cur.weekStart).toBe(weekBoundsIST(today).weekStart)
  })
  it('adherence: today is a push day, walks do not count toward the target', async () => {
    const a = await adherence(db, today, 4)
    expect(a.days).toHaveLength(28)
    const d = a.days.find((x) => x.date === today)
    expect(d).toMatchObject({ kind: 'push', finished: true })
    const w = a.weekTargets[a.weekTargets.length - 1]
    expect(w).toMatchObject({ weekStart: weekBoundsIST(today).weekStart, done: 1 })
  })
})
