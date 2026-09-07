import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { exercise, session, sessionExercise, setLog, template } from '@/db/schema'
import { serializeHeader, serializeSessionLine, type ParsedSegment } from '@/lib/domain/shorthand'
import type { ExerciseCfg, Goal, LoggedSet, SessionSource, SessionType, TemplateKind, Verdict } from '@/lib/domain/types'
import { collapsedLine } from '@/lib/domain/verdict'
import { rowToExerciseCfg } from './session'

export interface SessionListItem {
  id: string
  date: string
  startedAt: string
  finished: boolean
  templateName: string | null
  kind: TemplateKind | 'walk' | 'imported'
  type: SessionType
  source: SessionSource
  durationMin: number | null
  setCount: number
  prCount: number
  shoulderPain: number | null
  exerciseCount: number
}

export async function listSessions(db: Db, limit = 60): Promise<SessionListItem[]> {
  const rows = await db
    .select({ s: session, templateName: template.name, kind: template.kind })
    .from(session)
    .leftJoin(template, eq(template.id, session.templateId))
    .where(isNull(session.deletedAt))
    .orderBy(desc(session.date), desc(session.startedAt))
    .limit(limit)
  if (rows.length === 0) return []
  const ids = rows.map((r) => r.s.id)
  const counts = await db
    .select({
      sessionId: sessionExercise.sessionId,
      sets: sql<number>`count(${setLog.id})::int`,
      prs: sql<number>`coalesce(sum(case when ${setLog.isPr} then 1 else 0 end), 0)::int`,
    })
    .from(sessionExercise)
    .leftJoin(setLog, and(eq(setLog.sessionExerciseId, sessionExercise.id), isNull(setLog.deletedAt)))
    .where(inArray(sessionExercise.sessionId, ids))
    .groupBy(sessionExercise.sessionId)
  const exCounts = await db
    .select({ sessionId: sessionExercise.sessionId, n: sql<number>`count(*)::int` })
    .from(sessionExercise)
    .where(inArray(sessionExercise.sessionId, ids))
    .groupBy(sessionExercise.sessionId)
  const countOf = new Map(counts.map((c) => [c.sessionId, c]))
  const exOf = new Map(exCounts.map((c) => [c.sessionId, Number(c.n)]))
  return rows.map(({ s, templateName, kind }) => ({
    id: s.id,
    date: s.date,
    startedAt: s.startedAt.toISOString(),
    finished: s.finishedAt !== null,
    templateName,
    kind: s.type === 'walk' ? 'walk' : s.source === 'imported' ? 'imported' : (kind ?? 'imported'),
    type: s.type,
    source: s.source,
    durationMin: s.durationMin,
    setCount: Number(countOf.get(s.id)?.sets ?? 0),
    prCount: Number(countOf.get(s.id)?.prs ?? 0),
    shoulderPain: s.shoulderPain,
    exerciseCount: exOf.get(s.id) ?? 0,
  }))
}

export interface SessionDetailSet extends LoggedSet {
  rev: number
  isPr: boolean
  unit: 'lb' | 'kg'
}

export interface SessionDetailExercise {
  id: string
  orderIndex: number
  exercise: ExerciseCfg
  swappedFromName: string | null
  sets: number
  lo: number | null
  hi: number | null
  goal: Goal | null
  verdict: Verdict | null
  nextNote: string | null
  collapsed: string | null
  note: string | null
  setLogs: SessionDetailSet[]
}

export interface SessionDetail {
  id: string
  date: string
  startedAt: string
  finishedAt: string | null
  templateName: string | null
  kind: TemplateKind | 'walk' | 'imported'
  type: SessionType
  source: SessionSource
  durationMin: number | null
  sleepGood: boolean | null
  shoulderPain: number | null
  elbowPain: number | null
  advancedLoop: boolean
  note: string | null
  exercises: SessionDetailExercise[]
  shorthand: string
}

