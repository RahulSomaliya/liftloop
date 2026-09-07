import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb, type Db } from '../client'
import { runMigrations } from '../migrate'
import { exercise, gymConfig, program, template, templateExercise } from '../schema'
import { seedProgram } from '../seed'

let db: Db
let close: () => Promise<void>

beforeAll(async () => {
  const c = await createDb('pglite:memory')
  db = c.db
  close = c.close
  await runMigrations(db, 'pglite')
  await seedProgram(db)
  await seedProgram(db) // idempotent
})
afterAll(async () => close())

describe('seedProgram (§10.3, §13)', () => {
  it('seeds the library, templates, gym config and program exactly once', async () => {
    expect((await db.select().from(exercise)).length).toBe(30)
    expect((await db.select().from(template)).length).toBe(6)
    expect((await db.select().from(templateExercise)).length).toBe(33)
    const progs = await db.select().from(program)
    expect(progs).toHaveLength(1)
    expect(progs[0]).toMatchObject({ version: 2, startDate: '2026-09-07', nextIndex: 0, easyWeekOverrides: [] })
    const [gym] = await db.select().from(gymConfig)
    expect(gym.dumbbellRackLb).toEqual([2.5, 5, 7, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40, 45, 50, 60])
    expect(gym.stackStepKg).toBe(5)
  })
  it('never resets the loop pointer or overrides on re-seed', async () => {
    const [p] = await db.select().from(program)
    await db.update(program).set({ nextIndex: 3, easyWeekOverrides: [{ from: '2026-09-30', to: '2026-10-02' }] }).where(eq(program.id, p.id))
    await seedProgram(db)
    const [after] = await db.select().from(program)
    expect(after.nextIndex).toBe(3)
    expect(after.easyWeekOverrides).toEqual([{ from: '2026-09-30', to: '2026-10-02' }])
  })
  it('never overwrites a row edited in-app, and seeds editor defaults', async () => {
    const [row] = await db.select().from(exercise).where(eq(exercise.name, 'Cable Face Pull'))
    expect(row).toMatchObject({ defaultLo: 15, defaultHi: 20, defaultSets: 2 })
    const [assisted] = await db.select().from(exercise).where(eq(exercise.name, 'Assisted Pull-Up Machine'))
    expect(assisted).toMatchObject({ defaultLo: 6, defaultHi: 10, defaultSets: 3 }) // copied from Pull-Ups
    await db.update(exercise).set({ restSeconds: 75, editedAt: new Date() }).where(eq(exercise.id, row.id))
    await seedProgram(db)
    const [after] = await db.select().from(exercise).where(eq(exercise.id, row.id))
    expect(after.restSeconds).toBe(75)
    expect((await db.select().from(exercise)).length).toBe(30)
    // clear the edit so the seed is authoritative again for the tests below
    await db.update(exercise).set({ editedAt: null }).where(eq(exercise.id, row.id))
    await seedProgram(db)
    expect((await db.select().from(exercise).where(eq(exercise.id, row.id)))[0].restSeconds).toBe(90)
  })
  it('exercise details match §13', async () => {
    const byName = new Map((await db.select().from(exercise)).map((e) => [e.name, e]))
    expect(byName.get('Cable Reverse Fly')?.aliases).toEqual(['Reverse pec deck'])
    expect(byName.get('Assisted Pull-Up Machine')).toMatchObject({ progression: 'assist_down', unit: 'kg', increment: 5 })
    expect(byName.get('Barbell RDL')).toMatchObject({ loadType: 'per_side', unit: 'lb', increment: 2.5, barWeight: 45 })
    expect(byName.get('Leg Press')).toMatchObject({ loadType: 'per_side', increment: 10 })
    expect(byName.get('Incline DB Curl')).toMatchObject({ loadType: 'dumbbell', increment: null })
    expect(byName.get('Half-Kneeling Landmine Press')).toMatchObject({ loadType: 'stack', unit: 'lb', unilateral: 'arm' })
    expect(byName.get('Single-Leg Leg Press')?.unilateral).toBe('leg')
    expect(byName.get('Standing BW Calf Raise')).toMatchObject({ loadType: 'bodyweight', unit: 'lb', aliases: ['Standing bw Calf Raise'] })
    const pu = byName.get('Pull-Ups (overhand, shoulder-width)')
    expect(pu?.swapIds).toEqual([byName.get('Assisted Pull-Up Machine')?.id, byName.get('Lat Pulldown (Front, Medium Grip)')?.id])
    expect(pu?.cue).toContain('Shoulder blades down first')
    expect([...byName.values()].every((e) => e.restSeconds === 90)).toBe(true)
  })
  it('templates: order, rest override, superset groups', async () => {
    const ts = await db.select().from(template).orderBy(asc(template.orderIndex))
    expect(ts.map((t) => t.name)).toEqual(['Push A', 'Pull A', 'Legs A', 'Push B', 'Pull B', 'Legs B'])
    expect(ts.map((t) => t.kind)).toEqual(['push', 'pull', 'legs', 'push', 'pull', 'legs'])
    const legsA = await db.select().from(templateExercise).where(eq(templateExercise.templateId, ts[2].id)).orderBy(asc(templateExercise.orderIndex))
    expect(legsA[0].restSeconds).toBe(120)
    expect(legsA[1].restSeconds).toBeNull()
    const pushA = await db.select().from(templateExercise).where(eq(templateExercise.templateId, ts[0].id)).orderBy(asc(templateExercise.orderIndex))
    expect(pushA).toHaveLength(6)
    expect(pushA[4].supersetGroup).toBe(1)
    expect(pushA[5].supersetGroup).toBe(1)
    expect(pushA[3].supersetGroup).toBeNull()
    expect(pushA[0]).toMatchObject({ sets: 3, lo: 8, hi: 12 })
    const pullB = await db.select().from(templateExercise).where(eq(templateExercise.templateId, ts[4].id)).orderBy(asc(templateExercise.orderIndex))
    expect(pullB[2]).toMatchObject({ sets: 2, lo: 15, hi: 20 })
  })
})
