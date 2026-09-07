// Golden-file fixture for the coach report (spec §8): Ramp weeks 1–2, 8 logged sessions (one short),
// one walk, one swap, one exercise note, two PR sets, two unrecorded sleep days, a stale export.
import type { ReportInput, ReportSession, ReportSetLog } from '../../report'
import type { ExerciseCfg, Verdict } from '../../types'
import { mkExercise } from '../fixtures'

const chest = mkExercise({ id: 'mcp', name: 'Machine Chest Press', loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'chest', credit: 1 }, { group: 'triceps', credit: 0.5 }, { group: 'front_delts', credit: 0.5 }] })
const landmine = mkExercise({ id: 'lm', name: 'Half-Kneeling Landmine Press', loadType: 'stack', unit: 'lb', increment: 5, unilateral: 'arm', muscles: [{ group: 'chest', credit: 0.5 }, { group: 'front_delts', credit: 0.5 }, { group: 'triceps', credit: 0.25 }] })
const pecFly = mkExercise({ id: 'pf', name: 'Pec Fly Machine', loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'chest', credit: 1 }] })
const pullUps = mkExercise({ id: 'pu', name: 'Pull-Ups (overhand, shoulder-width)', loadType: 'bodyweight', unit: 'lb', increment: null, muscles: [{ group: 'back', credit: 1 }, { group: 'biceps', credit: 0.5 }] })
const row = mkExercise({ id: 'row', name: 'Machine Chest-Supported Row', loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'back', credit: 1 }, { group: 'rear_delts_cuff', credit: 0.25 }, { group: 'biceps', credit: 0.5 }] })
const legPress = mkExercise({ id: 'lp', name: 'Leg Press', loadType: 'per_side', unit: 'lb', increment: 10, muscles: [{ group: 'quads', credit: 1 }, { group: 'glutes', credit: 0.5 }] })
const legCurl = mkExercise({ id: 'llc', name: 'Lying Leg Curl', loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'hamstrings', credit: 1 }] })
const triceps = mkExercise({ id: 'tri', name: 'Single-Arm Cable Overhead Triceps (rope)', loadType: 'stack', unit: 'kg', increment: 5, unilateral: 'arm', muscles: [{ group: 'triceps', credit: 1 }] })
const pushdown = mkExercise({ id: 'pd', name: 'Cable Tricep Pushdown (rope)', loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'triceps', credit: 1 }] })

export const reportExercises: ExerciseCfg[] = [chest, landmine, pecFly, pullUps, row, legPress, legCurl, triceps, pushdown]

const logs = (load: number, reps: (number | null)[], prAt: number[] = []): ReportSetLog[] =>
  reps.map((r, i) => ({ setIndex: i, load, reps: r, toFailure: r === null, isPr: prAt.includes(i) }))

interface ExSpec {
  exercise: ExerciseCfg
  lo: number
  hi: number
  logs: ReportSetLog[]
  verdict?: Verdict | null
  swappedFrom?: ExerciseCfg
  note?: string
}

let seq = 0
function session(
  date: string,
  templateName: string | null,
  opts: { type?: 'normal' | 'short' | 'walk'; min?: number; sleep?: boolean | null; sh?: number | null; el?: number | null; note?: string; source?: 'logged' | 'imported' },
  exercises: ExSpec[] = [],
): ReportSession {
  seq += 1
  return {
    id: `s${seq}`,
    date,
    startedAt: `${date}T02:00:00.000Z`,
    templateName,
    type: opts.type ?? 'normal',
    source: opts.source ?? 'logged',
    durationMin: opts.min ?? null,
    sleepGood: opts.sleep ?? null,
    shoulderPain: opts.sh ?? null,
    elbowPain: opts.el ?? null,
    note: opts.note ?? null,
    exercises: exercises.map((e, i) => ({
      orderIndex: i,
      exercise: e.exercise,
      swappedFrom: e.swappedFrom ?? null,
      sets: 2,
      lo: e.lo,
      hi: e.hi,
      verdict: e.verdict === undefined ? 'done' : e.verdict,
      note: e.note ?? null,
      setLogs: e.logs,
    })),
  }
}

