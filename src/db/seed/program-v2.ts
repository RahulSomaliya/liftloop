// Program v2 seed data (spec §13). Public: no personal data here. Edit this file (and re-run
// `pnpm db:seed`) to change the program until the v1.1 in-app editor ships. Re-seeding upserts
// definitional columns only and never touches sessions, set logs or the loop pointer.
import type { LoadType, MuscleGroup, Progression, TemplateKind, Unilateral, Unit } from '@/lib/domain/types'

export interface SeedExercise {
  name: string
  aliases?: string[]
  loadType: LoadType
  unit: Unit
  /** null → rack-ladder stepping */
  increment: number | null
  barWeight?: number
  unilateral?: Unilateral
  progression?: Progression
  muscles: { group: MuscleGroup; credit: number }[]
  swaps?: string[]
  cue?: string
  notes?: string
}

export interface SeedTemplate {
  name: string
  kind: TemplateKind
  entries: { exercise: string; sets: number; lo: number; hi: number; supersetWithPrevious?: boolean }[]
}

export const PROGRAM_V2 = {
  program: { name: 'Program v2', version: 2, startDate: '2026-09-07' },
  gym: {
    platesLb: [2.5, 5, 10, 22, 25, 35, 45],
    dumbbellRackLb: [2.5, 5, 7, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40, 45, 50, 60],
    stackStepKg: 5,
  },
  restSecondsDefault: 90,
  restSecondsFirstExercise: 120,
  warmup: [
    'Bike/treadmill 2 min',
    'Cable Face Pull very light × 15',
    'Sidelying DB External Rotation, lightest DB × 12',
    'Ramp-up sets of the first exercise at ~50% × 8 and ~75% × 4',
  ],
  exercises: [
    { name: 'Machine Chest Press', loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'chest', credit: 1 }, { group: 'triceps', credit: 0.5 }, { group: 'front_delts', credit: 0.5 }], swaps: ['Pec Fly Machine'] },
    { name: 'Half-Kneeling Landmine Press', aliases: ['Landmine Press'], loadType: 'stack', unit: 'lb', increment: 5, unilateral: 'arm', muscles: [{ group: 'chest', credit: 0.5 }, { group: 'front_delts', credit: 0.5 }, { group: 'triceps', credit: 0.25 }], swaps: ['Low-Incline DB Press (15-30°)'], notes: 'Load = plates on the sleeve; the bar is not counted.' },
    { name: 'Pec Fly Machine', aliases: ['Pec Deck'], loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'chest', credit: 1 }] },
    { name: 'Low-Incline DB Press (15-30°)', loadType: 'dumbbell', unit: 'lb', increment: null, muscles: [{ group: 'chest', credit: 1 }, { group: 'front_delts', credit: 0.5 }, { group: 'triceps', credit: 0.5 }], swaps: ['Machine Chest Press'] },
    { name: 'Cable Lateral Raise', aliases: ['Lateral Raise'], loadType: 'stack', unit: 'kg', increment: 5, unilateral: 'arm', muscles: [{ group: 'side_delts', credit: 1 }] },
    { name: 'Single-Arm Cable Overhead Triceps (rope)', loadType: 'stack', unit: 'kg', increment: 5, unilateral: 'arm', muscles: [{ group: 'triceps', credit: 1 }], swaps: ['Cable Tricep Pushdown (rope)'] },
    { name: 'Cable Tricep Pushdown (rope)', loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'triceps', credit: 1 }] },
    { name: 'Sidelying DB External Rotation', aliases: ['External Rotation (L arm first)'], loadType: 'dumbbell', unit: 'lb', increment: null, unilateral: 'arm', muscles: [{ group: 'rear_delts_cuff', credit: 1 }] },
    { name: 'Pull-Ups (overhand, shoulder-width)', aliases: ['Pull ups'], loadType: 'bodyweight', unit: 'lb', increment: null, muscles: [{ group: 'back', credit: 1 }, { group: 'biceps', credit: 0.5 }], swaps: ['Assisted Pull-Up Machine', 'Lat Pulldown (Front, Medium Grip)'], cue: "Target 6–10 reps. < 6 → swap to the Assisted Pull-Up Machine. 10 on all sets → add weight (next dumbbell, held between the feet). Shoulder blades down first. Don't hang loose at the bottom." },
    { name: 'Pull-Ups (neutral grip)', loadType: 'bodyweight', unit: 'lb', increment: null, muscles: [{ group: 'back', credit: 1 }, { group: 'biceps', credit: 0.5 }], swaps: ['Assisted Pull-Up Machine', 'Lat Pulldown (Neutral Grip)'], cue: "Target 6–10 reps. < 6 → swap to the Assisted Pull-Up Machine. 10 on all sets → add weight (next dumbbell, held between the feet). Shoulder blades down first. Don't hang loose at the bottom." },
    { name: 'Assisted Pull-Up Machine', loadType: 'stack', unit: 'kg', increment: 5, progression: 'assist_down', muscles: [{ group: 'back', credit: 1 }, { group: 'biceps', credit: 0.5 }], cue: 'Load = assist. At 10 reps on all sets with ≤ 10 kg assist, try Pull-Ups.' },
    { name: 'Lat Pulldown (Front, Medium Grip)', aliases: ['2 Grip Lat Pulldown'], loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'back', credit: 1 }, { group: 'biceps', credit: 0.5 }] },
    { name: 'Lat Pulldown (Neutral Grip)', loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'back', credit: 1 }, { group: 'biceps', credit: 0.5 }] },
    { name: 'Machine Chest-Supported Row', aliases: ['Chest-supported Row'], loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'back', credit: 1 }, { group: 'rear_delts_cuff', credit: 0.25 }, { group: 'biceps', credit: 0.5 }], swaps: ['Seated Cable Row (Close Grip)'] },
    { name: 'Seated Cable Row (Close Grip)', loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'back', credit: 1 }, { group: 'rear_delts_cuff', credit: 0.25 }, { group: 'biceps', credit: 0.5 }] },
    { name: 'Cable Face Pull', loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'rear_delts_cuff', credit: 1 }] },
    { name: 'Cable Reverse Fly', aliases: ['Reverse pec deck'], loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'rear_delts_cuff', credit: 1 }] },
    { name: 'Incline DB Curl', loadType: 'dumbbell', unit: 'lb', increment: null, muscles: [{ group: 'biceps', credit: 1 }] },
    { name: 'Hammer Curls', loadType: 'dumbbell', unit: 'lb', increment: null, muscles: [{ group: 'biceps', credit: 1 }] },
    { name: 'Cable Crunch', aliases: ['Crunch'], loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'abs', credit: 1 }] },
    { name: 'Leg Press', loadType: 'per_side', unit: 'lb', increment: 10, muscles: [{ group: 'quads', credit: 1 }, { group: 'glutes', credit: 0.5 }], notes: 'Plate-loaded; load = plates per side.' },
    { name: 'Single-Leg Leg Press', loadType: 'per_side', unit: 'lb', increment: 5, unilateral: 'leg', muscles: [{ group: 'quads', credit: 1 }, { group: 'glutes', credit: 0.5 }], swaps: ['Reverse Lunge (DB)'] },
    { name: 'Leg Extension', loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'quads', credit: 1 }] },
    { name: 'Lying Leg Curl', loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'hamstrings', credit: 1 }] },
    { name: 'Seated Leg Curl', loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'hamstrings', credit: 1 }] },
    { name: 'Barbell RDL', aliases: ['RDL'], loadType: 'per_side', unit: 'lb', increment: 2.5, barWeight: 45, muscles: [{ group: 'hamstrings', credit: 1 }, { group: 'glutes', credit: 0.5 }, { group: 'back', credit: 0.25 }] },
    { name: 'Seated Calf Raise', loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'calves', credit: 1 }] },
    { name: 'Standing Calf Raise', loadType: 'stack', unit: 'kg', increment: 5, muscles: [{ group: 'calves', credit: 1 }], swaps: ['Standing BW Calf Raise'] },
    { name: 'Standing BW Calf Raise', aliases: ['Standing bw Calf Raise'], loadType: 'bodyweight', unit: 'lb', increment: null, muscles: [{ group: 'calves', credit: 1 }] },
    { name: 'Reverse Lunge (DB)', loadType: 'dumbbell', unit: 'lb', increment: null, unilateral: 'leg', muscles: [{ group: 'quads', credit: 1 }, { group: 'glutes', credit: 0.5 }] },
  ] as SeedExercise[],
  templates: [
    { name: 'Push A', kind: 'push', entries: [
      { exercise: 'Machine Chest Press', sets: 3, lo: 8, hi: 12 },
      { exercise: 'Half-Kneeling Landmine Press', sets: 3, lo: 8, hi: 12 },
      { exercise: 'Pec Fly Machine', sets: 2, lo: 10, hi: 12 },
      { exercise: 'Cable Lateral Raise', sets: 3, lo: 12, hi: 15 },
      { exercise: 'Single-Arm Cable Overhead Triceps (rope)', sets: 2, lo: 12, hi: 15 },
      { exercise: 'Sidelying DB External Rotation', sets: 2, lo: 15, hi: 15, supersetWithPrevious: true },
    ] },
    { name: 'Pull A', kind: 'pull', entries: [
      { exercise: 'Pull-Ups (overhand, shoulder-width)', sets: 3, lo: 6, hi: 10 },
      { exercise: 'Machine Chest-Supported Row', sets: 3, lo: 10, hi: 12 },
      { exercise: 'Lat Pulldown (Front, Medium Grip)', sets: 2, lo: 10, hi: 12 },
      { exercise: 'Cable Face Pull', sets: 2, lo: 15, hi: 20 },
      { exercise: 'Incline DB Curl', sets: 3, lo: 10, hi: 12 },
      { exercise: 'Cable Crunch', sets: 2, lo: 12, hi: 15, supersetWithPrevious: true },
    ] },
    { name: 'Legs A', kind: 'legs', entries: [
      { exercise: 'Leg Press', sets: 3, lo: 10, hi: 15 },
      { exercise: 'Lying Leg Curl', sets: 3, lo: 10, hi: 15 },
      { exercise: 'Single-Leg Leg Press', sets: 2, lo: 10, hi: 12 },
      { exercise: 'Leg Extension', sets: 2, lo: 12, hi: 15 },
      { exercise: 'Seated Calf Raise', sets: 3, lo: 15, hi: 20 },
    ] },
    { name: 'Push B', kind: 'push', entries: [
      { exercise: 'Low-Incline DB Press (15-30°)', sets: 3, lo: 8, hi: 12 },
      { exercise: 'Pec Fly Machine', sets: 3, lo: 10, hi: 12 },
      { exercise: 'Cable Lateral Raise', sets: 3, lo: 12, hi: 15 },
      { exercise: 'Single-Arm Cable Overhead Triceps (rope)', sets: 3, lo: 12, hi: 15 },
      { exercise: 'Sidelying DB External Rotation', sets: 2, lo: 15, hi: 15, supersetWithPrevious: true },
    ] },
    { name: 'Pull B', kind: 'pull', entries: [
      { exercise: 'Seated Cable Row (Close Grip)', sets: 3, lo: 10, hi: 12 },
      { exercise: 'Pull-Ups (neutral grip)', sets: 3, lo: 6, hi: 10 },
      { exercise: 'Cable Reverse Fly', sets: 2, lo: 15, hi: 20 },
      { exercise: 'Hammer Curls', sets: 3, lo: 10, hi: 12 },
      { exercise: 'Cable Lateral Raise', sets: 2, lo: 12, hi: 15 },
    ] },
    { name: 'Legs B', kind: 'legs', entries: [
      { exercise: 'Barbell RDL', sets: 3, lo: 8, hi: 10 },
      { exercise: 'Leg Press', sets: 2, lo: 12, hi: 15 },
      { exercise: 'Seated Leg Curl', sets: 3, lo: 10, hi: 15 },
      { exercise: 'Leg Extension', sets: 2, lo: 12, hi: 15 },
      { exercise: 'Cable Crunch', sets: 2, lo: 12, hi: 15, supersetWithPrevious: true },
      { exercise: 'Standing Calf Raise', sets: 2, lo: 12, hi: 15 },
    ] },
  ] as SeedTemplate[],
}