function segmentsOf(sets: LoggedSet[]): ParsedSegment[] {
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

export async function getSessionDetail(db: Db, id: string): Promise<SessionDetail | null> {
  const [row] = await db
    .select({ s: session, templateName: template.name, kind: template.kind })
    .from(session)
    .leftJoin(template, eq(template.id, session.templateId))
    .where(and(eq(session.id, id), isNull(session.deletedAt)))
    .limit(1)
  if (!row) return null
  const exRows = await db
    .select({ se: sessionExercise, ex: exercise })
    .from(sessionExercise)
    .innerJoin(exercise, eq(exercise.id, sessionExercise.exerciseId))
    .where(eq(sessionExercise.sessionId, id))
    .orderBy(asc(sessionExercise.orderIndex))
  const seIds = exRows.map((r) => r.se.id)
  const sets = seIds.length ? await db.select().from(setLog).where(and(inArray(setLog.sessionExerciseId, seIds), isNull(setLog.deletedAt))).orderBy(asc(setLog.setIndex)) : []
  const swappedIds = exRows.map((r) => r.se.swappedFromExerciseId).filter((x): x is string => !!x)
  const swappedNames = swappedIds.length ? await db.select({ id: exercise.id, name: exercise.name }).from(exercise).where(inArray(exercise.id, swappedIds)) : []
  const nameOf = new Map(swappedNames.map((n) => [n.id, n.name]))

  const exercises: SessionDetailExercise[] = exRows.map(({ se, ex }) => {
    const cfg = rowToExerciseCfg(ex)
    const logs = sets.filter((x) => x.sessionExerciseId === se.id).map((x) => ({ setIndex: x.setIndex, load: x.load, reps: x.reps, toFailure: x.toFailure, rev: x.rev, isPr: x.isPr, unit: x.unit }))
    const logged: LoggedSet[] = logs.map((l) => ({ setIndex: l.setIndex, load: l.load, reps: l.reps, toFailure: l.toFailure }))
    return {
      id: se.id,
      orderIndex: se.orderIndex,
      exercise: cfg,
      swappedFromName: se.swappedFromExerciseId ? (nameOf.get(se.swappedFromExerciseId) ?? null) : null,
      sets: se.sets,
      lo: se.lo,
      hi: se.hi,
      goal: (se.goal as Goal | null) ?? null,
      verdict: se.verdict,
      nextNote: se.nextNote,
      collapsed: se.verdict && se.nextNote ? collapsedLine(cfg, logged, { verdict: se.verdict, nextNote: se.nextNote }) : null,
      note: se.note,
      setLogs: logs,
    }
  })
  const blocks = exercises
    .filter((e) => e.setLogs.length > 0)
    .map((e) => {
      const lines = [serializeHeader({ name: e.exercise.name, lo: e.lo, hi: e.hi, sets: e.sets, marker: e.exercise.unilateral })]
      if (e.swappedFromName) lines.push(`(swapped from ${e.swappedFromName})`)
      lines.push(serializeSessionLine(segmentsOf(e.setLogs)))
      return lines.join('\n')
    })
  return {
    id: row.s.id,
    date: row.s.date,
    startedAt: row.s.startedAt.toISOString(),
    finishedAt: row.s.finishedAt?.toISOString() ?? null,
    templateName: row.templateName,
    kind: row.s.type === 'walk' ? 'walk' : row.s.source === 'imported' ? 'imported' : (row.kind ?? 'imported'),
    type: row.s.type,
    source: row.s.source,
    durationMin: row.s.durationMin,
    sleepGood: row.s.sleepGood,
    shoulderPain: row.s.shoulderPain,
    elbowPain: row.s.elbowPain,
    advancedLoop: row.s.advancedLoop,
    note: row.s.note,
    exercises,
    shorthand: blocks.join('\n\n'),
  }
}

export interface MonthDot {
  date: string
  kind: SessionListItem['kind']
  id: string
  finished: boolean
}

/** One entry per live session in `yearMonth` ("YYYY-MM"), for the calendar (spec §6.5). */
export async function monthDots(db: Db, yearMonth: string): Promise<MonthDot[]> {
  const from = `${yearMonth}-01`
  const to = `${yearMonth}-31`
  const rows = await db
    .select({ id: session.id, date: session.date, type: session.type, source: session.source, finishedAt: session.finishedAt, kind: template.kind })
    .from(session)
    .leftJoin(template, eq(template.id, session.templateId))
    .where(and(isNull(session.deletedAt), gte(session.date, from), lte(session.date, to)))
    .orderBy(asc(session.date), asc(session.startedAt))
  return rows.map((r) => ({ id: r.id, date: r.date, finished: r.finishedAt !== null, kind: r.type === 'walk' ? 'walk' : r.source === 'imported' ? 'imported' : (r.kind ?? 'imported') }))
}