export const reportInput: ReportInput = {
  from: '2026-09-07',
  to: '2026-09-20',
  today: '2026-09-21',
  ownerName: 'Rahul',
  program: {
    startDate: '2026-09-07',
    nextIndex: 2,
    easyWeekOverrides: [],
    templates: [
      { name: 'Push A', kind: 'push' }, { name: 'Pull A', kind: 'pull' }, { name: 'Legs A', kind: 'legs' },
      { name: 'Push B', kind: 'push' }, { name: 'Pull B', kind: 'pull' }, { name: 'Legs B', kind: 'legs' },
    ],
  },
  sessions: [
    session('2026-09-07', 'Push A', { min: 41, sleep: true, sh: 0, el: 0, note: 'felt easy, as planned.' }, [
      { exercise: chest, lo: 8, hi: 12, logs: logs(25, [12, 12]) },
      { exercise: landmine, lo: 8, hi: 12, logs: logs(10, [10, 10]) },
      { exercise: pecFly, lo: 10, hi: 12, logs: logs(20, [12, 12]) },
    ]),
    session('2026-09-08', 'Pull A', { min: 38, sleep: true, sh: 0, el: 0 }, [
      { exercise: pullUps, lo: 6, hi: 10, logs: logs(0, [6, 5]) },
      { exercise: row, lo: 10, hi: 12, logs: logs(60, [12, 12]) },
    ]),
    session('2026-09-09', 'Legs A', { min: 44, sleep: false, sh: 1, el: 0 }, [
      { exercise: legPress, lo: 10, hi: 15, logs: logs(160, [15, 15]) },
      { exercise: legCurl, lo: 10, hi: 15, logs: logs(35, [15, 15]) },
    ]),
    session('2026-09-11', 'Push B', { type: 'short', min: 24, sleep: true, sh: 1, el: 0 }, [
      { exercise: pecFly, lo: 10, hi: 12, logs: logs(20, [12, 12]) },
      { exercise: triceps, lo: 12, hi: 15, logs: logs(15, [15, 13]) },
    ]),
    session('2026-09-13', null, { type: 'walk', min: 22 }),
    session('2026-09-14', 'Pull B', { min: 40, sleep: true, sh: 0, el: 0 }, [
      { exercise: row, lo: 10, hi: 12, logs: logs(60, [12, 12]) },
      { exercise: pullUps, lo: 6, hi: 10, logs: logs(0, [7, 6]) },
    ]),
    session('2026-09-15', 'Push A', { min: 42, sleep: true, sh: 2, el: 0 }, [
      { exercise: chest, lo: 8, hi: 12, logs: logs(27, [12, 12]) },
      { exercise: landmine, lo: 8, hi: 12, logs: logs(10, [10, 10]) },
      { exercise: pushdown, lo: 12, hi: 15, logs: logs(15, [15, 15]), swappedFrom: triceps, note: 'overhead triceps pinched at set 2, swapped to rope pushdown.' },
    ]),
    session('2026-09-16', 'Legs A', { min: 45, sleep: true, sh: 1, el: 0 }, [
      { exercise: legPress, lo: 10, hi: 15, logs: logs(180, [15, 15], [0]) },
      { exercise: legCurl, lo: 10, hi: 15, logs: logs(35, [15, 15]) },
    ]),
    session('2026-09-18', 'Pull A', { min: 39, sleep: true, sh: 1, el: 0 }, [
      { exercise: pullUps, lo: 6, hi: 10, logs: logs(0, [9, 8], [0]) },
      { exercise: row, lo: 10, hi: 12, logs: logs(62, [12, 11]) },
    ]),
  ],
  bodyMetrics: [
    { date: '2026-09-05', weightKg: 73.2, waistCm: null, sleepGood: null, proteinHit: null, cardioType: null, cardioMin: null },
    { date: '2026-09-07', weightKg: 73.6, waistCm: 84, sleepGood: true, proteinHit: true, cardioType: null, cardioMin: null },
    { date: '2026-09-08', weightKg: 73.4, waistCm: null, sleepGood: true, proteinHit: true, cardioType: null, cardioMin: null },
    { date: '2026-09-09', weightKg: null, waistCm: null, sleepGood: false, proteinHit: false, cardioType: null, cardioMin: null },
    { date: '2026-09-10', weightKg: 73.5, waistCm: null, sleepGood: true, proteinHit: true, cardioType: null, cardioMin: null },
    { date: '2026-09-11', weightKg: 73.3, waistCm: null, sleepGood: true, proteinHit: true, cardioType: null, cardioMin: null },
    { date: '2026-09-12', weightKg: null, waistCm: null, sleepGood: true, proteinHit: null, cardioType: null, cardioMin: null },
    { date: '2026-09-13', weightKg: 73.4, waistCm: null, sleepGood: true, proteinHit: true, cardioType: 'Walk', cardioMin: 22 },
    { date: '2026-09-14', weightKg: 73.6, waistCm: null, sleepGood: true, proteinHit: true, cardioType: null, cardioMin: null },
    { date: '2026-09-15', weightKg: 73.8, waistCm: null, sleepGood: true, proteinHit: true, cardioType: null, cardioMin: null },
    { date: '2026-09-16', weightKg: 73.5, waistCm: null, sleepGood: true, proteinHit: false, cardioType: null, cardioMin: null },
    { date: '2026-09-18', weightKg: 73.7, waistCm: null, sleepGood: true, proteinHit: true, cardioType: null, cardioMin: null },
    { date: '2026-09-20', weightKg: 73.6, waistCm: null, sleepGood: false, proteinHit: true, cardioType: null, cardioMin: null },
  ],
  exportLog: [{ createdAt: '2026-08-27T10:00:00.000Z' }],
}
