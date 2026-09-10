import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte } from 'drizzle-orm'
import type { Db, Tx } from '@/db/client'
import { bodyMetric, exercise, gymConfig, session, sessionExercise, setLog, template, templateExercise } from '@/db/schema'
import { PROGRAM_V2 } from '@/db/seed/program-v2'
import { weekBoundsIST } from '@/lib/domain/time'
import type { ExerciseCfg, Goal, GymCfg, HistoryEntry, PhaseName, RestPrefs, SessionType, Verdict } from '@/lib/domain/types'

type Dbx = Db | Tx
type ExerciseRow = typeof exercise.$inferSelect

export function rowToExerciseCfg(r: ExerciseRow): ExerciseCfg {
  return {
    id: r.id,
    name: r.name,
    aliases: r.aliases,
    loadType: r.loadType,
    unit: r.unit,
    barWeight: r.barWeight,
    increment: r.increment,
    progression: r.progression,
    restSeconds: r.restSeconds,
    unilateral: r.unilateral,
    muscles: r.muscles,
    swapIds: r.swapIds,
    cue: r.cue,
  }
}

type GymRow = typeof gymConfig.$inferSelect

async function gymRow(db: Dbx): Promise<GymRow> {
  const [g] = await db.select().from(gymConfig).limit(1)
  if (!g) throw new Error('No gym config seeded — run pnpm db:seed')
  return g
}
const gymFromRow = (g: GymRow): GymCfg => ({ platesLb: g.platesLb, dumbbellRackLb: g.dumbbellRackLb, stackStepKg: g.stackStepKg })
const restFromRow = (g: GymRow): RestPrefs => ({ overrideSeconds: g.restOverrideSeconds })

export async function loadGym(db: Dbx): Promise<GymCfg> {
  return gymFromRow(await gymRow(db))
}

/** Settings → Rest timer (v1.2); lives on the gym_config singleton. */
export async function loadRestPrefs(db: Dbx): Promise<RestPrefs> {
  return restFromRow(await gymRow(db))
}

export async function loadExerciseCfg(db: Dbx, id: string): Promise<ExerciseCfg | null> {
  const [r] = await db.select().from(exercise).where(eq(exercise.id, id)).limit(1)
  return r ? rowToExerciseCfg(r) : null
}

export async function loadExerciseCfgs(db: Dbx, ids: string[]): Promise<Map<string, ExerciseCfg>> {
  if (ids.length === 0) return new Map()
  const rows = await db.select().from(exercise).where(inArray(exercise.id, ids))
  return new Map(rows.map((r) => [r.id, rowToExerciseCfg(r)]))
}

/**
 * Live finished session_exercises of an exercise from ANY template (imported included), newest
 * first, with their live set logs (spec §7.4 `history`). `excludeSessionId` keeps the in-progress
 * session itself out when recomputing a goal mid-session.
 */
export async function loadExerciseHistory(db: Dbx, exerciseId: string, opts: { excludeSessionId?: string } = {}): Promise<HistoryEntry[]> {
  const rows = await db
    .select({ id: sessionExercise.id, goal: sessionExercise.goal, createdAt: sessionExercise.createdAt, date: session.date, sessionId: session.id })
    .from(sessionExercise)
    .innerJoin(session, eq(session.id, sessionExercise.sessionId))
    .where(and(eq(sessionExercise.exerciseId, exerciseId), isNull(session.deletedAt), isNotNull(session.finishedAt)))
    .orderBy(desc(session.date), desc(session.startedAt), desc(sessionExercise.createdAt))
  const filtered = rows.filter((r) => r.sessionId !== opts.excludeSessionId)
  if (filtered.length === 0) return []
  const sets = await db
    .select()
    .from(setLog)
    .where(and(inArray(setLog.sessionExerciseId, filtered.map((r) => r.id)), isNull(setLog.deletedAt)))
  const byExercise = new Map<string, HistoryEntry['sets']>()
  for (const s of sets) {
    const list = byExercise.get(s.sessionExerciseId) ?? []
    list.push({ setIndex: s.setIndex, load: s.load, reps: s.reps, toFailure: s.toFailure })
    byExercise.set(s.sessionExerciseId, list)
  }
  return filtered.map((r) => ({
    sessionDate: r.date,
    createdAt: r.createdAt.toISOString(),
    goal: (r.goal as Goal | null) ?? null,
    sets: (byExercise.get(r.id) ?? []).sort((a, b) => a.setIndex - b.setIndex),
  }))
}

/** Latest body weight in the IST week of `date` (for bodyweight e1RM, spec §7.6). */
export async function loadWeekBodyWeight(db: Dbx, date: string): Promise<number | null> {
  const { weekStart, weekEnd } = weekBoundsIST(date)
  const rows = await db
    .select({ weightKg: bodyMetric.weightKg })
    .from(bodyMetric)
    .where(and(gte(bodyMetric.date, weekStart), lte(bodyMetric.date, weekEnd), isNotNull(bodyMetric.weightKg)))
    .orderBy(desc(bodyMetric.date))
    .limit(1)
  return rows[0]?.weightKg ?? null
}

export interface TemplateEntryRow {
  archived: boolean
  templateExerciseId: string
  orderIndex: number
  sets: number
  lo: number
  hi: number
  restSeconds: number | null
  supersetGroup: number | null
  exercise: ExerciseCfg
}

