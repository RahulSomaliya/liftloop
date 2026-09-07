import { describe, expect, it } from 'vitest'
import { collapsedLine, getVerdict } from '../verdict'
import type { Goal, LoggedSet } from '../types'
import { assist, buildPhase, gym, perSideRdl, stackKg } from './fixtures'

const logged = (load: number | null, reps: (number | null)[]): LoggedSet[] =>
  reps.map((r, i) => ({ setIndex: i, load, reps: r, toFailure: r === null }))

const goal = (over: Partial<Goal>): Goal => ({
  mode: 'beat', load: 27, unit: 'kg', sets: 3, lo: 8, hi: 12, repsPerSet: [12, 9, 8], prefillRepsPerSet: [12, 10, 9],
  line: '', ghost: null, nextLoad: 32, setsOverride: null, deload: false, ...over,
})

const run = (g: Goal, sets: LoggedSet[], ex = stackKg, nextWeekPhase: 'Ramp' | 'Build 1' | 'Easy' | 'Build 2' = 'Build 1') =>
  getVerdict({ goal: g, loggedSets: sets, exercise: ex, gym, nextWeekPhase })

describe('getVerdict (§7.5)', () => {
  it('easy/ramp → done with next-week note', () => {
    const g = goal({ mode: 'easy', sets: 2, setsOverride: 2, repsPerSet: [12, 9], prefillRepsPerSet: [12, 9] })
    expect(run(g, logged(27, [12, 12]), stackKg, 'Ramp')).toMatchObject({ verdict: 'done', mark: [null, null], nextNote: '2 sets again next week' })
    expect(run(g, logged(27, [12, 12]), stackKg, 'Easy').nextNote).toBe('easy week continues')
    expect(run(g, logged(27, [12, 12]), stackKg, 'Build 1').nextNote).toBe('back to normal next week')
    const ft = goal({ mode: 'first_time', load: null, sets: 2, setsOverride: 2, repsPerSet: [12, 12], prefillRepsPerSet: [12, 12] })
    expect(run(ft, logged(25, [12, 12]), stackKg, 'Ramp').verdict).toBe('done')
  })
  it('beat / matched / under with marks', () => {
    expect(run(goal({}), logged(27, [12, 10, 9]))).toMatchObject({ verdict: 'beat', mark: ['eq', 'up', 'up'], allHitHi: false, nextNote: 'same weight next time' })
    expect(run(goal({}), logged(27, [12, 12, 12]))).toMatchObject({ verdict: 'beat', allHitHi: true, nextNote: 'next time: 32 kg' })
    expect(run(goal({}), logged(27, [12, 9, 8]))).toMatchObject({ verdict: 'matched', mark: ['eq', 'eq', 'eq'] })
    expect(run(goal({}), logged(27, [11, 9, 8]))).toMatchObject({ verdict: 'under', mark: ['down', 'eq', 'eq'] })
  })
  it('a set at a better load is a beat regardless of totals', () => {
    const sets: LoggedSet[] = [{ setIndex: 0, load: 32, reps: 8, toFailure: false }, { setIndex: 1, load: 27, reps: 8, toFailure: false }, { setIndex: 2, load: 27, reps: 8, toFailure: false }]
    expect(run(goal({}), sets).verdict).toBe('beat')
  })
  it('new_weight goal compares at the new load', () => {
    const g = goal({ mode: 'new_weight', load: 32, nextLoad: 37, repsPerSet: [8, 8, 8], prefillRepsPerSet: [8, 8, 8] })
    expect(run(g, logged(32, [8, 8, 8]))).toMatchObject({ verdict: 'matched', nextNote: 'same weight next time' })
    expect(run(g, logged(32, [12, 12, 12]))).toMatchObject({ verdict: 'beat', nextNote: 'next time: 37 kg' })
  })
  it('first_time in Build uses the first logged load', () => {
    const g = goal({ mode: 'first_time', load: null, nextLoad: null, repsPerSet: [12, 12, 12], prefillRepsPerSet: [12, 12, 12] })
    expect(run(g, logged(25, [12, 12, 12]))).toMatchObject({ verdict: 'matched', nextNote: 'next time: 30 kg' })
    expect(run(g, logged(25, [10, 10, 10]))).toMatchObject({ verdict: 'under', nextNote: 'same weight next time' })
  })
  it('failure entries in the goal count as hi; logged f sets contribute 0 and mark null', () => {
    const g = goal({ load: 0, sets: 2, lo: 12, hi: 15, repsPerSet: [null, null], prefillRepsPerSet: [15, 15] })
    expect(run(g, logged(0, [15, 15]))).toMatchObject({ verdict: 'matched', mark: ['eq', 'eq'] })
    expect(run(g, logged(0, [null, 15]))).toMatchObject({ verdict: 'under', mark: [null, 'eq'], allHitHi: false })
    expect(run(goal({}), logged(27, [12, null, 12])).allHitHi).toBe(false)
  })
  it('assist notes', () => {
    const g = goal({ load: 10, sets: 3, lo: 6, hi: 10, repsPerSet: [9, 9, 9], prefillRepsPerSet: [10, 10, 10], nextLoad: 5 })
    expect(run(g, logged(10, [10, 10, 10]), assist)).toMatchObject({ verdict: 'beat', nextNote: 'next time: try Pull-Ups' })
    const g15 = goal({ load: 15, sets: 3, lo: 6, hi: 10, repsPerSet: [9, 9, 9], prefillRepsPerSet: [10, 10, 10], nextLoad: 10 })
    expect(run(g15, logged(15, [10, 10, 10]), assist).nextNote).toBe('next time: 10 kg assist')
    expect(run(g15, logged(15, [9, 9, 9]), assist)).toMatchObject({ verdict: 'matched', nextNote: 'same assist next time' })
    expect(run(g15, logged(10, [8, 8, 8]), assist).verdict).toBe('beat')
  })
  it('per_side note uses formatLoad', () => {
    const g = goal({ load: 25, sets: 3, lo: 8, hi: 10, repsPerSet: [10, 9, 9], prefillRepsPerSet: [10, 10, 10], unit: 'lb' })
    expect(run(g, logged(25, [10, 10, 10]), perSideRdl).nextNote).toBe('next time: 27.5 lb/side')
  })
  it('extra logged sets beyond the goal compare against the last target', () => {
    const r = run(goal({}), logged(27, [12, 10, 9, 9]))
    expect(r.mark).toEqual(['eq', 'up', 'up', 'up'])
  })
})

describe('collapsedLine (§6.3)', () => {
  it('formats the collapsed card line', () => {
    expect(collapsedLine(stackKg, logged(27, [12, 10, 9]), { verdict: 'beat', nextNote: 'same weight next time' })).toBe('27 kg × 12·10·9 — beat it · same weight next time')
    expect(collapsedLine(stackKg, logged(27, [12, 12, 12]), { verdict: 'beat', nextNote: 'next time: 32 kg' })).toBe('27 kg × 12·12·12 — beat it · next time: 32 kg')
    expect(collapsedLine(stackKg, logged(27, [12, 12]), { verdict: 'done', nextNote: 'back to normal next week' })).toBe('27 kg × 12·12 — done · back to normal next week')
    const mixed: LoggedSet[] = [{ setIndex: 0, load: 25, reps: 12, toFailure: false }, { setIndex: 1, load: 25, reps: 12, toFailure: false }, { setIndex: 2, load: 27, reps: 10, toFailure: false }]
    expect(collapsedLine(stackKg, mixed, { verdict: 'beat', nextNote: 'same weight next time' })).toBe('25 kg × 12·12 · 27 kg × 10 — beat it · same weight next time')
  })
})
