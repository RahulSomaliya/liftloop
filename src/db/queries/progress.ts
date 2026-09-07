import { and, asc, eq, gte, inArray, isNotNull, isNull, lte } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { bodyMetric, exercise, session, sessionExercise, setLog, template } from '@/db/schema'
import { weekPhase } from '@/lib/domain/phase'
import { e1rm } from '@/lib/domain/prs'
import { addDaysIST, programWeek, weekBoundsIST } from '@/lib/domain/time'
import type { MuscleGroup, PhaseName, Verdict } from '@/lib/domain/types'
import { MUSCLE_TARGETS, weeklySets } from '@/lib/domain/weekly-sets'
import { loadProgram } from './home'
import { rowToExerciseCfg } from './session'

export interface ExercisePoint {
  date: string
  sessionId: string
  label: string
  /** Best (working) load of the session: highest for load_up, lowest for assist_down. */
  bestLoad: number
  e1rm: number | null
  /** Σ load × reps over counted sets (per_side counts both sides). */
  volume: number
  verdict: Verdict | null
}

/** Per-session points for an exercise's chart (spec §5.2), oldest first, live finished sessions. */
export async function exerciseSeries(db: Db, exerciseId: string): Promise<ExercisePoint[]> {
  const [ex] = await db.select().from(exercise).where(eq(exercise.id, exerciseId)).limit(1)
  if (!ex) return []
  const cfg = rowToExerciseCfg(ex)
  const rows = await db
    .select({ seId: sessionExercise.id, verdict: sessionExercise.verdict, sessionId: session.id, date: session.date, source: session.source, type: session.type, templateName: template.name })
    .from(sessionExercise)
    .innerJoin(session, eq(session.id, sessionExercise.sessionId))
    .leftJoin(template, eq(template.id, session.templateId))
    .where(and(eq(sessionExercise.exerciseId, exerciseId), isNull(session.deletedAt), isNotNull(session.finishedAt)))
    .orderBy(asc(session.date), asc(session.startedAt))
  if (rows.length === 0) return []
  const sets = await db.select().from(setLog).where(and(inArray(setLog.sessionExerciseId, rows.map((r) => r.seId)), isNull(setLog.deletedAt)))
  const weights = cfg.loadType === 'bodyweight' ? await db.select({ date: bodyMetric.date, weightKg: bodyMetric.weightKg }).from(bodyMetric).where(isNotNull(bodyMetric.weightKg)) : []
  const bodyWeightFor = (date: string): number | null => {
    const { weekStart, weekEnd } = weekBoundsIST(date)
    const inWeek = weights.filter((w) => w.date >= weekStart && w.date <= weekEnd).sort((a, b) => b.date.localeCompare(a.date))
    return inWeek[0]?.weightKg ?? null
  }
  const points: ExercisePoint[] = []
  for (const r of rows) {
    const mine = sets.filter((s) => s.sessionExerciseId === r.seId && s.load !== null)
    if (mine.length === 0) continue
    const loads = mine.map((s) => s.load as number)
    const bestLoad = cfg.progression === 'assist_down' ? Math.min(...loads) : Math.max(...loads)
    const bw = bodyWeightFor(r.date)
    let best1rm: number | null = null
    let volume = 0
    for (const s of mine) {
      if (s.reps === null) continue
      const total = cfg.loadType === 'per_side' ? (cfg.barWeight ?? 0) + 2 * (s.load as number) : (s.load as number)
      volume += Math.max(0, total) * s.reps
      if (cfg.progression === 'load_up') {
        const v = e1rm(cfg, s.load as number, s.reps, bw)
        if (v !== null && (best1rm === null || v > best1rm)) best1rm = v
      }
    }
    points.push({ date: r.date, sessionId: r.sessionId, label: r.source === 'imported' ? 'imported' : (r.templateName ?? 'session') + (r.type === 'short' ? ' (short)' : ''), bestLoad, e1rm: best1rm === null ? null : Math.round(best1rm * 10) / 10, volume: Math.round(volume), verdict: r.verdict })
  }
  return points
}

export interface WeekSets {
  week: number
  label: string
  weekStart: string
  weekEnd: string
  phase: PhaseName
  totals: Record<MuscleGroup, number>
}

