// Every "today" / "this week" computation in the app goes through here with Asia/Kolkata (spec §1,
// §7.10). Never use server-local Date math elsewhere: Vercel functions run in UTC, and 1:30 IST is
// still "yesterday" in UTC, which would put a session on the wrong day.
import { TZDate } from '@date-fns/tz'
import { addDays, differenceInCalendarDays, endOfWeek, format, startOfWeek } from 'date-fns'

export const IST = 'Asia/Kolkata'

const fmt = (d: Date): string => format(d, 'yyyy-MM-dd')

function parts(date: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) throw new Error(`Invalid IST date string: ${date}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** Midnight of an IST date, as a zoned date usable with date-fns. */
export function tzDate(date: string): TZDate {
  const [y, m, d] = parts(date)
  return new TZDate(y, m - 1, d, IST)
}

/** The IST calendar date of an instant. */
export function istDate(instant: Date): string {
  return fmt(new TZDate(instant, IST))
}

export function todayIST(now: Date = new Date()): string {
  return istDate(now)
}

export function addDaysIST(date: string, days: number): string {
  return fmt(addDays(tzDate(date), days))
}

/** Monday–Sunday bounds of the IST week containing `date`. */
export function weekBoundsIST(date: string): { weekStart: string; weekEnd: string } {
  const d = tzDate(date)
  return {
    weekStart: fmt(startOfWeek(d, { weekStartsOn: 1 })),
    weekEnd: fmt(endOfWeek(d, { weekStartsOn: 1 })),
  }
}

/** b − a in calendar days. */
export function daysBetween(a: string, b: string): number {
  return differenceInCalendarDays(tzDate(b), tzDate(a))
}

/** 1-based program week; week 1 starts on the start date's Monday. Dates before the start → 1. */
export function programWeek(date: string, startDate: string): number {
  const start = weekBoundsIST(startDate).weekStart
  return Math.max(1, Math.floor(daysBetween(start, date) / 7) + 1)
}

/** Monday of program week `week` (1-based). */
export function weekStartOf(week: number, startDate: string): string {
  const start = weekBoundsIST(startDate).weekStart
  return addDaysIST(start, (week - 1) * 7)
}

export function weekdayShort(date: string): string {
  return format(tzDate(date), 'EEE')
}

/** 12:00 IST on `date`, as an instant (used for imported sessions). */
export function istMidday(date: string): Date {
  const [y, m, d] = parts(date)
  return new Date(new TZDate(y, m - 1, d, 12, 0, 0, IST).getTime())
}

export function isValidISTDate(date: string): boolean {
  try {
    const [y, m, d] = parts(date)
    const t = tzDate(date)
    return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d
  } catch {
    return false
  }
}
