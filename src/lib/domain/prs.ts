// PRs (spec §7.6). A set with no baseline (no counted set in an earlier session) is never a PR —
// otherwise every first-week set would be one. Ties are not PRs.
import type { ExerciseCfg } from './types'

export interface PrSet {
  load: number | null
  reps: number | null
}

const KG_TO_LB = 2.20462

/** Epley e1RM on the effective total load; null when not computable (bodyweight without a body weight). */
export function e1rm(ex: ExerciseCfg, load: number, reps: number, bodyWeightKg: number | null): number | null {
  let total: number
  switch (ex.loadType) {
    case 'per_side':
      total = (ex.barWeight ?? 0) + 2 * load
      break
    case 'bodyweight':
      if (bodyWeightKg === null) return null
      total = bodyWeightKg * KG_TO_LB + load
      break
    default:
      total = load
  }
  return total * (1 + reps / 30)
}

const counted = <T extends PrSet>(sets: T[]): (T & { load: number; reps: number })[] =>
  sets.filter((s): s is T & { load: number; reps: number } => s.load !== null && s.reps !== null)

export function isPrSet(set: PrSet, prior: PrSet[], ex: ExerciseCfg, bodyWeightKg: number | null): boolean {
  const p = counted(prior)
  if (p.length === 0 || set.load === null || set.reps === null) return false
  const assist = ex.progression === 'assist_down'
  const loads = p.map((s) => s.load)
  // (a) better load than every earlier set
  if (assist ? set.load < Math.min(...loads) : set.load > Math.max(...loads)) return true
  // (b) more reps than every earlier set at this same load
  const same = p.filter((s) => s.load === set.load)
  if (same.length > 0 && set.reps > Math.max(...same.map((s) => s.reps))) return true
  // (c) higher e1RM (load_up only)
  if (!assist) {
    const mine = e1rm(ex, set.load, set.reps, bodyWeightKg)
    if (mine !== null) {
      const best = Math.max(...p.map((s) => e1rm(ex, s.load, s.reps, bodyWeightKg) ?? -Infinity))
      if (best !== -Infinity && mine > best) return true
    }
  }
  return false
}

/** Highest load, ties by reps (assist: lowest assist, ties by reps); failure sets excluded. */
export function bestSet<T extends PrSet>(sets: T[], ex: ExerciseCfg): T | null {
  const c = counted(sets)
  if (c.length === 0) return null
  const assist = ex.progression === 'assist_down'
  return c.reduce((best, s) => {
    const betterLoad = assist ? s.load < best.load : s.load > best.load
    const sameLoad = s.load === best.load
    return betterLoad || (sameLoad && s.reps > best.reps) ? s : best
  })
}
