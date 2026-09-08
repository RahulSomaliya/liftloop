import { asc, eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))

import { deleteSession, discardSession, finishSession, loadSessionView, postponeExercise, startSession, swapExercise, undoDeleteSession, undoDiscard } from '@/actions/session'
import { deleteSet, logSet, logSetsFromShorthand, restoreSet } from '@/actions/sets'
import { getDb } from '../client'
import { runMigrations } from '../migrate'
import { loadProgram } from '../queries/home'
import { bodyMetric, program, session, sessionExercise, setLog, template } from '../schema'
import { seedProgram } from '../seed'
import type { Db } from '../client'
import type { Goal } from '@/lib/domain/types'

let db: Db
let pushA: string
let pullA: string
const S1 = '11111111-1111-4111-8111-111111111111'
const S2 = '22222222-2222-4222-8222-222222222222'
const S3 = '33333333-3333-4333-8333-333333333333'

beforeAll(async () => {
  db = await getDb()
  await runMigrations(db, 'pglite')
  await seedProgram(db)
  const ts = await db.select().from(template).orderBy(asc(template.orderIndex))
  pushA = ts[0].id
  pullA = ts[1].id
})

describe('startSession (§11.1)', () => {
  it('is idempotent and snapshots a first_time goal per entry (Ramp → 2 sets)', async () => {
    await startSession({ id: S1, templateId: pushA })
    await startSession({ id: S1, templateId: pushA })
    const rows = await db.select().from(sessionExercise).where(eq(sessionExercise.sessionId, S1)).orderBy(asc(sessionExercise.orderIndex))
    expect(rows).toHaveLength(6)
    expect(rows.every((r) => (r.goal as Goal).mode === 'first_time')).toBe(true)
    const phaseSets = (rows[0].goal as Goal).sets
    expect(rows[0].sets).toBe(phaseSets)
    expect(rows[0]).toMatchObject({ lo: 8, hi: 12 })
    expect((await db.select().from(session)).length).toBe(1)
  })
  it('refuses a second live session', async () => {
    await expect(startSession({ id: S2, templateId: pullA })).rejects.toMatchObject({ code: 'SESSION_IN_PROGRESS' })
  })
  it('loadSessionView exposes goals, rest and swap options', async () => {
    const view = await loadSessionView(S1)
    expect(view?.templateName).toBe('Push A')
    expect(view?.exercises[0].restSeconds).toBe(120)
    expect(view?.exercises[1].restSeconds).toBe(90)
    expect(view?.exercises[0].swapOptions.map((o) => o.name)).toEqual(['Pec Fly Machine'])
    expect(view?.exercises[4].supersetGroup).toBe(1)
    expect(view?.exercises[5].supersetGroup).toBe(1)
  })
})

describe('logSet rev guard (§11.2)', () => {
  it('applies rev 1, rejects a replay and a stale rev, accepts rev 2', async () => {
    const [se] = await db.select().from(sessionExercise).where(eq(sessionExercise.sessionId, S1)).orderBy(asc(sessionExercise.orderIndex))
    const base = { sessionExerciseId: se.id, setIndex: 0, unit: 'kg' as const, toFailure: false }
    const r1 = await logSet({ ...base, rev: 1, load: 25, reps: 12 })
    expect(r1.applied).toBe(true)
    const replay = await logSet({ ...base, rev: 1, load: 25, reps: 10 })
    expect(replay).toMatchObject({ applied: false, row: { rev: 1, reps: 12 } })
    const r2 = await logSet({ ...base, rev: 2, load: 25, reps: 11 })
    expect(r2).toMatchObject({ applied: true, row: { rev: 2, reps: 11 } })
    const stale = await logSet({ ...base, rev: 1, load: 25, reps: 9 })
    expect(stale.applied).toBe(false)
    expect(r2.exerciseDone).toBeNull() // second set not logged yet
    const done = await logSet({ ...base, setIndex: 1, rev: 1, load: 25, reps: 12 })
    expect(done.exerciseDone).toMatchObject({ verdict: 'done' })
    expect(done.exerciseDone?.collapsed).toBe('25 kg × 11·12 — done · 2 sets again next week')
  })
  it('delete/restore honour rev and clear/restore the verdict', async () => {
    const [se] = await db.select().from(sessionExercise).where(eq(sessionExercise.sessionId, S1)).orderBy(asc(sessionExercise.orderIndex))
    const del = await deleteSet({ sessionExerciseId: se.id, setIndex: 1, rev: 2 })
    expect(del.applied).toBe(true)
    expect(del.exerciseDone).toBeNull()
    expect((await deleteSet({ sessionExerciseId: se.id, setIndex: 1, rev: 2 })).applied).toBe(false)
    const res = await restoreSet({ sessionExerciseId: se.id, setIndex: 1, rev: 3 })
    expect(res.applied).toBe(true)
    expect(res.exerciseDone?.verdict).toBe('done')
  })
  it('type it instead replaces the slot', async () => {
    const [, se2] = await db.select().from(sessionExercise).where(eq(sessionExercise.sessionId, S1)).orderBy(asc(sessionExercise.orderIndex))
    const out = await logSetsFromShorthand({ sessionExerciseId: se2.id, line: '10.10.10' })
    expect(out.errors).toEqual([])
    expect(out.rows.map((r) => [r.setIndex, r.load, r.reps])).toEqual([[0, 10, 10], [1, 10, 10]])
    expect(out.exerciseDone?.verdict).toBe('done')
    const bad = await logSetsFromShorthand({ sessionExerciseId: se2.id, line: '10.x' })
    expect(bad.errors).toHaveLength(1)
  })
})

