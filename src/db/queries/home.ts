import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { bodyMetric, exportLog, program, session, template } from '@/db/schema'
import { shoulderFlag } from '@/lib/domain/flags'
import { getPhase, nextEasyWeek, weekPhaseForDate } from '@/lib/domain/phase'
import { sixthDayOk } from '@/lib/domain/sleep'
import { addDaysIST, daysBetween, istDate, weekBoundsIST } from '@/lib/domain/time'
import type { PhaseInfo, ProgramCfg, TemplateKind, WeekPhaseInfo } from '@/lib/domain/types'

export interface TemplateRef {
  id: string
  name: string
  kind: TemplateKind
  orderIndex: number
}

export interface ProgramWithTemplates extends ProgramCfg {
  id: string
  templates: TemplateRef[]
}

export async function loadProgram(db: Db): Promise<ProgramWithTemplates> {
  const [p] = await db.select().from(program).limit(1)
  if (!p) throw new Error('No program seeded — run pnpm db:seed')
  const ts = await db.select().from(template).where(eq(template.programId, p.id)).orderBy(asc(template.orderIndex))
  return {
    id: p.id,
    startDate: p.startDate,
    nextIndex: p.nextIndex,
    easyWeekOverrides: p.easyWeekOverrides,
    templates: ts.map((t) => ({ id: t.id, name: t.name, kind: t.kind, orderIndex: t.orderIndex })),
  }
}

export interface HomeData {
  program: ProgramWithTemplates
  nextTemplate: TemplateRef
  inProgress: { id: string; templateName: string; startedAt: string } | null
  phase: PhaseInfo
  weekPhase: WeekPhaseInfo
  nextEasy: { from: string; to: string }
  week: { done: number; target: number; walks: number }
  shoulderFlag: boolean
  sleepGateOpen: boolean
  exportNudge: { kind: 'none' } | { kind: 'days'; days: number } | { kind: 'never' }
  today: { date: string; weightKg: number | null; sleepGood: boolean | null }
}

export async function getHomeData(db: Db, today: string): Promise<HomeData> {
  const prog = await loadProgram(db)
  const nextTemplate = prog.templates[prog.nextIndex] ?? prog.templates[0]
  const phase = getPhase(today, prog)
  const wp = weekPhaseForDate(today, prog)
  const { weekStart, weekEnd } = weekBoundsIST(today)

  const [live] = await db
    .select({ id: session.id, startedAt: session.startedAt, templateName: template.name })
    .from(session)
    .leftJoin(template, eq(template.id, session.templateId))
    .where(and(isNull(session.finishedAt), isNull(session.deletedAt), eq(session.source, 'logged')))
    .orderBy(desc(session.startedAt))
    .limit(1)

  const weekRows = await db
    .select({ type: session.type })
    .from(session)
    .where(
      and(
        isNull(session.deletedAt),
        isNotNull(session.finishedAt),
        eq(session.source, 'logged'),
        gte(session.date, weekStart),
        lte(session.date, weekEnd),
      ),
    )
  const done = weekRows.filter((r) => r.type !== 'walk').length
  const walks = weekRows.filter((r) => r.type === 'walk').length

  const recent = await db
    .select({ shoulderPain: session.shoulderPain })
    .from(session)
    .where(and(isNull(session.deletedAt), isNotNull(session.finishedAt), eq(session.source, 'logged'), inArray(session.type, ['normal', 'short'])))
    .orderBy(desc(session.date), desc(session.startedAt))
    .limit(3)

  const metrics = await db
    .select({ date: bodyMetric.date, sleepGood: bodyMetric.sleepGood, weightKg: bodyMetric.weightKg })
    .from(bodyMetric)
    .where(and(gte(bodyMetric.date, addDaysIST(today, -6)), lte(bodyMetric.date, today)))
  const todayMetric = metrics.find((m) => m.date === today)

  const [lastExport] = await db.select({ createdAt: sql<Date>`max(${exportLog.createdAt})` }).from(exportLog)
  let exportNudge: HomeData['exportNudge'] = { kind: 'none' }
  if (lastExport?.createdAt) {
    const days = daysBetween(istDate(new Date(lastExport.createdAt)), today)
    if (days >= 14) exportNudge = { kind: 'days', days }
  } else if (daysBetween(prog.startDate, today) >= 14) {
    exportNudge = { kind: 'never' }
  }

  return {
    program: prog,
    nextTemplate,
    inProgress: live ? { id: live.id, templateName: live.templateName ?? 'Session', startedAt: live.startedAt.toISOString() } : null,
    phase,
    weekPhase: wp,
    nextEasy: nextEasyWeek(today, prog),
    week: { done, target: wp.targetDays, walks },
    shoulderFlag: shoulderFlag(recent),
    sleepGateOpen: (phase.name === 'Build 1' || phase.name === 'Build 2') && sixthDayOk(metrics, today),
    exportNudge,
    today: { date: today, weightKg: todayMetric?.weightKg ?? null, sleepGood: todayMetric?.sleepGood ?? null },
  }
}
