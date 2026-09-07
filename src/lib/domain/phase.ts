// Phase calculator (spec §2.2, §7.3). Per-date `getPhase` drives goals and verdicts; week-granular
// consumers (Home dots, report week labels, "next week" notes) use `weekPhase`, where a week is Easy
// if ANY of its dates is Easy — so a manual easy week started mid-week counts for the whole week.
import { addDaysIST, programWeek, weekBoundsIST, weekStartOf } from './time'
import type { PhaseInfo, PhaseName, ProgramCfg, WeekPhaseInfo } from './types'

export const PHASE_RULES: Record<PhaseName, { setsRule: string; rirRule: string; targetDays: number }> = {
  Ramp: { setsRule: '2 sets on every exercise', rirRule: '4 RIR', targetDays: 4 },
  'Build 1': { setsRule: 'as written', rirRule: '2–3 RIR', targetDays: 5 },
  Easy: { setsRule: '2 sets', rirRule: '4 RIR', targetDays: 4 },
  'Build 2': { setsRule: 'as written', rirRule: '1–3 RIR', targetDays: 5 },
}

/** Scheduled phase name for a program week (no overrides). */
export function scheduledPhaseName(week: number): PhaseName {
  if (week <= 2) return 'Ramp'
  if (week <= 6) return 'Build 1'
  if (week === 7) return 'Easy'
  return (week - 7) % 6 === 0 ? 'Easy' : 'Build 2'
}

function inOverride(date: string, program: ProgramCfg): boolean {
  return program.easyWeekOverrides.some((o) => o.from <= date && date <= o.to)
}

export function getPhase(date: string, program: ProgramCfg): PhaseInfo {
  const week = programWeek(date, program.startDate)
  const { weekStart, weekEnd } = weekBoundsIST(date)
  const manual = inOverride(date, program)
  const name: PhaseName = manual ? 'Easy' : scheduledPhaseName(week)
  const rules = PHASE_RULES[name]
  const reduced = name === 'Ramp' || name === 'Easy'
  return {
    name,
    week,
    targetDays: rules.targetDays,
    setsRule: rules.setsRule,
    rirRule: rules.rirRule,
    isEasyWeek: name === 'Easy',
    loadMultiplier: name === 'Easy' ? 0.8 : 1,
    setsOverride: reduced ? 2 : null,
    weekStart,
    weekEnd,
    source: manual ? 'manual' : 'schedule',
  }
}

/** Phase of a whole program week: Easy if any date in it is Easy, else the Monday's phase. */
export function weekPhase(week: number, program: ProgramCfg): WeekPhaseInfo {
  const weekStart = weekStartOf(Math.max(1, week), program.startDate)
  const weekEnd = addDaysIST(weekStart, 6)
  let anyEasy = false
  for (let i = 0; i < 7; i += 1) {
    if (getPhase(addDaysIST(weekStart, i), program).isEasyWeek) {
      anyEasy = true
      break
    }
  }
  const name: PhaseName = anyEasy ? 'Easy' : getPhase(weekStart, program).name
  return { name, week: Math.max(1, week), targetDays: PHASE_RULES[name].targetDays, isEasyWeek: name === 'Easy', weekStart, weekEnd }
}

export function weekPhaseForDate(date: string, program: ProgramCfg): WeekPhaseInfo {
  return weekPhase(programWeek(date, program.startDate), program)
}

/** The next Easy week starting after `date`'s week (manual override active today counts as current, not next). */
export function nextEasyWeek(date: string, program: ProgramCfg): { from: string; to: string } {
  const current = programWeek(date, program.startDate)
  for (let w = current + 1; w < current + 60; w += 1) {
    const wp = weekPhase(w, program)
    if (wp.isEasyWeek) return { from: wp.weekStart, to: wp.weekEnd }
  }
  // Unreachable with the schedule (every 6th week), kept for type completeness.
  const wp = weekPhase(current + 6, program)
  return { from: wp.weekStart, to: wp.weekEnd }
}

export { programWeek }
