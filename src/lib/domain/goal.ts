// Goal engine (spec §7.4). Produces the ONE goal line per exercise card plus the chip prefills.
// Everything here is pure: history comes in, a Goal snapshot goes out (stored on session_exercise).
import { formatLoad } from './load-format'
import { easyLoad, step } from './stepping'
import type { ExerciseCfg, Goal, GymCfg, HistoryEntry, LoggedSet, PhaseInfo, Progression, TemplateEntry } from './types'

export interface GoalInput {
  exercise: ExerciseCfg
  /** Always the CURRENT template_exercise entry, never a session_exercise snapshot. */
  entry: TemplateEntry
  /** Newest first: live finished session_exercises of this exercise from ANY template. */
  history: HistoryEntry[]
  phase: PhaseInfo
  gym: GymCfg
}

/** Assist loads at or below this suggest switching to real pull-ups (spec §7.4, §13). */
export const ASSIST_SWITCH_KG = 10

/** Newest non-deload row (imported rows with goal = null count as non-deload); else the newest row. */
export function pickLast(history: HistoryEntry[]): HistoryEntry | null {
  if (history.length === 0) return null
  return history.find((h) => h.goal?.deload !== true) ?? history[0]
}

/** Best load used in a session: highest for load_up, lowest for assist_down. */
export function basisLoad(entry: HistoryEntry, progression: Progression): number | null {
  const loads = entry.sets.map((s) => s.load).filter((l): l is number => l !== null)
  if (loads.length === 0) return null
  return progression === 'assist_down' ? Math.min(...loads) : Math.max(...loads)
}

function setsAtLoad(entry: HistoryEntry, load: number): LoggedSet[] {
  return [...entry.sets].filter((s) => s.load === load).sort((a, b) => a.setIndex - b.setIndex)
}

/** Reps at the basis load, in order, truncated to `sets` or padded by repeating the last one. */
export function repsAtLoad(entry: HistoryEntry, load: number, sets: number): (number | null)[] {
  const reps = setsAtLoad(entry, load).map((s) => s.reps)
  if (reps.length === 0) return Array.from({ length: sets }, () => null)
  const out = reps.slice(0, sets)
  while (out.length < sets) out.push(out[out.length - 1])
  return out
}

/** Every counted entry ≥ hi, at least one counted entry, and enough counted sets at the basis load. */
export function hiTest(lastReps: (number | null)[], countedAtBasis: number, entry: TemplateEntry): boolean {
  const counted = lastReps.filter((r): r is number => r !== null)
  if (counted.length === 0) return false
  if (!counted.every((r) => r >= entry.hi)) return false
  return countedAtBasis >= entry.sets
}

const joinReps = (reps: (number | null)[]): string => reps.map((r) => (r === null ? 'f' : String(r))).join(' · ')

export function getGoal({ exercise, entry, history, phase, gym }: GoalInput): Goal {
  const setsOverride = phase.setsOverride
  const sets = setsOverride ?? entry.sets
  const deload = phase.loadMultiplier === 0.8
  const base = { unit: exercise.unit, sets, lo: entry.lo, hi: entry.hi, setsOverride, deload }
  const fill = (n: number): number[] => Array.from({ length: sets }, () => n)

  const last = pickLast(history)
  const basis = last ? basisLoad(last, exercise.progression) : null
  if (last === null || basis === null) {
    return {
      ...base,
      mode: 'first_time',
      load: null,
      repsPerSet: fill(entry.hi),
      prefillRepsPerSet: fill(entry.hi),
      line: `First time — pick a weight you can do ${entry.hi} with 4 left`,
      ghost: null,
      nextLoad: null,
    }
  }

  const lastReps = repsAtLoad(last, basis, sets)
  const countedAtBasis = setsAtLoad(last, basis).filter((s) => s.reps !== null).length
  const ghost = { load: basis, reps: lastReps }
  const L = (n: number): string => formatLoad(exercise, n)

  if (setsOverride === 2) {
    const load = deload ? easyLoad(exercise, basis, gym) : basis
    return {
      ...base,
      mode: 'easy',
      load,
      repsPerSet: lastReps,
      prefillRepsPerSet: lastReps.map((r) => r ?? entry.hi),
      line: `Easy day — ${L(load)} × ${joinReps(lastReps)}, stop with 4 left`,
      ghost,
      nextLoad: null,
    }
  }

  if (hiTest(lastReps, countedAtBasis, entry)) {
    const load = step(exercise, basis, gym)
    const isAssist = exercise.progression === 'assist_down'
    const line = !isAssist
      ? `New weight ${L(load)} × ${entry.lo}+ each set`
      : basis <= ASSIST_SWITCH_KG
        ? `Try Pull-Ups — no assist (or ${L(load)} × ${entry.lo}+)`
        : `Less assist: ${L(load)} × ${entry.lo}+ each set`
    return {
      ...base,
      mode: 'new_weight',
      load,
      repsPerSet: fill(entry.lo),
      prefillRepsPerSet: fill(entry.lo),
      line,
      ghost,
      nextLoad: step(exercise, load, gym),
    }
  }

  return {
    ...base,
    mode: 'beat',
    load: basis,
    repsPerSet: lastReps,
    prefillRepsPerSet: lastReps.map((r) => (r === null ? entry.hi : Math.min(r + 1, entry.hi))),
    line: `Beat ${L(basis)} × ${joinReps(lastReps)}`,
    ghost,
    nextLoad: step(exercise, basis, gym),
  }
}