describe('swapExercise (§6.3)', () => {
  it('keeps the entry range, recomputes the goal, soft-deletes logged sets, allows swapping back', async () => {
    const rows = await db.select().from(sessionExercise).where(eq(sessionExercise.sessionId, S1)).orderBy(asc(sessionExercise.orderIndex))
    const view = await loadSessionView(S1)
    const pecFly = view!.exercises[0].swapOptions[0]
    const { goal } = await swapExercise({ sessionExerciseId: rows[0].id, exerciseId: pecFly.id })
    expect(goal).toMatchObject({ mode: 'first_time', lo: 8, hi: 12 })
    const [after] = await db.select().from(sessionExercise).where(eq(sessionExercise.id, rows[0].id))
    expect(after.exerciseId).toBe(pecFly.id)
    expect(after.swappedFromExerciseId).toBe(rows[0].exerciseId)
    const live = await db.select().from(setLog).where(eq(setLog.sessionExerciseId, rows[0].id))
    expect(live.every((s) => s.deletedAt !== null)).toBe(true)
    await expect(swapExercise({ sessionExerciseId: rows[0].id, exerciseId: pecFly.id })).rejects.toMatchObject({ code: 'VALIDATION' })
    await swapExercise({ sessionExerciseId: rows[0].id, exerciseId: rows[0].exerciseId })
    const [back] = await db.select().from(sessionExercise).where(eq(sessionExercise.id, rows[0].id))
    expect(back.swappedFromExerciseId).toBeNull()
  })
})

