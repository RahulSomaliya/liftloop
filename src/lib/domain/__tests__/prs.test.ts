import { describe, expect, it } from 'vitest'
import { bestSet, e1rm, isPrSet } from '../prs'
import { formatSets, weeklySets } from '../weekly-sets'
import { assist, bw, mkExercise, perSideRdl, stackKg } from './fixtures'

const s = (load: number | null, reps: number | null) => ({ load, reps })

describe('isPrSet (§7.6)', () => {
  it('no baseline → never a PR', () => {
    expect(isPrSet(s(27, 12), [], stackKg, null)).toBe(false)
    expect(isPrSet(s(27, 12), [s(0, null)], bw, null)).toBe(false)
  })
  it('(a) better load', () => {
    expect(isPrSet(s(30, 8), [s(27, 12), s(25, 12)], stackKg, null)).toBe(true)
    expect(isPrSet(s(27, 8), [s(27, 12)], stackKg, null)).toBe(false)
    expect(isPrSet(s(10, 6), [s(15, 10)], assist, null)).toBe(true)
    expect(isPrSet(s(20, 10), [s(15, 10)], assist, null)).toBe(false)
  })
  it('(b) more reps at the same load, ties are not PRs', () => {
    expect(isPrSet(s(27, 13), [s(27, 12), s(30, 5)], stackKg, null)).toBe(true)
    expect(isPrSet(s(27, 12), [s(27, 12)], stackKg, null)).toBe(false)
  })
  it('(c) higher e1RM, load_up only', () => {
    // 25 × 15 → 37.5 beats 27 × 10 → 36
    expect(isPrSet(s(25, 15), [s(27, 10)], stackKg, null)).toBe(true)
    expect(isPrSet(s(20, 20), [s(15, 5)], assist, null)).toBe(false)
  })
  it('bodyweight e1RM needs a body weight', () => {
    expect(e1rm(bw, 10, 8, 73)).toBeCloseTo((73 * 2.20462 + 10) * (1 + 8 / 30), 3)
    expect(e1rm(bw, 10, 8, null)).toBeNull()
    expect(e1rm(perSideRdl, 25, 10, null)).toBeCloseTo((45 + 50) * (1 + 10 / 30), 3)
    expect(isPrSet(s(0, 9), [s(0, 8)], bw, null)).toBe(true) // via (b)
    expect(isPrSet(s(2.5, 6), [s(0, 10)], bw, null)).toBe(true) // via (a)
  })
  it('failure sets are skipped everywhere', () => {
    expect(isPrSet(s(27, null), [s(27, 12)], stackKg, null)).toBe(false)
    expect(bestSet([s(27, null), s(25, 15)], stackKg)).toEqual(s(25, 15))
  })
})

describe('bestSet', () => {
  it('highest load, ties by reps; assist lowest', () => {
    expect(bestSet([s(27, 12), s(25, 15), s(27, 10)], stackKg)).toEqual(s(27, 12))
    expect(bestSet([s(15, 10), s(10, 6), s(10, 8)], assist)).toEqual(s(10, 8))
    expect(bestSet([], stackKg)).toBeNull()
  })
})

describe('weeklySets (§7.7)', () => {
  it('sums sets × credit per muscle', () => {
    const rows = [
      { exercise: mkExercise({ muscles: [{ group: 'chest', credit: 1 }, { group: 'triceps', credit: 0.5 }, { group: 'front_delts', credit: 0.5 }] }), setCount: 3 },
      { exercise: mkExercise({ muscles: [{ group: 'chest', credit: 0.5 }, { group: 'front_delts', credit: 0.5 }, { group: 'triceps', credit: 0.25 }] }), setCount: 3 },
      { exercise: mkExercise({ muscles: [{ group: 'chest', credit: 1 }] }), setCount: 2 },
      { exercise: mkExercise({ muscles: [{ group: 'side_delts', credit: 1 }] }), setCount: 3 },
      { exercise: mkExercise({ muscles: [{ group: 'triceps', credit: 1 }] }), setCount: 2 },
      { exercise: mkExercise({ muscles: [{ group: 'rear_delts_cuff', credit: 1 }] }), setCount: 2 },
    ]
    const t = weeklySets(rows)
    expect(t.chest).toBe(6.5)
    expect(t.triceps).toBe(4.25)
    expect(t.front_delts).toBe(3)
    expect(t.side_delts).toBe(3)
    expect(t.rear_delts_cuff).toBe(2)
    expect(t.back).toBe(0)
    expect(formatSets(4.25)).toBe('4.3')
    expect(formatSets(6)).toBe('6')
  })
})
