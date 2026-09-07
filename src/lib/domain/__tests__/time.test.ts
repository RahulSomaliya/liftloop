import { describe, expect, it } from 'vitest'
import {
  addDaysIST,
  daysBetween,
  isValidISTDate,
  istDate,
  istMidday,
  programWeek,
  todayIST,
  weekBoundsIST,
  weekStartOf,
  weekdayShort,
} from '../time'

describe('time (Asia/Kolkata)', () => {
  it('todayIST uses IST, not UTC', () => {
    // 2026-09-06T20:00Z is 2026-09-07 01:30 IST
    expect(todayIST(new Date('2026-09-06T20:00:00Z'))).toBe('2026-09-07')
    expect(istDate(new Date('2026-09-07T18:29:59Z'))).toBe('2026-09-07')
    expect(istDate(new Date('2026-09-07T18:30:00Z'))).toBe('2026-09-08')
  })

  it('weeks start Monday', () => {
    expect(weekBoundsIST('2026-09-07')).toEqual({ weekStart: '2026-09-07', weekEnd: '2026-09-13' })
    expect(weekBoundsIST('2026-09-13')).toEqual({ weekStart: '2026-09-07', weekEnd: '2026-09-13' })
    expect(weekBoundsIST('2026-09-14')).toEqual({ weekStart: '2026-09-14', weekEnd: '2026-09-20' })
    expect(weekdayShort('2026-09-13')).toBe('Sun')
    expect(weekdayShort('2026-09-07')).toBe('Mon')
  })

  it('programWeek is 1-based from the start Monday and clamps before start', () => {
    expect(programWeek('2026-09-07', '2026-09-07')).toBe(1)
    expect(programWeek('2026-09-20', '2026-09-07')).toBe(2)
    expect(programWeek('2026-09-21', '2026-09-07')).toBe(3)
    expect(programWeek('2026-09-01', '2026-09-07')).toBe(1)
    expect(programWeek('2026-10-19', '2026-09-07')).toBe(7)
    expect(weekStartOf(7, '2026-09-07')).toBe('2026-10-19')
    expect(weekStartOf(13, '2026-09-07')).toBe('2026-11-30')
  })

  it('addDaysIST and daysBetween', () => {
    expect(addDaysIST('2026-09-07', -7)).toBe('2026-08-31')
    expect(addDaysIST('2026-09-30', 1)).toBe('2026-10-01')
    expect(daysBetween('2026-09-07', '2026-09-21')).toBe(14)
    expect(daysBetween('2026-09-21', '2026-09-07')).toBe(-14)
  })

  it('istMidday is 12:00 IST as an instant', () => {
    expect(istMidday('2026-09-07').toISOString()).toBe('2026-09-07T06:30:00.000Z')
  })

  it('validates date strings', () => {
    expect(isValidISTDate('2026-09-07')).toBe(true)
    expect(isValidISTDate('2026-02-30')).toBe(false)
    expect(isValidISTDate('2026-9-7')).toBe(false)
    expect(isValidISTDate('nope')).toBe(false)
  })
})
