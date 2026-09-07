import { and, asc, gte, lte } from 'drizzle-orm'
import type { Db } from '@/db/client'
import { bodyMetric } from '@/db/schema'
import { round1, weightAvg7 } from '@/lib/domain/body'
import { addDaysIST } from '@/lib/domain/time'

export interface BodyMetricRow {
  date: string
  weightKg: number | null
  waistCm: number | null
  sleepGood: boolean | null
  proteinHit: boolean | null
  cardioType: string | null
  cardioMin: number | null
  note: string | null
}

export interface BodyPage {
  today: BodyMetricRow | null
  /** Last `days` days that have a row, ascending. */
  rows: BodyMetricRow[]
  avg7Today: number | null
  /** One point per date in the window that has a weight, with its 7-day average. */
  series: { date: string; weightKg: number; avg7: number }[]
}

export async function loadBodyPage(db: Db, today: string, days = 30): Promise<BodyPage> {
  const from = addDaysIST(today, -(days - 1))
  const all = await db
    .select()
    .from(bodyMetric)
    .where(and(gte(bodyMetric.date, addDaysIST(from, -6)), lte(bodyMetric.date, today)))
    .orderBy(asc(bodyMetric.date))
  const rows = all.filter((r) => r.date >= from)
  const series = rows
    .filter((r) => r.weightKg !== null)
    .map((r) => ({ date: r.date, weightKg: r.weightKg as number, avg7: round1(weightAvg7(r.date, all) ?? (r.weightKg as number)) }))
  const avg = weightAvg7(today, all)
  return {
    today: rows.find((r) => r.date === today) ?? null,
    rows,
    avg7Today: avg === null ? null : round1(avg),
    series,
  }
}
