import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, or } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { bodyMetric, exercise, exportLog, session, sessionExercise, setLog, template } from '@/db/schema'
import type { ReportInput } from '@/lib/domain/report'
import { addDaysIST } from '@/lib/domain/time'
import { loadProgram } from './home'
import { rowToExerciseCfg } from './session'

/** Everything generateCoachReport needs for [from, to] (spec §8), loaded with live rows only. */
export async function loadReportInput(db: Db, args: { from: string; to: string; today: string; ownerName: string | null }): Promise<ReportInput> {
  const prog = await loadProgram(db)
  const sessions = await db
    .select({ s: session, templateName: template.name })
    .from(session)
    .leftJoin(template, eq(template.id, session.templateId))
    .where(and(isNull(session.deletedAt), gte(session.date, args.from), lte(session.date, args.to), or(isNotNull(session.finishedAt), eq(session.source, 'imported'))))
    .orderBy(asc(session.date), asc(session.startedAt))
  const sessionIds = sessions.map((r) => r.s.id)
  const exRows = sessionIds.length
    ? await db
        .select({ se: sessionExercise, ex: exercise })
        .from(sessionExercise)
        .innerJoin(exercise, eq(exercise.id, sessionExercise.exerciseId))
        .where(inArray(sessionExercise.sessionId, sessionIds))
        .orderBy(asc(sessionExercise.orderIndex))
    : []
  const seIds = exRows.map((r) => r.se.id)
  const sets = seIds.length ? await db.select().from(setLog).where(and(inArray(setLog.sessionExerciseId, seIds), isNull(setLog.deletedAt))).orderBy(asc(setLog.setIndex)) : []
  const swappedIds = [...new Set(exRows.map((r) => r.se.swappedFromExerciseId).filter((x): x is string => !!x))]
  const swapped = swappedIds.length ? await db.select().from(exercise).where(inArray(exercise.id, swappedIds)) : []
  const swappedCfg = new Map(swapped.map((e) => [e.id, rowToExerciseCfg(e)]))

  const metrics = await db.select().from(bodyMetric).where(and(gte(bodyMetric.date, addDaysIST(args.from, -6)), lte(bodyMetric.date, args.to))).orderBy(asc(bodyMetric.date))
  const exports = await db.select({ createdAt: exportLog.createdAt }).from(exportLog)

  return {
    from: args.from,
    to: args.to,
    today: args.today,
    ownerName: args.ownerName,
    program: { startDate: prog.startDate, nextIndex: prog.nextIndex, easyWeekOverrides: prog.easyWeekOverrides, templates: prog.templates.map((t) => ({ name: t.name, kind: t.kind })) },
    sessions: sessions.map(({ s, templateName }) => ({
      id: s.id,
      date: s.date,
      startedAt: s.startedAt.toISOString(),
      templateName,
      type: s.type,
      source: s.source,
      durationMin: s.durationMin,
      sleepGood: s.sleepGood,
      shoulderPain: s.shoulderPain,
      elbowPain: s.elbowPain,
      note: s.note,
      exercises: exRows
        .filter((r) => r.se.sessionId === s.id)
        .map(({ se, ex }) => ({
          orderIndex: se.orderIndex,
          exercise: rowToExerciseCfg(ex),
          swappedFrom: se.swappedFromExerciseId ? (swappedCfg.get(se.swappedFromExerciseId) ?? null) : null,
          sets: se.sets,
          lo: se.lo,
          hi: se.hi,
          verdict: se.verdict,
          note: se.note,
          setLogs: sets.filter((x) => x.sessionExerciseId === se.id).map((x) => ({ setIndex: x.setIndex, load: x.load, reps: x.reps, toFailure: x.toFailure, isPr: x.isPr })),
        })),
    })),
    bodyMetrics: metrics.map((m) => ({ date: m.date, weightKg: m.weightKg, waistCm: m.waistCm, sleepGood: m.sleepGood, proteinHit: m.proteinHit, cardioType: m.cardioType, cardioMin: m.cardioMin })),
    exportLog: exports.map((e) => ({ createdAt: e.createdAt.toISOString() })),
  }
}
