import { describe, expect, it } from 'vitest'
import { getGoal, pickLast } from '../goal'
import type { Goal, HistoryEntry, LoggedSet } from '../types'
import { assist, buildPhase, bw, db, easyPhase, gym, perSideLegPress, perSideRdl, rampPhase, stackKg } from './fixtures'

const sets = (load: number, reps: (number | null)[]): LoggedSet[] =>
  reps.map((r, i) => ({ setIndex: i, load, reps: r, toFailure: r === null }))

const entry = (date: string, s: LoggedSet[], goal: Partial<Goal> | null = {}): HistoryEntry => ({
  sessionDate: date,
  createdAt: `${date}T10:00:00Z`,
  goal: goal === null ? null : ({ mode: 'beat', deload: false, ...goal } as Goal),
  sets: s,
})

const e3 = { sets: 3, lo: 8, hi: 12 }

describe('getGoal (§7.4)', () => {
  it('1. first_time in Build', () => {
    const g = getGoal({ exercise: stackKg, entry: e3, history: [], phase: buildPhase, gym })
    expect(g).toMatchObject({ mode: 'first_time', load: null, sets: 3, setsOverride: null, deload: false, nextLoad: null, ghost: null, lo: 8, hi: 12 })
    expect(g.prefillRepsPerSet).toEqual([12, 12, 12])
    expect(g.line).toBe('First time — pick a weight you can do 12 with 4 left')
  })
  it('2. first_time in Ramp has 2 sets', () => {
    const g = getGoal({ exercise: stackKg, entry: e3, history: [], phase: rampPhase, gym })
    expect(g).toMatchObject({ mode: 'first_time', sets: 2, setsOverride: 2 })
    expect(g.prefillRepsPerSet).toEqual([12, 12])
  })
  it('3. Ramp with history → easy at the last load, 2 sets', () => {
    const g = getGoal({ exercise: stackKg, entry: e3, history: [entry('2026-09-07', sets(27, [12, 9, 8]))], phase: rampPhase, gym })
    expect(g).toMatchObject({ mode: 'easy', load: 27, sets: 2, deload: false, nextLoad: null })
    expect(g.repsPerSet).toEqual([12, 9])
    expect(g.prefillRepsPerSet).toEqual([12, 9])
    expect(g.line).toBe('Easy day — 27 kg × 12 · 9, stop with 4 left')
    expect(g.ghost).toEqual({ load: 27, reps: [12, 9] })
  })
  it('4. Easy week deloads a stack to 0.8 rounded', () => {
    const g = getGoal({ exercise: stackKg, entry: e3, history: [entry('2026-10-12', sets(27, [12, 12, 12]))], phase: easyPhase, gym })
    expect(g).toMatchObject({ mode: 'easy', load: 20, deload: true })
    expect(g.line).toBe('Easy day — 20 kg × 12 · 12, stop with 4 left')
  })
  it('5. Easy week, pull-ups at BW stay BW', () => {
    const g = getGoal({ exercise: bw, entry: { sets: 3, lo: 6, hi: 10 }, history: [entry('2026-10-12', sets(0, [8, 7, 6]))], phase: easyPhase, gym })
    expect(g.load).toBe(0)
    expect(g.line).toBe('Easy day — BW × 8 · 7, stop with 4 left')
  })
  it('6. Easy week, dumbbell 2.5 clamps to the rack minimum', () => {
    const g = getGoal({ exercise: db, entry: { sets: 3, lo: 10, hi: 12 }, history: [entry('2026-10-12', sets(2.5, [12, 12, 12]))], phase: easyPhase, gym })
    expect(g.load).toBe(2.5)
  })
  it('7. Easy week, assist 15 → 20', () => {
    const g = getGoal({ exercise: assist, entry: { sets: 3, lo: 6, hi: 10 }, history: [entry('2026-10-12', sets(15, [10, 9, 8]))], phase: easyPhase, gym })
    expect(g.load).toBe(20)
    expect(g.line).toBe('Easy day — 20 kg assist × 10 · 9, stop with 4 left')
  })
  it('8. beat', () => {
    const g = getGoal({ exercise: stackKg, entry: e3, history: [entry('2026-09-21', sets(27, [12, 9, 8]))], phase: buildPhase, gym })
    expect(g).toMatchObject({ mode: 'beat', load: 27, nextLoad: 32, sets: 3 })
    expect(g.repsPerSet).toEqual([12, 9, 8])
    expect(g.prefillRepsPerSet).toEqual([12, 10, 9])
    expect(g.ghost).toEqual({ load: 27, reps: [12, 9, 8] })
    expect(g.line).toBe('Beat 27 kg × 12 · 9 · 8')
  })
  it('9. new_weight', () => {
    const g = getGoal({ exercise: stackKg, entry: e3, history: [entry('2026-09-21', sets(27, [12, 12, 12]))], phase: buildPhase, gym })
    expect(g).toMatchObject({ mode: 'new_weight', load: 32, nextLoad: 37 })
    expect(g.prefillRepsPerSet).toEqual([8, 8, 8])
    expect(g.repsPerSet).toEqual([8, 8, 8])
    expect(g.ghost).toEqual({ load: 27, reps: [12, 12, 12] })
    expect(g.line).toBe('New weight 32 kg × 8+ each set')
  })
  it('10. deload rows are skipped when a working row exists', () => {
    const history = [entry('2026-10-20', sets(20, [12, 12]), { deload: true, mode: 'easy' }), entry('2026-10-12', sets(27, [12, 12, 12]))]
    const g = getGoal({ exercise: stackKg, entry: e3, history, phase: buildPhase, gym })
    expect(g).toMatchObject({ mode: 'new_weight', load: 32 })
    expect(pickLast(history)?.sessionDate).toBe('2026-10-12')
  })
  it('11. only deload history → uses it', () => {
    const history = [entry('2026-10-20', sets(20, [12, 12]), { deload: true, mode: 'easy' })]
    const g = getGoal({ exercise: stackKg, entry: e3, history, phase: buildPhase, gym })
    expect(g).toMatchObject({ mode: 'beat', load: 20 })
  })
  it('12. mixed loads: basis is the best load, reps padded, counted too few → beat', () => {
    const s: LoggedSet[] = [{ setIndex: 0, load: 25, reps: 12, toFailure: false }, { setIndex: 1, load: 25, reps: 12, toFailure: false }, { setIndex: 2, load: 27, reps: 10, toFailure: false }]
    const g = getGoal({ exercise: stackKg, entry: e3, history: [entry('2026-09-21', s)], phase: buildPhase, gym })
    expect(g).toMatchObject({ mode: 'beat', load: 27 })
    expect(g.repsPerSet).toEqual([10, 10, 10])
    expect(g.line).toBe('Beat 27 kg × 10 · 10 · 10')
  })
  it('13. Leg Press: 2 sets last time, 3 now → padded, beat', () => {
    const g = getGoal({ exercise: perSideLegPress, entry: { sets: 3, lo: 10, hi: 15 }, history: [entry('2026-09-25', sets(180, [15, 15]))], phase: buildPhase, gym })
    expect(g).toMatchObject({ mode: 'beat', load: 180 })
    expect(g.repsPerSet).toEqual([15, 15, 15])
    expect(g.line).toBe('Beat 180 lb/side × 15 · 15 · 15')
  })
  it('14. 3 sets last time, 2 now → truncated, new_weight', () => {
    const g = getGoal({ exercise: perSideLegPress, entry: { sets: 2, lo: 12, hi: 15 }, history: [entry('2026-09-25', sets(180, [15, 15, 15]))], phase: buildPhase, gym })
    expect(g).toMatchObject({ mode: 'new_weight', load: 190 })
    expect(g.repsPerSet).toEqual([12, 12])
    expect(g.line).toBe('New weight 190 lb/side × 12+ each set')
  })
  it('15. failure sets: goal shows f, prefill hi, never new_weight', () => {
    const g = getGoal({ exercise: bw, entry: { sets: 2, lo: 12, hi: 15 }, history: [entry('2026-09-21', sets(0, [null, null]))], phase: buildPhase, gym })
    expect(g).toMatchObject({ mode: 'beat', load: 0 })
    expect(g.repsPerSet).toEqual([null, null])
    expect(g.prefillRepsPerSet).toEqual([15, 15])
    expect(g.line).toBe('Beat BW × f · f')
  })
  it('16. mixed failure: counted sets too few → beat', () => {
    const g = getGoal({ exercise: stackKg, entry: e3, history: [entry('2026-09-21', sets(27, [12, null, 12]))], phase: buildPhase, gym })
    expect(g.mode).toBe('beat')
    expect(g.prefillRepsPerSet).toEqual([12, 12, 12])
    expect(g.line).toBe('Beat 27 kg × 12 · f · 12')
  })
  it('17. assist: hit hi → less assist', () => {
    const g = getGoal({ exercise: assist, entry: { sets: 3, lo: 6, hi: 10 }, history: [entry('2026-09-21', sets(15, [10, 10, 10]))], phase: buildPhase, gym })
    expect(g).toMatchObject({ mode: 'new_weight', load: 10, nextLoad: 5 })
    expect(g.line).toBe('Less assist: 10 kg assist × 6+ each set')
  })
  it('18. assist at 10 hit → try pull-ups', () => {
    const g = getGoal({ exercise: assist, entry: { sets: 3, lo: 6, hi: 10 }, history: [entry('2026-09-21', sets(10, [10, 10, 10]))], phase: buildPhase, gym })
    expect(g).toMatchObject({ mode: 'new_weight', load: 5, nextLoad: 0 })
    expect(g.line).toBe('Try Pull-Ups — no assist (or 5 kg assist × 6+)')
  })
  it('19. assist at 5 hit → 0 kg assist', () => {
    const g = getGoal({ exercise: assist, entry: { sets: 3, lo: 6, hi: 10 }, history: [entry('2026-09-21', sets(5, [10, 10, 10]))], phase: buildPhase, gym })
    expect(g).toMatchObject({ mode: 'new_weight', load: 0, nextLoad: 0 })
    expect(g.line).toBe('Try Pull-Ups — no assist (or 0 kg assist × 6+)')
  })
  it('19b. assist basis picks the LOWEST load', () => {
    const s: LoggedSet[] = [{ setIndex: 0, load: 15, reps: 10, toFailure: false }, { setIndex: 1, load: 10, reps: 8, toFailure: false }]
    const g = getGoal({ exercise: assist, entry: { sets: 3, lo: 6, hi: 10 }, history: [entry('2026-09-21', s)], phase: buildPhase, gym })
    expect(g).toMatchObject({ mode: 'beat', load: 10 })
    expect(g.line).toBe('Beat 10 kg assist × 8 · 8 · 8')
  })
  it('20. negative bodyweight load steps toward 0', () => {
    const g = getGoal({ exercise: bw, entry: { sets: 3, lo: 6, hi: 10 }, history: [entry('2026-09-21', sets(-20, [10, 10, 10]))], phase: buildPhase, gym })
    expect(g).toMatchObject({ mode: 'new_weight', load: -15 })
    expect(g.line).toBe('New weight −15 lb × 6+ each set')
  })
  it('21. bodyweight hit hi → add the first dumbbell', () => {
    const g = getGoal({ exercise: bw, entry: { sets: 3, lo: 6, hi: 10 }, history: [entry('2026-09-21', sets(0, [10, 10, 10]))], phase: buildPhase, gym })
    expect(g).toMatchObject({ mode: 'new_weight', load: 2.5, nextLoad: 5 })
    expect(g.line).toBe('New weight BW +2.5 lb × 6+ each set')
  })
  it('22. dumbbell 60 hit → 65', () => {
    const g = getGoal({ exercise: db, entry: { sets: 3, lo: 10, hi: 12 }, history: [entry('2026-09-21', sets(60, [12, 12, 12]))], phase: buildPhase, gym })
    expect(g).toMatchObject({ mode: 'new_weight', load: 65, nextLoad: 70 })
  })
  it('23. per_side RDL hit → +2.5', () => {
    const g = getGoal({ exercise: perSideRdl, entry: { sets: 3, lo: 8, hi: 10 }, history: [entry('2026-09-21', sets(25, [10, 10, 10]))], phase: buildPhase, gym })
    expect(g).toMatchObject({ mode: 'new_weight', load: 27.5 })
    expect(g.line).toBe('New weight 27.5 lb/side × 8+ each set')
  })
  it('24. Ramp with 3-set history and a 3-set entry still shows 2 sets', () => {
    const g = getGoal({ exercise: stackKg, entry: e3, history: [entry('2026-09-07', sets(27, [12, 9, 8]))], phase: rampPhase, gym })
    expect(g.sets).toBe(2)
    expect(g.prefillRepsPerSet).toEqual([12, 9])
  })
  it('25. imported history (goal null) counts as history and as last', () => {
    const g = getGoal({ exercise: stackKg, entry: e3, history: [entry('2026-08-30', sets(27, [12, 9, 8]), null)], phase: buildPhase, gym })
    expect(g).toMatchObject({ mode: 'beat', load: 27 })
  })
  it('26. a history row with no loaded sets falls back to first_time', () => {
    const g = getGoal({ exercise: stackKg, entry: e3, history: [entry('2026-08-30', [], null)], phase: buildPhase, gym })
    expect(g.mode).toBe('first_time')
  })
})
