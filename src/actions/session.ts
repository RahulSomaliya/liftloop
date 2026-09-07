'use server'

import { and, eq, isNotNull, isNull, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb, type Tx } from '@/db/client'
import { loadProgram } from '@/db/queries/home'
import { getSessionView, loadExerciseCfg, loadExerciseHistory, loadGym, loadTemplateEntries, type SessionView } from '@/db/queries/session'
import { bodyMetric, program, session, sessionExercise, setLog, template, templateExercise } from '@/db/schema'
import { getGoal } from '@/lib/domain/goal'
import { formatLoad } from '@/lib/domain/load-format'
import { advanceLoop, sessionAdvances } from '@/lib/domain/loop'
import { getPhase, weekPhase } from '@/lib/domain/phase'
import { serializeHeader, serializeSessionLine, type ParsedSegment } from '@/lib/domain/shorthand'
import { programWeek, todayIST } from '@/lib/domain/time'
import type { Goal, LoggedSet } from '@/lib/domain/types'
import { collapsedLine } from '@/lib/domain/verdict'
import { AppError } from '@/lib/errors'
import { recomputeExercise } from '@/db/recompute'

const uuid = z.string().uuid()

export async function nextWeekPhaseFor(date: string, prog: { startDate: string; nextIndex: number; easyWeekOverrides: { from: string; to: string }[] }) {
  return weekPhase(programWeek(date, prog.startDate) + 1, prog).name
}

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
  return getSessionView(db, sessionId, await nextWeekPhaseFor(s.date, prog))
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

export interface SessionSummary {
  sessionId: string
  templateName: string | null
  durationMin: number
  setCount: number
  beatCount: number
  prs: string[]
  exercises: { name: string; collapsed: string | null }[]
  shorthand: string
  nextTemplateName: string
}

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
    return buildSummary(tx, row.s.id)
  })
  revalidatePath('/')
  revalidatePath('/history')
  return summary
}

async function buildSummary(tx: Tx, sessionId: string): Promise<SessionSummary> {
  const prog = await loadProgram(tx)
  const view = await getSessionView(tx, sessionId, await nextWeekPhaseFor(todayIST(), prog))
  if (!view) throw new AppError('NOT_FOUND', 'Session not found', 404)
  const blocks: string[] = []
  const prs: string[] = []
  let setCount = 0
  let beatCount = 0
  const exercises = view.exercises.map((e) => {
    const live = e.setLogs
    setCount += live.length
    if (e.verdict === 'beat') beatCount += 1
    for (const s of live) if (s.isPr && s.reps !== null) prs.push(`${e.exercise.name} ${formatLoad(e.exercise, s.load)} × ${s.reps}`)
    if (live.length > 0) {
      const segs = toSegments(live)
      blocks.push(`${serializeHeader({ name: e.exercise.name, lo: e.lo, hi: e.hi, sets: e.sets, marker: e.exercise.unilateral })}\n${serializeSessionLine(segs)}`)
    }
    const logged: LoggedSet[] = live.map((s) => ({ setIndex: s.setIndex, load: s.load, reps: s.reps, toFailure: s.toFailure }))
    const collapsed = e.verdict && e.nextNote ? collapsedLine(e.exercise, logged, { verdict: e.verdict, nextNote: e.nextNote }) : null
    return { name: e.exercise.name, collapsed }
  })
  const [s] = await tx.select({ durationMin: session.durationMin }).from(session).where(eq(session.id, sessionId)).limit(1)
  return {
    sessionId,
    templateName: view.templateName,
    durationMin: s?.durationMin ?? 0,
    setCount,
    beatCount,
    prs,
    exercises,
    shorthand: blocks.join('\n\n'),
    nextTemplateName: prog.templates[prog.nextIndex]?.name ?? '—',
  }
}

function toSegments(sets: { setIndex: number; load: number | null; reps: number | null; toFailure: boolean }[]): ParsedSegment[] {
  const segs: ParsedSegment[] = []
  for (const s of [...sets].sort((a, b) => a.setIndex - b.setIndex)) {
    const load = s.load ?? 0
    const last = segs[segs.length - 1]
    const set = { reps: s.reps, toFailure: s.toFailure || s.reps === null }
    if (last && last.load === load) last.sets.push(set)
    else segs.push({ load, sets: [set] })
  }
  return segs
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

