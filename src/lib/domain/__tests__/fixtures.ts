import type { ExerciseCfg, GymCfg, PhaseInfo, ProgramCfg } from '../types'

export const gym: GymCfg = {
  platesLb: [2.5, 5, 10, 22, 25, 35, 45],
  dumbbellRackLb: [2.5, 5, 7, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40, 45, 50, 60],
  stackStepKg: 5,
}

export const program: ProgramCfg = { startDate: '2026-09-07', nextIndex: 0, easyWeekOverrides: [] }

let n = 0
export function mkExercise(over: Partial<ExerciseCfg> = {}): ExerciseCfg {
  n += 1
  return {
    id: over.id ?? `ex-${n}`,
    name: over.name ?? `Exercise ${n}`,
    aliases: [],
    loadType: 'stack',
    unit: 'kg',
    barWeight: null,
    increment: 5,
    progression: 'load_up',
    restSeconds: 90,
    unilateral: null,
    muscles: [{ group: 'chest', credit: 1 }],
    swapIds: [],
    cue: null,
    ...over,
  }
}

export const stackKg = mkExercise({ name: 'Machine Chest Press', loadType: 'stack', unit: 'kg', increment: 5 })
export const landmineLb = mkExercise({ name: 'Half-Kneeling Landmine Press', loadType: 'stack', unit: 'lb', increment: 5, unilateral: 'arm' })
export const perSideRdl = mkExercise({ name: 'Barbell RDL', loadType: 'per_side', unit: 'lb', increment: 2.5, barWeight: 45 })
export const perSideLegPress = mkExercise({ name: 'Leg Press', loadType: 'per_side', unit: 'lb', increment: 10 })
export const db = mkExercise({ name: 'Incline DB Curl', loadType: 'dumbbell', unit: 'lb', increment: null })
export const bw = mkExercise({ name: 'Pull-Ups (overhand, shoulder-width)', loadType: 'bodyweight', unit: 'lb', increment: null })
export const assist = mkExercise({ name: 'Assisted Pull-Up Machine', loadType: 'stack', unit: 'kg', increment: 5, progression: 'assist_down' })

export const rampPhase: PhaseInfo = {
  name: 'Ramp', week: 1, targetDays: 4, setsRule: '2 sets on every exercise', rirRule: '4 RIR',
  isEasyWeek: false, loadMultiplier: 1, setsOverride: 2, weekStart: '2026-09-07', weekEnd: '2026-09-13', source: 'schedule',
}
export const buildPhase: PhaseInfo = {
  name: 'Build 1', week: 3, targetDays: 5, setsRule: 'as written', rirRule: '2–3 RIR',
  isEasyWeek: false, loadMultiplier: 1, setsOverride: null, weekStart: '2026-09-21', weekEnd: '2026-09-27', source: 'schedule',
}
export const easyPhase: PhaseInfo = {
  name: 'Easy', week: 7, targetDays: 4, setsRule: '2 sets', rirRule: '4 RIR',
  isEasyWeek: true, loadMultiplier: 0.8, setsOverride: 2, weekStart: '2026-10-19', weekEnd: '2026-10-25', source: 'schedule',
}