export async function loadTemplateEntries(db: Dbx, templateId: string, opts: { includeArchived?: boolean } = {}): Promise<TemplateEntryRow[]> {
  const rows = await db
    .select({ te: templateExercise, ex: exercise })
    .from(templateExercise)
    .innerJoin(exercise, eq(exercise.id, templateExercise.exerciseId))
    .where(opts.includeArchived ? eq(templateExercise.templateId, templateId) : and(eq(templateExercise.templateId, templateId), eq(templateExercise.archived, false)))
    .orderBy(asc(templateExercise.orderIndex))
  return rows.map(({ te, ex }) => ({
    archived: te.archived,
    templateExerciseId: te.id,
    orderIndex: te.orderIndex,
    sets: te.sets,
    lo: te.lo,
    hi: te.hi,
    restSeconds: te.restSeconds,
    supersetGroup: te.supersetGroup,
    exercise: rowToExerciseCfg(ex),
  }))
}

export interface SessionSetView {
  setIndex: number
  rev: number
  load: number | null
  reps: number | null
  toFailure: boolean
  isPr: boolean
}

export interface SessionExerciseView {
  id: string
  orderIndex: number
  exercise: ExerciseCfg
  swappedFrom: { id: string; name: string } | null
  sets: number
  lo: number | null
  hi: number | null
  goal: Goal | null
  verdict: Verdict | null
  nextNote: string | null
  note: string | null
  restSeconds: number
  supersetGroup: number | null
  swapOptions: { id: string; name: string }[]
  setLogs: SessionSetView[]
}

export interface SessionView {
  id: string
  date: string
  startedAt: string
  finishedAt: string | null
  type: SessionType
  templateId: string | null
  templateName: string | null
  advancedLoop: boolean
  note: string | null
  todaySleepGood: boolean | null
  exercises: SessionExerciseView[]
  gym: GymCfg
  /** Rest timer settings: `overrideSeconds` replaces every slot's `restSeconds` when set. */
  rest: RestPrefs
  warmup: string[]
  nextWeekPhase: PhaseName
}

export async function getSessionView(db: Dbx, sessionId: string, nextWeekPhase: PhaseName): Promise<SessionView | null> {
  const [s] = await db
    .select({ s: session, templateName: template.name })
    .from(session)
    .leftJoin(template, eq(template.id, session.templateId))
    .where(and(eq(session.id, sessionId), isNull(session.deletedAt)))
    .limit(1)
  if (!s) return null
  const rows = await db
    .select({ se: sessionExercise, ex: exercise, te: templateExercise })
    .from(sessionExercise)
    .innerJoin(exercise, eq(exercise.id, sessionExercise.exerciseId))
    .leftJoin(templateExercise, eq(templateExercise.id, sessionExercise.templateExerciseId))
    .where(eq(sessionExercise.sessionId, sessionId))
    .orderBy(asc(sessionExercise.orderIndex))
  const seIds = rows.map((r) => r.se.id)
  const sets = seIds.length
    ? await db.select().from(setLog).where(and(inArray(setLog.sessionExerciseId, seIds), isNull(setLog.deletedAt))).orderBy(asc(setLog.setIndex))
    : []
  const swapAndOriginIds = [...new Set(rows.flatMap((r) => [...r.ex.swapIds, r.se.swappedFromExerciseId].filter((x): x is string => !!x)))]
  const named = swapAndOriginIds.length ? await db.select({ id: exercise.id, name: exercise.name, swapIds: exercise.swapIds }).from(exercise).where(inArray(exercise.id, swapAndOriginIds)) : []
  const nameOf = new Map(named.map((n) => [n.id, n.name]))
  const [todayMetric] = await db.select({ sleepGood: bodyMetric.sleepGood }).from(bodyMetric).where(eq(bodyMetric.date, s.s.date)).limit(1)
  const g = await gymRow(db)

  return {
    id: s.s.id,
    date: s.s.date,
    startedAt: s.s.startedAt.toISOString(),
    finishedAt: s.s.finishedAt?.toISOString() ?? null,
    type: s.s.type,
    templateId: s.s.templateId,
    templateName: s.templateName ?? null,
    advancedLoop: s.s.advancedLoop,
    note: s.s.note,
    todaySleepGood: todayMetric?.sleepGood ?? null,
    exercises: rows.map(({ se, ex, te }) => {
      // Swap options: the ORIGINAL exercise's swap list plus the original itself (to swap back).
      const originId = se.swappedFromExerciseId ?? ex.id
      const originSwaps = se.swappedFromExerciseId ? (named.find((n) => n.id === se.swappedFromExerciseId)?.swapIds ?? []) : ex.swapIds
      const options = [...originSwaps, ...(se.swappedFromExerciseId ? [originId] : [])]
        .filter((id) => id !== ex.id)
        .map((id) => ({ id, name: nameOf.get(id) ?? '' }))
        .filter((o) => o.name)
      return {
        id: se.id,
        orderIndex: se.orderIndex,
        exercise: rowToExerciseCfg(ex),
        swappedFrom: se.swappedFromExerciseId ? { id: se.swappedFromExerciseId, name: nameOf.get(se.swappedFromExerciseId) ?? '' } : null,
        sets: se.sets,
        lo: se.lo,
        hi: se.hi,
        goal: (se.goal as Goal | null) ?? null,
        verdict: se.verdict,
        nextNote: se.nextNote,
        note: se.note,
        restSeconds: te?.restSeconds ?? ex.restSeconds,
        supersetGroup: te?.supersetGroup ?? null,
        swapOptions: options,
        setLogs: sets.filter((x) => x.sessionExerciseId === se.id).map((x) => ({ setIndex: x.setIndex, rev: x.rev, load: x.load, reps: x.reps, toFailure: x.toFailure, isPr: x.isPr })),
      }
    }),
    gym: gymFromRow(g),
    rest: restFromRow(g),
    warmup: PROGRAM_V2.warmup,
    nextWeekPhase,
  }
}
