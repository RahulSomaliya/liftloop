// Body metrics (spec §7.11). Rows created by the sleep toggle alone have null weight and are skipped.
import { addDaysIST } from './time'

export interface WeightMetric {
  date: string
  weightKg: number | null
}

/** Mean of non-null weights over the 7 IST dates ending on `date`; null when none. */
export function weightAvg7(date: string, metrics: WeightMetric[]): number | null {
  const from = addDaysIST(date, -6)
  const vals = metrics
    .filter((m) => m.weightKg !== null && m.date >= from && m.date <= date)
    .map((m) => m.weightKg as number)
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
