import { and, asc, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { exercise, session, sessionExercise, setLog, template } from '@/db/schema'
import { bestSet } from '@/lib/domain/prs'
import { serializeSessionLine, type ParsedSegment } from '@/lib/domain/shorthand'
import type { ExerciseCfg, Verdict } from '@/lib/domain/types'
import { rowToExerciseCfg } from './session'

export interface ExerciseHistoryLine {
  sessionId: string
  date: string
  label: string
  line: string
  verdict: Verdict | null
}

export interface ExerciseDetail {
  exercise: ExerciseCfg
  swaps: { id: string; name: string }[]
  history: ExerciseHistoryLine[]
  best: { load: number; reps: number } | null
}

/** Exercise detail (spec §6.4): every live finished session as one shorthand line, newest first. */
export async function exerciseDetail(db: Db, id: string): Promise<ExerciseDetail | null> {
  const [ex] = await db.select().from(exercise).where(eq(exercise.id, id)).limit(1)
  if (!ex) return null
  const cfg = rowToExerciseCfg(ex)
  const swaps = cfg.swapIds.length ? await db.select({ id: exercise.id, name: exercise.name }).from(exercise).where(inArray(exercise.id, cfg.swapIds)) : []
  const rows = await db
    .select({ seId: sessionExercise.id, verdict: sessionExercise.verdict, sessionId: session.id, date: session.date, type: session.type, source: session.source, templateName: template.name })
    .from(sessionExercise)
    .innerJoin(session, eq(session.id, sessionExercise.sessionId))
    .leftJoin(template, eq(template.id, session.templateId))
    .where(and(eq(sessionExercise.exerciseId, id), isNull(session.deletedAt), isNotNull(session.finishedAt)))
    .orderBy(desc(session.date), desc(session.startedAt))
  const sets = rows.length ? await db.select().from(setLog).where(and(inArray(setLog.sessionExerciseId, rows.map((r) => r.seId)), isNull(setLog.deletedAt))).orderBy(asc(setLog.setIndex)) : []
  const history = rows
    .map((r) => {
      const mine = sets.filter((s) => s.sessionExerciseId === r.seId)
      if (mine.length === 0) return null
      const segs: ParsedSegment[] = []
      for (const s of mine) {
        const load = s.load ?? 0
        const last = segs[segs.length - 1]
        const set = { reps: s.reps, toFailure: s.toFailure || s.reps === null }
        if (last && last.load === load) last.sets.push(set)
        else segs.push({ load, sets: [set] })
      }
      return { sessionId: r.sessionId, date: r.date, label: r.source === 'imported' ? 'imported' : (r.templateName ?? 'session') + (r.type === 'short' ? ' (short)' : ''), line: serializeSessionLine(segs), verdict: r.verdict }
    })
    .filter((x): x is ExerciseHistoryLine => x !== null)
  const best = bestSet(sets.map((s) => ({ load: s.load, reps: s.reps })), cfg)
  return { exercise: cfg, swaps, history, best: best ? { load: best.load as number, reps: best.reps as number } : null }
}
