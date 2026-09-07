// The one place a load becomes a string (spec §4.3). Goal lines, chips, collapsed rows, next-time
// notes and report cells all call this — never format a load inline anywhere else.
import type { ExerciseCfg } from './types'

export type LoadFormatCfg = Pick<ExerciseCfg, 'loadType' | 'unit' | 'progression'>

const MINUS = '−'

/** Number without trailing zeros: 27 → "27", 12.5 → "12.5", 2.50 → "2.5". */
export function fmtNum(n: number): string {
  const abs = Math.abs(n)
  const s = Number.isInteger(abs) ? String(abs) : String(Math.round(abs * 1000) / 1000)
  return n < 0 ? MINUS + s : s
}

export function formatLoad(ex: LoadFormatCfg, load: number | null): string {
  if (load === null || load === undefined) return ''
  if (ex.progression === 'assist_down') return `${fmtNum(load)} ${ex.unit} assist`
  switch (ex.loadType) {
    case 'bodyweight':
      if (load === 0) return 'BW'
      if (load > 0) return `BW +${fmtNum(load)} ${ex.unit}`
      return `${fmtNum(load)} ${ex.unit}`
    case 'per_side':
      return `${fmtNum(load)} ${ex.unit}/side`
    default:
      return `${fmtNum(load)} ${ex.unit}`
  }
}
