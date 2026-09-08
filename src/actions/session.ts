'use server'

import { and, asc, eq, isNotNull, isNull, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db/client'
import { loadProgram } from '@/db/queries/home'
import { getSessionView, loadExerciseCfg, loadExerciseHistory, loadGym, loadTemplateEntries, type SessionView } from '@/db/queries/session'
import { buildSummary, type SessionSummary } from '@/db/queries/summary'
import { bodyMetric, program, session, sessionExercise, setLog, template, templateExercise } from '@/db/schema'
import { getGoal } from '@/lib/domain/goal'
import { postponeAt } from '@/lib/domain/lineup'
import { advanceLoop, sessionAdvances } from '@/lib/domain/loop'
import { getPhase, nextWeekPhaseName } from '@/lib/domain/phase'
import { todayIST } from '@/lib/domain/time'
import type { Goal } from '@/lib/domain/types'
import { AppError } from '@/lib/errors'
import { recomputeExercise } from '@/db/recompute'

const uuid = z.string().uuid()

// ---------- Start ----------

const startSchema = z.object({ id: uuid, templateId: uuid, advancesLoop: z.boolean().default(true) })

/**
 * Idempotent Start (spec §11.1): one transaction inserts the session plus one session_exercise per
 * template entry with its goal snapshot. Re-submitting the same client id returns the same session.
 */
export async function startSession(input: { id: string; templateId: string; advancesLoop?: boolean }): Promise<{ sessionId: string }> {
  const parsed = startSchema.safeParse(input)
  if (!parsed.success) throw new AppError('VALIDATION', 'Invalid start request')
  const { id, templateId, advancesLoop } = parsed.data
  const db = await getDb()
  const today = todayIST()

  const sessionId = await db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: session.id }).from(session).where(eq(session.id, id)).limit(1)
    if (existing) return existing.id

    const [live] = await tx
      .select({ id: session.id })
      .from(session)
      .where(and(isNull(session.finishedAt), isNull(session.deletedAt), eq(session.source, 'logged'), ne(session.id, id)))
      .limit(1)
    if (live) throw new AppError('SESSION_IN_PROGRESS', 'A session is already in progress — resume or discard it first', 409)

    const [tpl] = await tx.select().from(template).where(eq(template.id, templateId)).limit(1)
    if (!tpl) throw new AppError('NOT_FOUND', 'Template not found', 404)
    const prog = await loadProgram(tx)
    const phase = getPhase(today, prog)
    const gym = await loadGym(tx)
    const entries = await loadTemplateEntries(tx, templateId)

    await tx.insert(session).values({ id, date: today, startedAt: new Date(), templateId, type: 'normal', source: 'logged', advancedLoop: advancesLoop })
    for (const e of entries) {
      const history = await loadExerciseHistory(tx, e.exercise.id)
      const goal = getGoal({ exercise: e.exercise, entry: { sets: e.sets, lo: e.lo, hi: e.hi }, history, phase, gym })
      await tx.insert(sessionExercise).values({
        sessionId: id,
        exerciseId: e.exercise.id,
        templateExerciseId: e.templateExerciseId,
        orderIndex: e.orderIndex,
        sets: goal.sets,
        lo: e.lo,
        hi: e.hi,
        goal,
      })
    }
    return id
  })
  revalidatePath('/')
  return { sessionId }
}

// ---------- Read ----------

export async function loadSessionView(sessionId: string): Promise<SessionView | null> {
  const db = await getDb()
  const prog = await loadProgram(db)
  const [s] = await db.select({ date: session.date }).from(session).where(eq(session.id, sessionId)).limit(1)
  if (!s) return null
  return getSessionView(db, sessionId, nextWeekPhaseName(s.date, prog))
}

// ---------- Swap / note ----------

const swapSchema = z.object({ sessionExerciseId: uuid, exerciseId: uuid })

