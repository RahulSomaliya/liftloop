// Sleep gate (spec §7.9): ≥ 5 good nights in the 7 IST dates ending today opens the 6th day.
import { addDaysIST } from './time'

export interface SleepMetric {
  date: string
  sleepGood: boolean | null
}

export function sixthDayOk(metrics: SleepMetric[], today: string): boolean {
  const from = addDaysIST(today, -6)
  const good = metrics.filter((m) => m.sleepGood === true && m.date >= from && m.date <= today)
  const distinct = new Set(good.map((m) => m.date))
  return distinct.size >= 5
}
