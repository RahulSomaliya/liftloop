// Drizzle schema (spec §9). Timestamps are UTC instants; logical dates are IST date strings.
// "Live" = deleted_at IS NULL on session and set_log; session_exercise inherits from its session.
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import type { Goal, MuscleGroup } from '@/lib/domain/types'

export const loadTypeEnum = pgEnum('load_type', ['per_side', 'stack', 'dumbbell', 'bodyweight'])
export const unitEnum = pgEnum('unit', ['lb', 'kg'])
export const progressionEnum = pgEnum('progression', ['load_up', 'assist_down'])
export const templateKindEnum = pgEnum('template_kind', ['push', 'pull', 'legs'])
export const sessionTypeEnum = pgEnum('session_type', ['normal', 'short', 'walk'])
export const sessionSourceEnum = pgEnum('session_source', ['logged', 'imported'])
export const verdictEnum = pgEnum('verdict', ['beat', 'matched', 'under', 'done'])

const load = (name: string) => numeric(name, { precision: 8, scale: 2, mode: 'number' })
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' })

export const exercise = pgTable('exercise', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  aliases: text('aliases').array().notNull().default([]),
  loadType: loadTypeEnum('load_type').notNull(),
  unit: unitEnum('unit').notNull(),
  barWeight: load('bar_weight'),
  /** null → rack-ladder stepping. Always a positive magnitude. */
  increment: load('increment'),
  progression: progressionEnum('progression').notNull().default('load_up'),
  restSeconds: smallint('rest_seconds').notNull().default(90),
  unilateral: text('unilateral', { enum: ['arm', 'leg'] }),
  muscles: jsonb('muscles').$type<{ group: MuscleGroup; credit: number }[]>().notNull().default([]),
  swapIds: uuid('swap_ids').array().notNull().default([]),
  cue: text('cue'),
  notes: text('notes'),
  archived: boolean('archived').notNull().default(false),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const gymConfig = pgTable('gym_config', {
  id: integer('id').primaryKey(),
  platesLb: jsonb('plates_lb').$type<number[]>().notNull(),
  dumbbellRackLb: jsonb('dumbbell_rack_lb').$type<number[]>().notNull(),
  stackStepKg: load('stack_step_kg').notNull(),
  updatedAt: ts('updated_at').notNull().defaultNow(),
})

export const program = pgTable('program', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  version: integer('version').notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  nextIndex: integer('next_index').notNull().default(0),
  easyWeekOverrides: jsonb('easy_week_overrides').$type<{ from: string; to: string }[]>().notNull().default([]),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const template = pgTable(
  'template',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    programId: uuid('program_id').notNull().references(() => program.id),
    name: text('name').notNull(),
    kind: templateKindEnum('kind').notNull(),
    orderIndex: smallint('order_index').notNull(),
    notes: text('notes'),
  },
  (t) => [uniqueIndex('template_program_order_uq').on(t.programId, t.orderIndex)],
)

export const templateExercise = pgTable(
  'template_exercise',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id').notNull().references(() => template.id),
    exerciseId: uuid('exercise_id').notNull().references(() => exercise.id),
    orderIndex: smallint('order_index').notNull(),
    sets: smallint('sets').notNull(),
    lo: smallint('lo').notNull(),
    hi: smallint('hi').notNull(),
    /** Overrides exercise.rest_seconds for this slot (seed: 120 at order_index 0). */
    restSeconds: smallint('rest_seconds'),
    supersetGroup: smallint('superset_group'),
    notes: text('notes'),
  },
  (t) => [uniqueIndex('template_exercise_order_uq').on(t.templateId, t.orderIndex)],
)

export const session = pgTable(
  'session',
  {
    /** Client-supplied for logged sessions (idempotent Start); defaulted for imports/tests. */
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date', { mode: 'string' }).notNull(),
    startedAt: ts('started_at').notNull(),
    /** null = in progress */
    finishedAt: ts('finished_at'),
    templateId: uuid('template_id').references(() => template.id),
    type: sessionTypeEnum('type').notNull().default('normal'),
    source: sessionSourceEnum('source').notNull().default('logged'),
    durationMin: smallint('duration_min'),
    sleepGood: boolean('sleep_good'),
    shoulderPain: smallint('shoulder_pain'),
    elbowPain: smallint('elbow_pain'),
    advancedLoop: boolean('advanced_loop').notNull().default(true),
    note: text('note'),
    deletedAt: ts('deleted_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [index('session_date_idx').on(t.date)],
)

export const sessionExercise = pgTable(
  'session_exercise',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id').notNull().references(() => session.id),
    exerciseId: uuid('exercise_id').notNull().references(() => exercise.id),
    templateExerciseId: uuid('template_exercise_id').references(() => templateExercise.id),
    orderIndex: smallint('order_index').notNull(),
    /** Effective set count the session prescribed: goal.sets for logged rows, header sets for imports. */
    sets: smallint('sets').notNull(),
    lo: smallint('lo'),
    hi: smallint('hi'),
    /** The §7.4 Goal as shown; null for imported rows. */
    goal: jsonb('goal').$type<Goal>(),
    verdict: verdictEnum('verdict'),
    nextNote: text('next_note'),
    swappedFromExerciseId: uuid('swapped_from_exercise_id').references(() => exercise.id),
    note: text('note'),
    createdAt: ts('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('session_exercise_order_uq').on(t.sessionId, t.orderIndex),
    index('session_exercise_exercise_idx').on(t.exerciseId, t.createdAt),
  ],
)

export const setLog = pgTable(
  'set_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionExerciseId: uuid('session_exercise_id').notNull().references(() => sessionExercise.id),
    setIndex: smallint('set_index').notNull(),
    /** Guarded upsert: a write applies only when its rev is greater than the stored rev (§11.2). */
    rev: integer('rev').notNull().default(1),
    load: load('load'),
    reps: smallint('reps'),
    toFailure: boolean('to_failure').notNull().default(false),
    unit: unitEnum('unit').notNull(),
    isPr: boolean('is_pr').notNull().default(false),
    deletedAt: ts('deleted_at'),
    createdAt: ts('created_at').notNull().defaultNow(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('set_log_slot_uq').on(t.sessionExerciseId, t.setIndex), index('set_log_session_exercise_idx').on(t.sessionExerciseId)],
)

export const bodyMetric = pgTable(
  'body_metric',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date', { mode: 'string' }).notNull().unique(),
    weightKg: numeric('weight_kg', { precision: 5, scale: 1, mode: 'number' }),
    waistCm: numeric('waist_cm', { precision: 5, scale: 1, mode: 'number' }),
    sleepGood: boolean('sleep_good'),
    proteinHit: boolean('protein_hit'),
    cardioType: text('cardio_type'),
    cardioMin: smallint('cardio_min'),
    note: text('note'),
  },
  (t) => [index('body_metric_date_idx').on(t.date)],
)

export const exportLog = pgTable('export_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromDate: date('from_date', { mode: 'string' }).notNull(),
  toDate: date('to_date', { mode: 'string' }).notNull(),
  createdAt: ts('created_at').notNull().defaultNow(),
})

export const loginAttempt = pgTable(
  'login_attempt',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    attemptedAt: ts('attempted_at').notNull().defaultNow(),
    success: boolean('success').notNull(),
    ip: text('ip'),
  },
  (t) => [index('login_attempt_at_idx').on(t.attemptedAt)],
)
