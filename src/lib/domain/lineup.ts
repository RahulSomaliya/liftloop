// Session lineup helpers (spec §6.3, v1.2 focus mode). Pure: shared by the postpone server action
// (to compute the new order_index assignment) and the session screen (optimistic reorder + "up next").

/**
 * Postpone: move item `i` one place later so it comes back right after the next one —
 * 1·2·3·4·5 with 3 postponed reads 1·2·4·3·5. Postponing again pushes it one more place.
 * Returns the same array when `i` is the last item or out of range (nothing to wait behind).
 */
export function postponeAt<T>(list: readonly T[], i: number): T[] {
  if (i < 0 || i >= list.length - 1) return [...list]
  const out = [...list]
  ;[out[i], out[i + 1]] = [out[i + 1], out[i]]
  return out
}

/**
 * Index of the next incomplete item after `from` in lineup order, wrapping to earlier ones
 * (a postponed exercise left behind still has to be done); -1 when everything is complete.
 */
export function nextIncomplete(complete: readonly boolean[], from: number): number {
  const n = complete.length
  for (let k = 1; k <= n; k += 1) {
    const idx = (from + k) % n
    if (!complete[idx]) return idx
  }
  return -1
}