/** Keeps the entry's sets/lo/hi; recomputes the goal for the new exercise; soft-deletes logged sets. */
export async function swapExercise(input: { sessionExerciseId: string; exerciseId: string }): Promise<{ goal: Goal }> {
  const parsed = swapSchema.safeParse(input)
  if (!parsed.success) throw new AppError('VALIDATION', 'Invalid swap request')
  const db = await getDb()
  const goal = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ se: sessionExercise, s: session, te: templateExercise })
      .from(sessionExercise)
      .innerJoin(session, eq(session.id, sessionExercise.sessionId))
      .leftJoin(templateExercise, eq(templateExercise.id, sessionExercise.templateExerciseId))
      .where(eq(sessionExercise.id, parsed.data.sessionExerciseId))
      .limit(1)
    if (!row || row.s.deletedAt) throw new AppError('NOT_FOUND', 'Exercise not found', 404)
    if (row.s.finishedAt) throw new AppError('SESSION_FINISHED', 'This session is finished', 409)
    const originId = row.se.swappedFromExerciseId ?? row.se.exerciseId
    const origin = await loadExerciseCfg(tx, originId)
    if (!origin) throw new AppError('NOT_FOUND', 'Exercise not found', 404)
    const allowed = new Set([...origin.swapIds, originId])
    if (!allowed.has(parsed.data.exerciseId) || parsed.data.exerciseId === row.se.exerciseId) throw new AppError('VALIDATION', 'Not a valid swap for this slot')
    const target = await loadExerciseCfg(tx, parsed.data.exerciseId)
    if (!target) throw new AppError('NOT_FOUND', 'Exercise not found', 404)

    const prog = await loadProgram(tx)
    const phase = getPhase(row.s.date, prog)
    const gym = await loadGym(tx)
    const entry = { sets: row.te?.sets ?? row.se.sets, lo: row.te?.lo ?? row.se.lo ?? 8, hi: row.te?.hi ?? row.se.hi ?? 12 }
    const history = await loadExerciseHistory(tx, target.id, { excludeSessionId: row.s.id })
    const goal = getGoal({ exercise: target, entry, history, phase, gym })
    await tx
      .update(sessionExercise)
      .set({
        exerciseId: target.id,
        swappedFromExerciseId: target.id === originId ? null : originId,
        sets: goal.sets,
        goal,
        verdict: null,
        nextNote: null,
      })
      .where(eq(sessionExercise.id, row.se.id))
    // Logged sets belong to the old exercise: soft-delete with a rev bump so a stale replay cannot revive them.
    const existing = await tx.select({ id: setLog.id, rev: setLog.rev }).from(setLog).where(and(eq(setLog.sessionExerciseId, row.se.id), isNull(setLog.deletedAt)))
    for (const s of existing) await tx.update(setLog).set({ deletedAt: new Date(), rev: s.rev + 1, updatedAt: new Date() }).where(eq(setLog.id, s.id))
    return goal
  })
  revalidatePath('/session/[id]', 'page')
  return { goal }
}

const postponeSchema = z.object({ sessionExerciseId: uuid })

/**
 * Postpone (spec §6.3 v1.2, "machine busy"): the exercise trades order_index with the next one so
 * it comes back right after it (1·2·3·4·5 → 1·2·4·3·5). Logged sets stay with the row; only the
 * order changes. Returns the session's new lineup (session_exercise ids in order).
 */
