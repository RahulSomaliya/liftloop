// Weekly hard sets per muscle (spec §7.7).
import type { ExerciseCfg, MuscleGroup } from './types'

export const MUSCLE_ORDER: MuscleGroup[] = [
  'chest', 'back', 'side_delts', 'rear_delts_cuff', 'quads', 'hamstrings', 'glutes', 'biceps', 'triceps', 'calves', 'abs', 'front_delts',
]

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  side_delts: 'Side delts',
  rear_delts_cuff: 'Rear delts/cuff',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  biceps: 'Biceps',
  triceps: 'Triceps',
  calves: 'Calves',
  abs: 'Abs',
  front_delts: 'Front delts',
}

export const MUSCLE_TARGETS: Record<MuscleGroup, { lo: number; hi: number } | null> = {
  chest: { lo: 8, hi: 12 },
  back: { lo: 10, hi: 14 },
  side_delts: { lo: 6, hi: 8 },
  rear_delts_cuff: { lo: 6, hi: 9 },
  quads: { lo: 8, hi: 10 },
  hamstrings: { lo: 6, hi: 8 },
  glutes: { lo: 6, hi: 10 },
  biceps: { lo: 5, hi: 8 },
  triceps: { lo: 4, hi: 8 },
  calves: { lo: 4, hi: 6 },
  abs: { lo: 3, hi: 6 },
  front_delts: null,
}

export function emptyMuscleTotals(): Record<MuscleGroup, number> {
  return Object.fromEntries(MUSCLE_ORDER.map((m) => [m, 0])) as Record<MuscleGroup, number>
}

/** Σ over rows of setCount × credit per muscle group. */
export function weeklySets(rows: { exercise: Pick<ExerciseCfg, 'muscles'>; setCount: number }[]): Record<MuscleGroup, number> {
  const totals = emptyMuscleTotals()
  for (const row of rows) {
    for (const m of row.exercise.muscles) totals[m.group] += row.setCount * m.credit
  }
  return totals
}

export function formatSets(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : String(r)
}