describe('finishSession (§11.1, §2.1)', () => {
  it('finishes once, advances the loop, writes sleep, and is re-submittable', async () => {
    const before = await loadProgram(db)
    expect(before.nextIndex).toBe(0)
    const summary = await finishSession({ sessionId: S1, type: 'normal', sleepGood: true, shoulderPain: 1, elbowPain: 0, note: 'ok' })
    expect(summary.nextTemplateName).toBe('Pull A')
    expect(summary.setCount).toBe(2)
    const [s] = await db.select().from(session).where(eq(session.id, S1))
    expect(s.finishedAt).not.toBeNull()
    expect(s.durationMin).toBeGreaterThanOrEqual(0)
    expect((await loadProgram(db)).nextIndex).toBe(1)
    const [bm] = await db.select().from(bodyMetric).where(eq(bodyMetric.date, s.date))
    expect(bm.sleepGood).toBe(true)
    const again = await finishSession({ sessionId: S1, type: 'normal', sleepGood: true, shoulderPain: 1, elbowPain: 0, note: 'ok' })
    expect(again.nextTemplateName).toBe('Pull A')
    expect((await loadProgram(db)).nextIndex).toBe(1)
  })
  it('a non-advancing start leaves the pointer; history now feeds the next goal', async () => {
    await startSession({ id: S2, templateId: pushA, advancesLoop: false })
    const rows = await db.select().from(sessionExercise).where(eq(sessionExercise.sessionId, S2)).orderBy(asc(sessionExercise.orderIndex))
    // Landmine press was logged 10.10.10 in S1 → Ramp easy goal at 10 lb
    expect((rows[1].goal as Goal)).toMatchObject({ mode: 'easy', load: 10 })
    expect((rows[1].goal as Goal).line).toBe('Easy day — 10 lb × 10 · 10, stop with 4 left')
    await finishSession({ sessionId: S2, type: 'short', sleepGood: null, shoulderPain: 0, elbowPain: 0, note: null })
    expect((await loadProgram(db)).nextIndex).toBe(1)
  })
  it('discard and undo', async () => {
    await startSession({ id: S3, templateId: pullA })
    await discardSession({ sessionId: S3 })
    expect((await db.select().from(session).where(eq(session.id, S3)))[0].deletedAt).not.toBeNull()
    await undoDiscard({ sessionId: S3 })
    expect((await db.select().from(session).where(eq(session.id, S3)))[0].deletedAt).toBeNull()
    await discardSession({ sessionId: S3 })
  })
  it('PRs: a heavier set in a later session is flagged', async () => {
    const S4 = '44444444-4444-4444-8444-444444444444'
    await startSession({ id: S4, templateId: pushA })
    const [se] = await db.select().from(sessionExercise).where(eq(sessionExercise.sessionId, S4)).orderBy(asc(sessionExercise.orderIndex))
    // No baseline yet for Machine Chest Press (S1's sets were soft-deleted by the swap test) → not a PR
    const r0 = await logSet({ sessionExerciseId: se.id, setIndex: 0, rev: 1, load: 25, reps: 10, toFailure: false, unit: 'kg' })
    expect(r0.row.isPr).toBe(false)
    // Earlier set index in the same slot is a baseline → heavier set is a PR
    const r = await logSet({ sessionExerciseId: se.id, setIndex: 1, rev: 1, load: 30, reps: 10, toFailure: false, unit: 'kg' })
    expect(r.row.isPr).toBe(true)
    const r2 = await logSet({ sessionExerciseId: se.id, setIndex: 2, rev: 1, load: 25, reps: 8, toFailure: false, unit: 'kg' })
    expect(r2.row.isPr).toBe(false)
    await discardSession({ sessionId: S4 })
    expect((await db.select().from(program))[0].nextIndex).toBe(1)
  })
})

describe('postponeExercise (§6.3 v1.2)', () => {
  const S5 = '55555555-5555-4555-8555-555555555555'
  it('moves the exercise one place later and can be postponed again; the last one cannot', async () => {
    await startSession({ id: S5, templateId: pushA, advancesLoop: false })
    const before = (await loadSessionView(S5))!.exercises.map((e) => e.id)
    expect(before).toHaveLength(6)
    const r = await postponeExercise({ sessionExerciseId: before[2] })
    expect(r.order).toEqual([before[0], before[1], before[3], before[2], before[4], before[5]])
    const after = (await loadSessionView(S5))!.exercises
    expect(after.map((e) => e.id)).toEqual(r.order)
    expect(after.map((e) => e.orderIndex)).toEqual([0, 1, 2, 3, 4, 5])
    const again = await postponeExercise({ sessionExerciseId: before[2] })
    expect(again.order).toEqual([before[0], before[1], before[3], before[4], before[2], before[5]])
    await expect(postponeExercise({ sessionExerciseId: before[5] })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
  it('refuses once the session is finished', async () => {
    const ids = (await loadSessionView(S5))!.exercises.map((e) => e.id)
    await finishSession({ sessionId: S5, type: 'short', sleepGood: null, shoulderPain: 0, elbowPain: 0, note: null })
    await expect(postponeExercise({ sessionExerciseId: ids[0] })).rejects.toMatchObject({ code: 'SESSION_FINISHED' })
  })
})

describe('deleteSession hands the loop pointer back (v1.2)', () => {
  const S6 = '66666666-6666-4666-8666-666666666666'
  it('deleting the latest advancing session rewinds next_index; undo re-advances it', async () => {
    const before = await loadProgram(db)
    const tpl = before.templates[before.nextIndex]
    const advanced = (before.nextIndex + 1) % before.templates.length
    await startSession({ id: S6, templateId: tpl.id })
    await finishSession({ sessionId: S6, type: 'normal', sleepGood: null, shoulderPain: 0, elbowPain: 0, note: null })
    expect((await loadProgram(db)).nextIndex).toBe(advanced)
    await deleteSession({ sessionId: S6 })
    expect((await loadProgram(db)).nextIndex).toBe(before.nextIndex)
    await undoDeleteSession({ sessionId: S6 })
    expect((await loadProgram(db)).nextIndex).toBe(advanced)
    // deleting an OLDER advancing session leaves the pointer where the latest one put it
    await deleteSession({ sessionId: S1 })
    expect((await loadProgram(db)).nextIndex).toBe(advanced)
  })
})
