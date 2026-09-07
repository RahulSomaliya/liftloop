import { describe, expect, it } from 'vitest'
import { getPhase, nextEasyWeek, scheduledPhaseName, weekPhase, weekPhaseForDate } from '../phase'
import { program } from './fixtures'

describe('getPhase schedule (§2.2)', () => {
  it('maps dates to phases', () => {
    expect(getPhase('2026-09-07', program)).toMatchObject({ name: 'Ramp', week: 1, targetDays: 4, setsOverride: 2, loadMultiplier: 1, isEasyWeek: false, source: 'schedule' })
    expect(getPhase('2026-09-20', program)).toMatchObject({ name: 'Ramp', week: 2 })
    expect(getPhase('2026-09-21', program)).toMatchObject({ name: 'Build 1', week: 3, targetDays: 5, setsOverride: null, loadMultiplier: 1 })
    expect(getPhase('2026-10-18', program)).toMatchObject({ name: 'Build 1', week: 6 })
    expect(getPhase('2026-10-19', program)).toMatchObject({ name: 'Easy', week: 7, targetDays: 4, setsOverride: 2, loadMultiplier: 0.8, isEasyWeek: true })
    expect(getPhase('2026-10-26', program)).toMatchObject({ name: 'Build 2', week: 8, rirRule: '1–3 RIR' })
    expect(getPhase('2026-11-30', program)).toMatchObject({ name: 'Easy', week: 13 })
    expect(getPhase('2026-12-07', program)).toMatchObject({ name: 'Build 2', week: 14 })
    expect(getPhase('2027-01-11', program)).toMatchObject({ name: 'Easy', week: 19 })
    expect(getPhase('2026-09-01', program)).toMatchObject({ name: 'Ramp', week: 1 })
    expect(getPhase('2026-09-09', program).weekStart).toBe('2026-09-07')
  })
  it('scheduledPhaseName pattern', () => {
    expect([1, 2, 3, 6, 7, 8, 12, 13, 14, 19, 25].map(scheduledPhaseName)).toEqual(['Ramp', 'Ramp', 'Build 1', 'Build 1', 'Easy', 'Build 2', 'Build 2', 'Easy', 'Build 2', 'Easy', 'Easy'])
  })
})

describe('manual easy weeks', () => {
  const p = { ...program, easyWeekOverrides: [{ from: '2026-09-30', to: '2026-10-02' }] }
  it('override wins per date', () => {
    expect(getPhase('2026-10-01', p)).toMatchObject({ name: 'Easy', source: 'manual', loadMultiplier: 0.8, setsOverride: 2 })
    expect(getPhase('2026-09-29', p)).toMatchObject({ name: 'Build 1', source: 'schedule' })
    expect(getPhase('2026-10-03', p)).toMatchObject({ name: 'Build 1' })
  })
  it('weekPhase is Easy if any date is Easy', () => {
    expect(weekPhase(4, p)).toMatchObject({ name: 'Easy', targetDays: 4, isEasyWeek: true, weekStart: '2026-09-28', weekEnd: '2026-10-04' })
    expect(weekPhase(4, program)).toMatchObject({ name: 'Build 1', targetDays: 5, isEasyWeek: false })
    expect(weekPhaseForDate('2026-09-28', p).name).toBe('Easy')
    expect(weekPhase(1, program)).toMatchObject({ name: 'Ramp', week: 1 })
    expect(weekPhase(2, program).name).toBe('Ramp')
    expect(weekPhase(3, program).name).toBe('Build 1')
  })
})

describe('nextEasyWeek', () => {
  it('finds the next scheduled or manual easy week after the current week', () => {
    expect(nextEasyWeek('2026-09-07', program)).toEqual({ from: '2026-10-19', to: '2026-10-25' })
    expect(nextEasyWeek('2026-10-19', program)).toEqual({ from: '2026-11-30', to: '2026-12-06' })
    expect(nextEasyWeek('2026-10-26', program)).toEqual({ from: '2026-11-30', to: '2026-12-06' })
    const p = { ...program, easyWeekOverrides: [{ from: '2026-09-30', to: '2026-10-02' }] }
    expect(nextEasyWeek('2026-09-21', p)).toEqual({ from: '2026-09-28', to: '2026-10-04' })
  })
})
