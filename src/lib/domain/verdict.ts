// Verdicts and next-time notes (spec §7.5). Computed when an exercise's last set is logged and
// recomputed on any later edit; stored on session_exercise.verdict / next_note.
import { ASSIST_SWITCH_KG } from './goal'
import { fmtNum, formatLoad } from './load-format'
import { step } from './stepping'
import type { ExerciseCfg, Goal, GymCfg, LoggedSet, Mark, PhaseName, Verdict } from './types'

export interface VerdictInput {
  goal: Goal
  /** Live logged sets of this session_exercise, any order. */
  loggedSets: LoggedSet[]
  exercise: ExerciseCfg
  gym: GymCfg
  /** weekPhase(programWeek(session.date) + 1).name */
  nextWeekPhase: PhaseName
}

export interface VerdictResult {
  verdict: Verdict
  /** One entry per logged set, in setIndex order. */
  mark: Mark[]
  nextNote: string
  allHitHi: boolean
}

export const NOTE_SAME_WEIGHT = 'same weight next time'
export const NOTE_SAME_ASSIST = 'same assist next time'
export const NOTE_TRY_PULLUPS = 'next time: try Pull-Ups'
export const NOTE_EASY_CONTINUES = 'easy week continues'
export const NOTE_RAMP_CONTINUES = '2 sets again next week'
export const NOTE_BACK_TO_NORMAL = 'back to normal next week'

const byIndex = (sets: LoggedSet[]): LoggedSet[] => [...sets].sort((a, b) => a.setIndex - b.setIndex)

function targetAt(goal: Goal, i: number): number {
  const n = goal.repsPerSet.length
  const idx = Math.min(i, n - 1)
  return goal.repsPerSet[idx] ?? goal.prefillRepsPerSet[idx] ?? goal.hi
}

export function getVerdict({ goal, loggedSets, exercise, gym, nextWeekPhase }: VerdictInput): VerdictResult {
  const sets = byIndex(loggedSets)
  const counted = sets.filter((s) => s.reps !== null)
  const allHitHi = counted.length >= goal.sets && counted.every((s) => (s.reps as number) >= goal.hi)

  if (goal.setsOverride === 2) {
    const nextNote =
      nextWeekPhase === 'Easy' ? NOTE_EASY_CONTINUES : nextWeekPhase === 'Ramp' ? NOTE_RAMP_CONTINUES : NOTE_BACK_TO_NORMAL
    return { verdict: 'done', mark: sets.map(() => null), nextNote, allHitHi }
  }

  const isAssist = exercise.progression === 'assist_down'
  const firstLoad = sets.find((s) => s.load !== null)?.load ?? null
  const effectiveLoad = goal.load ?? firstLoad

  const goalTotal = goal.repsPerSet.reduce<number>((acc, r, i) => acc + (r ?? goal.prefillRepsPerSet[i] ?? goal.hi), 0)
  const total = counted
    .filter((s) => effectiveLoad !== null && s.load === effectiveLoad)
    .reduce((acc, s) => acc + (s.reps as number), 0)
  const betterLoad =
    effectiveLoad !== null &&
    sets.some((s) => s.load !== null && (isAssist ? s.load < effectiveLoad : s.load > effectiveLoad))

  const verdict: Verdict = betterLoad || total > goalTotal ? 'beat' : total === goalTotal ? 'matched' : 'under'

  const mark: Mark[] = sets.map((s, i) => {
    if (s.reps === null) return null
    const t = targetAt(goal, i)
    return s.reps > t ? 'up' : s.reps === t ? 'eq' : 'down'
  })

  let nextNote: string
  if (allHitHi && effectiveLoad !== null) {
    if (isAssist && effectiveLoad <= ASSIST_SWITCH_KG) nextNote = NOTE_TRY_PULLUPS
    else nextNote = `next time: ${formatLoad(exercise, step(exercise, effectiveLoad, gym))}`
  } else {
    nextNote = isAssist ? NOTE_SAME_ASSIST : NOTE_SAME_WEIGHT
  }

  return { verdict, mark, nextNote, allHitHi }
}

/** Per-row mark for the session UI (null in easy/Ramp mode or for a failure set). */
export function markFor(goal: Goal, setIndex: number, reps: number | null): Mark {
  if (goal.setsOverride === 2 || reps === null) return null
  const t = targetAt(goal, setIndex)
  return reps > t ? 'up' : reps === t ? 'eq' : 'down'
}

const VERB: Record<Verdict, string> = { beat: 'beat it', matched: 'matched', under: 'under', done: 'done' }

/** "27 kg × 12·10·9 — beat it · same weight next time" (spec §6.3). */
export function collapsedLine(exercise: ExerciseCfg, loggedSets: LoggedSet[], result: Pick<VerdictResult, 'verdict' | 'nextNote'>): string {
  const sets = byIndex(loggedSets)
  const groups: { load: number | null; reps: string[] }[] = []
  for (const s of sets) {
    const r = s.reps === null ? 'f' : fmtNum(s.reps)
    const last = groups[groups.length - 1]
    if (last && last.load === s.load) last.reps.push(r)
    else groups.push({ load: s.load, reps: [r] })
  }
  const body = groups.map((g) => `${g.load === null ? '—' : formatLoad(exercise, g.load)} × ${g.reps.join('·')}`).join(' · ')
  return `${body} — ${VERB[result.verdict]} · ${result.nextNote}`
}
