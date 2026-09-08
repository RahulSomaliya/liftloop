'use server'

import { and, eq, inArray, max, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db/client'
import { exercise, gymConfig, templateExercise } from '@/db/schema'
import { AppError } from '@/lib/errors'

// In-app program editor (spec §5.2, §2.3.6): rows are edited in place and stamped `edited_at` so the
// deploy-time seed leaves them alone; nothing referenced by history is ever deleted (archive instead).

const uuid = z.string().uuid()
const muscle = z.object({
  group: z.enum(['chest', 'back', 'side_delts', 'rear_delts_cuff', 'front_delts', 'quads', 'hamstrings', 'glutes', 'biceps', 'triceps', 'calves', 'abs']),
  credit: z.number().min(0.25).max(1),
})

const exerciseSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    aliases: z.array(z.string().trim().min(1).max(80)).max(10),
    loadType: z.enum(['per_side', 'stack', 'dumbbell', 'bodyweight']),
    unit: z.enum(['lb', 'kg']),
    barWeight: z.number().min(0).max(100).nullable(),
    increment: z.number().min(0.25).max(50).nullable(),
    progression: z.enum(['load_up', 'assist_down']),
    restSeconds: z.number().int().min(15).max(600),
    unilateral: z.enum(['arm', 'leg']).nullable(),
    muscles: z.array(muscle).min(1).max(6),
    swapIds: z.array(uuid).max(6),
    cue: z.string().trim().max(400).nullable(),
    defaultLo: z.number().int().min(1).max(100).nullable(),
    defaultHi: z.number().int().min(1).max(100).nullable(),
    defaultSets: z.number().int().min(1).max(10).nullable(),
  })
  .superRefine((v, ctx) => {
    const rack = v.loadType === 'dumbbell' || v.loadType === 'bodyweight'
    if (!rack && v.increment === null) ctx.addIssue({ code: 'custom', path: ['increment'], message: 'Stack and per-side exercises need an increment' })
    if (v.progression === 'assist_down' && (v.loadType !== 'stack' || v.increment === null)) ctx.addIssue({ code: 'custom', path: ['progression'], message: 'Assist exercises are stacks with an increment' })
    if (v.defaultLo !== null && v.defaultHi !== null && v.defaultLo > v.defaultHi) ctx.addIssue({ code: 'custom', path: ['defaultHi'], message: 'hi must be ≥ lo' })
  })

export type ExerciseInput = z.input<typeof exerciseSchema>

function firstIssue(e: z.ZodError): string {
  const i = e.issues[0]
  return i ? `${i.path.join('.') || 'input'}: ${i.message}` : 'Invalid input'
}

async function assertSwapsExist(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await getDb()
  const rows = await db.select({ id: exercise.id }).from(exercise).where(inArray(exercise.id, ids))
  if (rows.length !== new Set(ids).size) throw new AppError('VALIDATION', 'A swap points at an unknown exercise')
}

export async function updateExercise(input: { id: string; patch: ExerciseInput }): Promise<void> {
  const id = uuid.parse(input.id)
  const parsed = exerciseSchema.safeParse(input.patch)
  if (!parsed.success) throw new AppError('VALIDATION', firstIssue(parsed.error))
  const v = parsed.data
  if (v.swapIds.includes(id)) throw new AppError('VALIDATION', 'An exercise cannot swap to itself')
  await assertSwapsExist(v.swapIds)
  const db = await getDb()
  const [clash] = await db.select({ id: exercise.id }).from(exercise).where(and(eq(exercise.name, v.name), sql`${exercise.id} <> ${id}`)).limit(1)
  if (clash) throw new AppError('CONFLICT', 'Another exercise already has that name', 409)
  await db.update(exercise).set({ ...v, editedAt: new Date() }).where(eq(exercise.id, id))
  revalidatePath('/', 'layout')
}

export async function createExercise(input: ExerciseInput): Promise<{ id: string }> {
  const parsed = exerciseSchema.safeParse(input)
  if (!parsed.success) throw new AppError('VALIDATION', firstIssue(parsed.error))
  const v = parsed.data
  await assertSwapsExist(v.swapIds)
  const db = await getDb()
  const [clash] = await db.select({ id: exercise.id }).from(exercise).where(eq(exercise.name, v.name)).limit(1)
  if (clash) throw new AppError('CONFLICT', 'An exercise with that name already exists', 409)
  const [row] = await db.insert(exercise).values({ ...v, editedAt: new Date() }).returning({ id: exercise.id })
  revalidatePath('/', 'layout')
  return { id: row.id }
}

export async function setExerciseArchived(input: { id: string; archived: boolean }): Promise<void> {
  const id = uuid.parse(input.id)
  const db = await getDb()
  await db.update(exercise).set({ archived: !!input.archived, editedAt: new Date() }).where(eq(exercise.id, id))
  revalidatePath('/', 'layout')
}

const entrySchema = z
  .object({
    sets: z.number().int().min(1).max(10),
    lo: z.number().int().min(1).max(100),
    hi: z.number().int().min(1).max(100),
    restSeconds: z.number().int().min(15).max(600).nullable(),
    supersetGroup: z.number().int().min(1).max(20).nullable(),
    exerciseId: uuid,
  })
  .refine((v) => v.lo <= v.hi, { path: ['hi'], message: 'hi must be ≥ lo' })

