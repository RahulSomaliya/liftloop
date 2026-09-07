// Dumbbell rack ladder (spec §4.2). The rack is the gym's real dumbbell set, virtually extended
// above its last entry in 5 lb steps. Gaps below the max (50 → 60) are real gym data and stay.
// All three helpers search the same ladder so prev/next are symmetric (prev(70) = 65, next(65) = 70).

const EXT_STEP = 5

function sorted(rack: number[]): number[] {
  return [...rack].sort((a, b) => a - b)
}

/** Smallest ladder value strictly above `load`. */
export function ladderNext(load: number, rack: number[]): number {
  const r = sorted(rack)
  for (const v of r) if (v > load) return v
  const max = r[r.length - 1]
  // Above the rack: next multiple-of-5 step above `load`, anchored on max.
  const k = Math.floor((load - max) / EXT_STEP) + 1
  return max + k * EXT_STEP
}

/** Largest ladder value strictly below `load`; null when load ≤ min. */
export function ladderPrev(load: number, rack: number[]): number | null {
  const r = sorted(rack)
  const min = r[0]
  if (load <= min) return null
  const max = r[r.length - 1]
  if (load > max) {
    const k = Math.ceil((load - max) / EXT_STEP) - 1
    return max + k * EXT_STEP
  }
  let best: number | null = null
  for (const v of r) if (v < load) best = v
  return best
}

/** Largest ladder value ≤ `load`; null when load < min. */
export function ladderRoundDown(load: number, rack: number[]): number | null {
  const r = sorted(rack)
  const min = r[0]
  if (load < min) return null
  const max = r[r.length - 1]
  if (load >= max) {
    const k = Math.floor((load - max) / EXT_STEP)
    return max + k * EXT_STEP
  }
  let best: number | null = null
  for (const v of r) if (v <= load) best = v
  return best
}

export function rackMin(rack: number[]): number {
  return sorted(rack)[0]
}
