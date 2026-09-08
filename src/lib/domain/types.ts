// Shared domain types (spec §7, §9). Pure data — no DB types leak in here.

export type LoadType = 'per_side' | 'stack' | 'dumbbell' | 'bodyweight'
export type Unit = 'lb' | 'kg'
export type Progression = 'load_up' | 'assist_down'
export type Unilateral = 'arm' | 'leg' | null
export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'side_delts'
  | 'rear_delts_cuff'
  | 'front_delts'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'biceps'
  | 'triceps'
  | 'calves'
  | 'abs'
export type Verdict = 'beat' | 'matched' | 'under' | 'done'
export type Mark = 'up' | 'eq' | 'down' | null
export type SessionType = 'normal' | 'short' | 'walk'
export type SessionSource = 'logged' | 'imported'
export type TemplateKind = 'push' | 'pull' | 'legs'

export interface ExerciseCfg {
  id: string
  name: string
  aliases: string[]
  loadType: LoadType
  unit: Unit
  barWeight: number | null
  /** null → rack-ladder stepping (dumbbell / bodyweight-added). Always a positive magnitude. */
  increment: number | null
  progression: Progression
  restSeconds: number
  unilateral: Unilateral
  muscles: { group: MuscleGroup; credit: number }[]
  swapIds: string[]
  cue: string | null
}

export interface GymCfg {
  platesLb: number[]
  dumbbellRackLb: number[]
  stackStepKg: number
}

/** Settings → Rest timer (v1.2). `overrideSeconds` null = the program's per-exercise rest. */
export interface RestPrefs {
  overrideSeconds: number | null
  ping: boolean
}

export interface TemplateEntry {
  sets: number
  lo: number
  hi: number
}

export interface LoggedSet {
  setIndex: number
  load: number | null
  reps: number | null
  toFailure: boolean
}

/** One past session_exercise of an exercise, with its live sets. */
export interface HistoryEntry {
  sessionDate: string
  createdAt: string
  goal: Goal | null
  sets: LoggedSet[]
}

export type GoalMode = 'first_time' | 'beat' | 'new_weight' | 'easy'

export interface Goal {
  mode: GoalMode
  /** The weight to lift THIS session (chips bind here). null only in first_time. */
  load: number | null
  unit: Unit
  /** entry.sets, or 2 when the phase has setsOverride 2 (Ramp / Easy). */
  sets: number
  lo: number
  hi: number
  /** Goal reps per set; null = last time's set was a failure set. */
  repsPerSet: (number | null)[]
  /** What the reps chips show. */
  prefillRepsPerSet: number[]
  /** The ONE goal line. */
  line: string
  /** Last time, for ghost text. */
  ghost: { load: number; reps: (number | null)[] } | null
  /** step(load): the next load up after this session. */
  nextLoad: number | null
  setsOverride: 2 | null
  /** phase.loadMultiplier === 0.8 at snapshot time (easy week). */
  deload: boolean
}

export type PhaseName = 'Ramp' | 'Build 1' | 'Easy' | 'Build 2'

export interface PhaseInfo {
  name: PhaseName
  week: number
  targetDays: number
  setsRule: string
  rirRule: string
  isEasyWeek: boolean
  loadMultiplier: 1 | 0.8
  setsOverride: 2 | null
  weekStart: string
  weekEnd: string
  source: 'schedule' | 'manual'
}

export interface WeekPhaseInfo {
  name: PhaseName
  week: number
  targetDays: number
  isEasyWeek: boolean
  weekStart: string
  weekEnd: string
}

export interface ProgramCfg {
  startDate: string
  nextIndex: number
  easyWeekOverrides: { from: string; to: string }[]
}