export type TemplateEntryInput = z.input<typeof entrySchema>

export async function updateTemplateEntry(input: { id: string; patch: TemplateEntryInput }): Promise<void> {
  const id = uuid.parse(input.id)
  const parsed = entrySchema.safeParse(input.patch)
  if (!parsed.success) throw new AppError('VALIDATION', firstIssue(parsed.error))
  await assertSwapsExist([parsed.data.exerciseId])
  const db = await getDb()
  await db.update(templateExercise).set({ ...parsed.data, editedAt: new Date() }).where(eq(templateExercise.id, id))
  revalidatePath('/', 'layout')
}

/** Appends an entry using the exercise's editor defaults (falls back to 3 × 8–12). */
export async function addTemplateEntry(input: { templateId: string; exerciseId: string }): Promise<{ id: string }> {
  const templateId = uuid.parse(input.templateId)
  const exerciseId = uuid.parse(input.exerciseId)
  const db = await getDb()
  const [ex] = await db.select().from(exercise).where(eq(exercise.id, exerciseId)).limit(1)
  if (!ex) throw new AppError('NOT_FOUND', 'Exercise not found', 404)
  const [{ top }] = await db.select({ top: max(templateExercise.orderIndex) }).from(templateExercise).where(eq(templateExercise.templateId, templateId))
  const [row] = await db
    .insert(templateExercise)
    .values({ templateId, exerciseId, orderIndex: (top ?? -1) + 1, sets: ex.defaultSets ?? 3, lo: ex.defaultLo ?? 8, hi: ex.defaultHi ?? 12, editedAt: new Date() })
    .returning({ id: templateExercise.id })
  revalidatePath('/', 'layout')
  return { id: row.id }
}

export async function setTemplateEntryArchived(input: { id: string; archived: boolean }): Promise<void> {
  const id = uuid.parse(input.id)
  const db = await getDb()
  await db.update(templateExercise).set({ archived: !!input.archived, editedAt: new Date() }).where(eq(templateExercise.id, id))
  revalidatePath('/', 'layout')
}

/** Reorders a template's entries; two passes keep the (template_id, order_index) unique index happy. */
export async function reorderTemplateEntries(input: { templateId: string; ids: string[] }): Promise<void> {
  const templateId = uuid.parse(input.templateId)
  const ids = z.array(uuid).min(1).max(30).parse(input.ids)
  const db = await getDb()
  await db.transaction(async (tx) => {
    const rows = await tx.select({ id: templateExercise.id }).from(templateExercise).where(eq(templateExercise.templateId, templateId))
    const known = new Set(rows.map((r) => r.id))
    if (ids.length !== known.size || ids.some((id) => !known.has(id))) throw new AppError('VALIDATION', 'Reorder must list every entry of the template exactly once')
    for (let i = 0; i < ids.length; i += 1) await tx.update(templateExercise).set({ orderIndex: -1000 - i }).where(eq(templateExercise.id, ids[i]))
    for (let i = 0; i < ids.length; i += 1) await tx.update(templateExercise).set({ orderIndex: i, editedAt: new Date() }).where(eq(templateExercise.id, ids[i]))
  })
  revalidatePath('/', 'layout')
}

const gymSchema = z.object({
  platesLb: z.array(z.number().min(0.25).max(100)).min(1).max(20),
  dumbbellRackLb: z.array(z.number().min(0.5).max(300)).min(2).max(60),
  stackStepKg: z.number().min(0.5).max(20),
})

export type GymInput = z.input<typeof gymSchema>

export async function updateGymConfig(input: GymInput): Promise<void> {
  const parsed = gymSchema.safeParse(input)
  if (!parsed.success) throw new AppError('VALIDATION', firstIssue(parsed.error))
  const sortUnique = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b)
  const db = await getDb()
  await db
    .update(gymConfig)
    .set({ platesLb: sortUnique(parsed.data.platesLb), dumbbellRackLb: sortUnique(parsed.data.dumbbellRackLb), stackStepKg: parsed.data.stackStepKg, editedAt: new Date(), updatedAt: new Date() })
    .where(eq(gymConfig.id, 1))
  revalidatePath('/', 'layout')
}

// Settings → Rest timer (v1.2). Not seed-managed, so `edited_at` (the seed guard for plates) stays untouched.
const restSchema = z.object({ overrideSeconds: z.number().int().min(15).max(600).nullable(), ping: z.boolean() })

export type RestInput = z.input<typeof restSchema>

export async function updateRestPrefs(input: RestInput): Promise<void> {
  const parsed = restSchema.safeParse(input)
  if (!parsed.success) throw new AppError('VALIDATION', 'Rest must be between 15 and 600 seconds')
  const db = await getDb()
  await db.update(gymConfig).set({ restOverrideSeconds: parsed.data.overrideSeconds, restPing: parsed.data.ping, updatedAt: new Date() }).where(eq(gymConfig.id, 1))
  revalidatePath('/', 'layout')
}