/** Weekly hard sets per muscle for the last `weeks` program weeks, oldest first (spec §7.7). */
export async function weeklyMuscleSets(db: Db, today: string, weeks = 8): Promise<{ weeks: WeekSets[]; targets: typeof MUSCLE_TARGETS }> {
  const prog = await loadProgram(db)
  const current = programWeek(today, prog.startDate)
  const first = Math.max(1, current - weeks + 1)
  const from = weekPhase(first, prog).weekStart
  const to = weekPhase(current, prog).weekEnd
  const rows = await db
    .select({ date: session.date, seId: sessionExercise.id, ex: exercise })
    .from(sessionExercise)
    .innerJoin(session, eq(session.id, sessionExercise.sessionId))
    .innerJoin(exercise, eq(exercise.id, sessionExercise.exerciseId))
    .where(and(isNull(session.deletedAt), isNotNull(session.finishedAt), eq(session.source, 'logged'), gte(session.date, from), lte(session.date, to)))
  const seIds = rows.map((r) => r.seId)
  const counts = new Map<string, number>()
  if (seIds.length) {
    const sets = await db.select({ seId: setLog.sessionExerciseId }).from(setLog).where(and(inArray(setLog.sessionExerciseId, seIds), isNull(setLog.deletedAt)))
    for (const s of sets) counts.set(s.seId, (counts.get(s.seId) ?? 0) + 1)
  }
  const out: WeekSets[] = []
  for (let w = first; w <= current; w += 1) {
    const wp = weekPhase(w, prog)
    const inWeek = rows.filter((r) => r.date >= wp.weekStart && r.date <= wp.weekEnd)
    const totals = weeklySets(inWeek.map((r) => ({ exercise: rowToExerciseCfg(r.ex), setCount: counts.get(r.seId) ?? 0 })))
    out.push({ week: w, label: `W${w}`, weekStart: wp.weekStart, weekEnd: wp.weekEnd, phase: wp.name, totals })
  }
  return { weeks: out, targets: MUSCLE_TARGETS }
}

export interface AdherenceDay {
  date: string
  kind: 'push' | 'pull' | 'legs' | 'walk' | 'imported' | null
  finished: boolean
}

/** Day grid for the adherence heatmap: the last `weeks` Mon–Sun weeks ending with today's week. */
export async function adherence(db: Db, today: string, weeks = 12): Promise<{ days: AdherenceDay[]; weekTargets: { weekStart: string; target: number; done: number }[] }> {
  const prog = await loadProgram(db)
  const { weekStart: thisMonday } = weekBoundsIST(today)
  const from = addDaysIST(thisMonday, -7 * (weeks - 1))
  const to = addDaysIST(thisMonday, 6)
  const rows = await db
    .select({ date: session.date, type: session.type, source: session.source, finishedAt: session.finishedAt, kind: template.kind })
    .from(session)
    .leftJoin(template, eq(template.id, session.templateId))
    .where(and(isNull(session.deletedAt), gte(session.date, from), lte(session.date, to)))
    .orderBy(asc(session.date))
  const byDate = new Map<string, AdherenceDay>()
  for (const r of rows) {
    const kind: AdherenceDay['kind'] = r.type === 'walk' ? 'walk' : r.source === 'imported' ? 'imported' : (r.kind ?? 'imported')
    const prev = byDate.get(r.date)
    // A lifting session outranks a walk on the same day.
    if (!prev || (prev.kind === 'walk' && kind !== 'walk')) byDate.set(r.date, { date: r.date, kind, finished: r.finishedAt !== null })
  }
  const days: AdherenceDay[] = []
  for (let i = 0; i < weeks * 7; i += 1) {
    const date = addDaysIST(from, i)
    days.push(byDate.get(date) ?? { date, kind: null, finished: false })
  }
  const weekTargets = Array.from({ length: weeks }, (_, i) => {
    const weekStart = addDaysIST(from, i * 7)
    const wp = weekPhase(programWeek(weekStart, prog.startDate), prog)
    const done = days.filter((d) => d.date >= weekStart && d.date <= addDaysIST(weekStart, 6) && d.finished && d.kind !== null && d.kind !== 'walk' && d.kind !== 'imported').length
    return { weekStart, target: weekStart < prog.startDate ? 0 : wp.targetDays, done }
  })
  return { days, weekTargets }
}
