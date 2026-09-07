// Post-write recomputation shared by every set write (spec §7.5, §7.6). Not a server action module:
// these take a transaction and must never be callable from the client.
import { and, asc, eq, isNull } from 'drizzle-orm'
import type { Tx } from '@/db/client'
import { loadProgram } from '@/db/queries/home'
import { loadGym, loadWeekBodyWeight, rowToExerciseCfg } from '@/db/queries/session'
import { exercise, session, sessionExercise, setLog } from '@/db/schema'
import { weekPhase } from '@/lib/domain/phase'
import { isPrSet } from '@/lib/domain/prs'
import { programWeek } from '@/lib/domain/time'
import type { Goal, LoggedSet, Verdict } from '@/lib/domain/types'
import { collapsedLine, getVerdict } from '@/lib/domain/verdict'

export interface ExerciseDone {
  verdict: Verdict
  nextNote: string
  collapsed: string
}

/**
 * Recomputes is_pr for every live counted set of an exercise in chronological order (spec §7.6):
 * a set is a PR against every earlier set (earlier sessions, or earlier set indices in the same slot).
 */
export async function recomputePrs(tx: Tx, exerciseId: string): Promise<void> {
  const [ex] = await tx.select().from(exercise).where(eq(exercise.id, exerciseId)).limit(1)
  if (!ex) return
  const cfg = rowToExerciseCfg(ex)
  const rows = await tx
    .select({ id: setLog.id, setIndex: setLog.setIndex, load: setLog.load, reps: setLog.reps, isPr: setLog.isPr, date: session.date, startedAt: session.startedAt, seCreated: sessionExercise.createdAt, seId: sessionExercise.id })
    .from(setLog)
    .innerJoin(sessionExercise, eq(sessionExercise.id, setLog.sessionExerciseId))
    .innerJoin(session, eq(session.id, sessionExercise.sessionId))
    .where(and(eq(sessionExercise.exerciseId, exerciseId), isNull(setLog.deletedAt), isNull(session.deletedAt)))
    .orderBy(asc(session.date), asc(session.startedAt), asc(sessionExercise.createdAt), asc(setLog.setIndex))
  const prior: { load: number | null; reps: number | null }[] = []
  const bwCache = new Map<string, number | null>()
  let lastSlot: string | null = null
  let slotSets: { load: number | null; reps: number | null }[] = []
  for (const r of rows) {
    if (r.seId !== lastSlot) {
      prior.push(...slotSets)
      slotSets = []
      lastSlot = r.seId
    }
    let bw: number | null = null
    if (cfg.loadType === 'bodyweight') {
      if (!bwCache.has(r.date)) bwCache.set(r.date, await loadWeekBodyWeight(tx, r.date))
      bw = bwCache.get(r.date) ?? null
    }
    const isPr = r.reps === null ? false : isPrSet({ load: r.load, reps: r.reps }, [...prior, ...slotSets], cfg, bw)
    if (isPr !== r.isPr) await tx.update(setLog).set({ isPr }).where(eq(setLog.id, r.id))
    slotSets.push({ load: r.load, reps: r.reps })
  }
}

/** Stores the verdict when every goal set index is logged; clears it otherwise (spec §7.5). */
export async function recomputeExercise(tx: Tx, sessionExerciseId: string): Promise<ExerciseDone | null> {
  const [row] = await tx
    .select({ se: sessionExercise, s: session, ex: exercise })
    .from(sessionExercise)
    .innerJoin(session, eq(session.id, sessionExercise.sessionId))
    .innerJoin(exercise, eq(exercise.id, sessionExercise.exerciseId))
    .where(eq(sessionExercise.id, sessionExerciseId))
    .limit(1)
  if (!row) return null
  const goal = row.se.goal as Goal | null
  if (!goal) return null
  const sets = await tx.select().from(setLog).where(and(eq(setLog.sessionExerciseId, sessionExerciseId), isNull(setLog.deletedAt))).orderBy(asc(setLog.setIndex))
  const logged: LoggedSet[] = sets.map((s) => ({ setIndex: s.setIndex, load: s.load, reps: s.reps, toFailure: s.toFailure }))
  const haveAll = Array.from({ length: goal.sets }, (_, i) => i).every((i) => logged.some((l) => l.setIndex === i))
  if (!haveAll) {
    if (row.se.verdict !== null) await tx.update(sessionExercise).set({ verdict: null, nextNote: null }).where(eq(sessionExercise.id, sessionExerciseId))
    return null
  }
  const prog = await loadProgram(tx)
  const gym = await loadGym(tx)
  const cfg = rowToExerciseCfg(row.ex)
  const nextWeekPhase = weekPhase(programWeek(row.s.date, prog.startDate) + 1, prog).name
  const v = getVerdict({ goal, loggedSets: logged, exercise: cfg, gym, nextWeekPhase })
  await tx.update(sessionExercise).set({ verdict: v.verdict, nextNote: v.nextNote }).where(eq(sessionExercise.id, sessionExerciseId))
  return { verdict: v.verdict, nextNote: v.nextNote, collapsed: collapsedLine(cfg, logged, v) }
}
