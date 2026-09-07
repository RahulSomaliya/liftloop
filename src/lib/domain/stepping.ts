// Load stepping rules (spec §4, §7.4). `increment` is always a positive magnitude; the direction
// comes from `progression`. Dumbbell and bodyweight-added loads move along the rack ladder.
import { ladderNext, ladderPrev, ladderRoundDown, rackMin } from './rack'
import type { ExerciseCfg, GymCfg } from './types'

const BW_NEG_STEP = 5

/** Nearest multiple of `stepSize`, half rounds up. */
export function roundToStep(value: number, stepSize: number): number {
  if (stepSize <= 0) return value
  return Math.round(value / stepSize + 1e-9) * stepSize
}

function incrementOf(ex: ExerciseCfg): number {
  if (ex.increment === null || ex.increment <= 0) {
    throw new Error(`Exercise "${ex.name}" has no increment but uses increment stepping`)
  }
  return ex.increment
}

/** The next load up after `load` (spec §7.4 step). */
export function step(ex: ExerciseCfg, load: number, gym: GymCfg): number {
  if (ex.progression === 'assist_down') return Math.max(load - incrementOf(ex), 0)
  switch (ex.loadType) {
    case 'stack':
    case 'per_side':
      return load + incrementOf(ex)
    case 'dumbbell':
      return ladderNext(load, gym.dumbbellRackLb)
    case 'bodyweight':
      if (load < 0) return Math.min(load + BW_NEG_STEP, 0)
      return ladderNext(load, gym.dumbbellRackLb)
  }
}

/** One step down (weight chip "−"); null when there is no lower value. */
export function stepDown(ex: ExerciseCfg, load: number, gym: GymCfg): number | null {
  if (ex.progression === 'assist_down') return load + incrementOf(ex)
  switch (ex.loadType) {
    case 'stack':
    case 'per_side':
      return Math.max(load - incrementOf(ex), 0)
    case 'dumbbell':
      return ladderPrev(load, gym.dumbbellRackLb)
    case 'bodyweight':
      if (load <= 0) return load - BW_NEG_STEP
      return ladderPrev(load, gym.dumbbellRackLb) ?? 0
  }
}

/** Easy-week load: basis × 0.8 rounded to the exercise's own step (spec §7.4 easy). */
export function easyLoad(ex: ExerciseCfg, basis: number, gym: GymCfg): number {
  if (ex.progression === 'assist_down') {
    const inc = incrementOf(ex)
    return Math.max(Math.ceil((basis * 1.2) / inc - 1e-9) * inc, 0)
  }
  switch (ex.loadType) {
    case 'stack':
    case 'per_side':
      return roundToStep(basis * 0.8, incrementOf(ex))
    case 'dumbbell':
      return ladderRoundDown(basis * 0.8, gym.dumbbellRackLb) ?? rackMin(gym.dumbbellRackLb)
    case 'bodyweight':
      if (basis <= 0) return basis
      return ladderRoundDown(basis * 0.8, gym.dumbbellRackLb) ?? rackMin(gym.dumbbellRackLb)
  }
}
