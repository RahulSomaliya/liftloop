import { describe, expect, it } from 'vitest'
import { round1, weightAvg7 } from '../body'
import { elbowFlag, shoulderFlag } from '../flags'
import { advanceLoop, sessionAdvances } from '../loop'
import { sixthDayOk } from '../sleep'

describe('loop (§7.2)', () => {
  it('advances and wraps', () => {
    expect(advanceLoop(6, 0)).toBe(1)
    expect(advanceLoop(6, 5)).toBe(0)
  })
  it('walks and non-advancing starts never advance', () => {
    expect(sessionAdvances('normal', true)).toBe(true)
    expect(sessionAdvances('short', true)).toBe(true)
    expect(sessionAdvances('walk', true)).toBe(false)
    expect(sessionAdvances('normal', false)).toBe(false)
  })
})

describe('sleep gate (§7.9)', () => {
  const m = (pairs: [string, boolean | null][]) => pairs.map(([date, sleepGood]) => ({ date, sleepGood }))
  it('needs 5 of the last 7 dates', () => {
    expect(sixthDayOk(m([['2026-09-01', true], ['2026-09-02', true], ['2026-09-03', true], ['2026-09-04', true], ['2026-09-05', true]]), '2026-09-07')).toBe(true)
    expect(sixthDayOk(m([['2026-09-01', true], ['2026-09-02', true], ['2026-09-03', true], ['2026-09-04', true]]), '2026-09-07')).toBe(false)
    expect(sixthDayOk(m([['2026-08-31', true], ['2026-09-02', true], ['2026-09-03', true], ['2026-09-04', true], ['2026-09-05', true]]), '2026-09-07')).toBe(false)
    expect(sixthDayOk(m([['2026-09-01', null], ['2026-09-02', true], ['2026-09-03', true], ['2026-09-04', true], ['2026-09-05', true], ['2026-09-06', false]]), '2026-09-07')).toBe(false)
  })
})

describe('flags (§7.8)', () => {
  const s = (v: (number | null)[]) => v.map((shoulderPain) => ({ shoulderPain, elbowPain: shoulderPain }))
  it('three in a row above 2', () => {
    expect(shoulderFlag(s([3, 3, 3]))).toBe(true)
    expect(shoulderFlag(s([3, 3, 3, 0]))).toBe(true)
    expect(shoulderFlag(s([3, 3]))).toBe(false)
    expect(shoulderFlag(s([3, 3, 2]))).toBe(false)
    expect(shoulderFlag(s([2, 3, 3, 3]))).toBe(false)
    expect(shoulderFlag(s([null, 3, 3]))).toBe(false)
    expect(elbowFlag(s([5, 4, 3]))).toBe(true)
  })
})

describe('weightAvg7 (§7.11)', () => {
  const m = (pairs: [string, number | null][]) => pairs.map(([date, weightKg]) => ({ date, weightKg }))
  it('averages the 7-day window, skipping nulls and out-of-window rows', () => {
    expect(weightAvg7('2026-09-07', m([['2026-09-01', 73], ['2026-09-04', null], ['2026-09-07', 74], ['2026-08-31', 90]]))).toBe(73.5)
    expect(weightAvg7('2026-09-07', m([['2026-09-07', 73.6]]))).toBe(73.6)
    expect(weightAvg7('2026-09-07', m([['2026-09-08', 73.6]]))).toBeNull()
    expect(weightAvg7('2026-09-07', [])).toBeNull()
    expect(round1(73.4499)).toBe(73.4)
  })
})