export async function postponeExercise(input: { sessionExerciseId: string }): Promise<{ order: string[] }> {
  const parsed = postponeSchema.safeParse(input)
  if (!parsed.success) throw new AppError('VALIDATION', 'Invalid postpone request')
  const db = await getDb()
  const order = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ se: sessionExercise, s: session })
      .from(sessionExercise)
      .innerJoin(session, eq(session.id, sessionExercise.sessionId))
      .where(eq(sessionExercise.id, parsed.data.sessionExerciseId))
      .limit(1)
    if (!row || row.s.deletedAt) throw new AppError('NOT_FOUND', 'Exercise not found', 404)
    if (row.s.finishedAt) throw new AppError('SESSION_FINISHED', 'This session is finished', 409)
    const rows = await tx.select({ id: sessionExercise.id, orderIndex: sessionExercise.orderIndex }).from(sessionExercise).where(eq(sessionExercise.sessionId, row.s.id)).orderBy(asc(sessionExercise.orderIndex))
    const i = rows.findIndex((r) => r.id === row.se.id)
    if (i === -1 || i === rows.length - 1) throw new AppError('VALIDATION', 'This is the last exercise — nothing to postpone it behind')
    const next = rows[i + 1]
    // (session_id, order_index) is unique: park the current row on a free index before the swap.
    await tx.update(sessionExercise).set({ orderIndex: -1 }).where(eq(sessionExercise.id, row.se.id))
    await tx.update(sessionExercise).set({ orderIndex: row.se.orderIndex }).where(eq(sessionExercise.id, next.id))
    await tx.update(sessionExercise).set({ orderIndex: next.orderIndex }).where(eq(sessionExercise.id, row.se.id))
    return postponeAt(rows, i).map((r) => r.id)
  })
  revalidatePath('/session/[id]', 'page')
  return { order }
}

const noteSchema = z.object({ sessionExerciseId: uuid, note: z.string().max(500) })

export async function setExerciseNote(input: { sessionExerciseId: string; note: string }): Promise<void> {
  const parsed = noteSchema.safeParse(input)
  if (!parsed.success) throw new AppError('VALIDATION', 'Note too long (max 500 characters)')
  const db = await getDb()
  await db.update(sessionExercise).set({ note: parsed.data.note.trim() || null }).where(eq(sessionExercise.id, parsed.data.sessionExerciseId))
}

// ---------- Finish ----------

const finishSchema = z.object({
  sessionId: uuid,
  type: z.enum(['normal', 'short']),
  sleepGood: z.boolean().nullable(),
  shoulderPain: z.number().int().min(0).max(10).nullable(),
  elbowPain: z.number().int().min(0).max(10).nullable(),
  note: z.string().max(1000).nullable(),
})

/** One transaction; re-submittable (a finished session returns its summary without writing). */
export async function finishSession(input: z.input<typeof finishSchema>): Promise<SessionSummary> {
  const parsed = finishSchema.safeParse(input)
  if (!parsed.success) throw new AppError('VALIDATION', 'Invalid check-in')
  const data = parsed.data
  const db = await getDb()
  const summary = await db.transaction(async (tx) => {
    const [row] = await tx
      .select({ s: session, tpl: template })
      .from(session)
      .leftJoin(template, eq(template.id, session.templateId))
      .where(and(eq(session.id, data.sessionId), isNull(session.deletedAt)))
      .limit(1)
    if (!row) throw new AppError('NOT_FOUND', 'Session not found', 404)
    const prog = await loadProgram(tx)

    if (!row.s.finishedAt) {
      const now = new Date()
      const durationMin = Math.max(0, Math.round((now.getTime() - row.s.startedAt.getTime()) / 60000))
      await tx
        .update(session)
        .set({ finishedAt: now, durationMin, type: data.type, sleepGood: data.sleepGood, shoulderPain: data.shoulderPain, elbowPain: data.elbowPain, note: data.note?.trim() || null })
        .where(eq(session.id, row.s.id))
      if (sessionAdvances(data.type, row.s.advancedLoop) && row.tpl) {
        await tx.update(program).set({ nextIndex: advanceLoop(prog.templates.length, row.tpl.orderIndex) }).where(eq(program.id, prog.id))
      }
      if (data.sleepGood !== null) {
        await tx.insert(bodyMetric).values({ date: row.s.date, sleepGood: data.sleepGood }).onConflictDoUpdate({ target: bodyMetric.date, set: { sleepGood: data.sleepGood } })
      }
      // Make sure every exercise has its verdict stored (a fast finisher may beat the queue by a tick).
      const exIds = await tx.select({ id: sessionExercise.id }).from(sessionExercise).where(eq(sessionExercise.sessionId, row.s.id))
      for (const e of exIds) await recomputeExercise(tx, e.id)
    }
    const summary = await buildSummary(tx, row.s.id)
    if (!summary) throw new AppError('NOT_FOUND', 'Session not found', 404)
    return summary
  })
  revalidatePath('/')
  revalidatePath('/history')
  return summary
}

// ---------- Discard ----------

export async function discardSession(input: { sessionId: string }): Promise<void> {
  const id = uuid.parse(input.sessionId)
  const db = await getDb()
  await db.update(session).set({ deletedAt: new Date() }).where(and(eq(session.id, id), isNull(session.finishedAt)))
  revalidatePath('/')
}

export async function undoDiscard(input: { sessionId: string }): Promise<void> {
  const id = uuid.parse(input.sessionId)
  const db = await getDb()
  const [other] = await db
    .select({ id: session.id })
    .from(session)
    .where(and(isNull(session.finishedAt), isNull(session.deletedAt), eq(session.source, 'logged'), ne(session.id, id)))
    .limit(1)
  if (other) throw new AppError('SESSION_IN_PROGRESS', 'Another session is in progress', 409)
  await db.update(session).set({ deletedAt: null }).where(and(eq(session.id, id), isNotNull(session.deletedAt)))
  revalidatePath('/')
}

/** Names of the exercises in a template, for the Home card. */
export async function templateExerciseNames(templateId: string): Promise<string[]> {
  const db = await getDb()
  const rows = await loadTemplateEntries(db, templateId)
  return rows.map((r) => r.exercise.name)
}


// ---------- Walk day ----------

const walkSchema = z.object({ minutes: z.number().int().min(1).max(600), note: z.string().max(500).nullable() })

/** A cardio-only session for today: logged and finished at once, never advances the loop (§2.3.4). */
export async function logWalk(input: { minutes: number; note: string | null }): Promise<{ sessionId: string }> {
  const parsed = walkSchema.safeParse(input)
  if (!parsed.success) throw new AppError('VALIDATION', 'Minutes must be between 1 and 600')
  const db = await getDb()
  const now = new Date()
  const [row] = await db
    .insert(session)
    .values({
      date: todayIST(),
      startedAt: new Date(now.getTime() - parsed.data.minutes * 60000),
      finishedAt: now,
      type: 'walk',
      source: 'logged',
      durationMin: parsed.data.minutes,
      advancedLoop: false,
      note: parsed.data.note?.trim() || null,
    })
    .returning({ id: session.id })
  revalidatePath('/')
  revalidatePath('/history')
  return { sessionId: row.id }
}

// ---------- Delete (History) ----------

/** Soft-deletes any live session (finished or not); undo restores it (spec §6.5, §11.4). */
export async function deleteSession(input: { sessionId: string }): Promise<void> {
  const id = uuid.parse(input.sessionId)
  const db = await getDb()
  await db.update(session).set({ deletedAt: new Date() }).where(and(eq(session.id, id), isNull(session.deletedAt)))
  revalidatePath('/')
  revalidatePath('/history')
}

export async function undoDeleteSession(input: { sessionId: string }): Promise<void> {
  const id = uuid.parse(input.sessionId)
  const db = await getDb()
  const [target] = await db.select({ finishedAt: session.finishedAt }).from(session).where(eq(session.id, id)).limit(1)
  if (!target) throw new AppError('NOT_FOUND', 'Session not found', 404)
  if (!target.finishedAt) return undoDiscard({ sessionId: id })
  await db.update(session).set({ deletedAt: null }).where(eq(session.id, id))
  revalidatePath('/')
  revalidatePath('/history')
}
