'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db/client'
import { bodyMetric } from '@/db/schema'
import { AppError } from '@/lib/errors'
import { isValidISTDate, todayIST } from '@/lib/domain/time'

const weightSchema = z.object({ weightKg: z.number().min(20).max(300) })
const sleepSchema = z.object({ good: z.boolean() })

/** Upserts today's body_metric row (spec §6.2 quick entry). Direct action, not queued. */
export async function upsertTodayWeight(input: { weightKg: number }): Promise<{ date: string; weightKg: number }> {
  const parsed = weightSchema.safeParse(input)
  if (!parsed.success) throw new AppError('VALIDATION', 'Weight must be between 20 and 300 kg')
  const weightKg = Math.round(parsed.data.weightKg * 10) / 10
  const date = todayIST()
  const db = await getDb()
  await db
    .insert(bodyMetric)
    .values({ date, weightKg })
    .onConflictDoUpdate({ target: bodyMetric.date, set: { weightKg } })
  revalidatePath('/')
  return { date, weightKg }
}

export async function upsertTodaySleep(input: { good: boolean }): Promise<{ date: string; sleepGood: boolean }> {
  const parsed = sleepSchema.safeParse(input)
  if (!parsed.success) throw new AppError('VALIDATION', 'Invalid sleep value')
  const date = todayIST()
  const db = await getDb()
  await db
    .insert(bodyMetric)
    .values({ date, sleepGood: parsed.data.good })
    .onConflictDoUpdate({ target: bodyMetric.date, set: { sleepGood: parsed.data.good } })
  revalidatePath('/')
  return { date, sleepGood: parsed.data.good }
}

const metricSchema = z.object({
  date: z.string().refine(isValidISTDate, 'Invalid date'),
  weightKg: z.number().min(20).max(300).nullable().optional(),
  waistCm: z.number().min(30).max(200).nullable().optional(),
  sleepGood: z.boolean().nullable().optional(),
  proteinHit: z.boolean().nullable().optional(),
  cardioType: z.string().max(40).nullable().optional(),
  cardioMin: z.number().int().min(0).max(600).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
})

export type BodyMetricInput = z.input<typeof metricSchema>

/**
 * Partial upsert of one day's body_metric row (spec §6.6): only the fields present in `input`
 * change; `null` clears a field; missing fields are left alone.
 */
export async function upsertBodyMetric(input: BodyMetricInput): Promise<void> {
  const parsed = metricSchema.safeParse(input)
  if (!parsed.success) throw new AppError('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid entry')
  const d = parsed.data
  if (d.date > todayIST()) throw new AppError('VALIDATION', 'Cannot log a future date')
  const set: Partial<typeof bodyMetric.$inferInsert> = {}
  if (d.weightKg !== undefined) set.weightKg = d.weightKg === null ? null : Math.round(d.weightKg * 10) / 10
  if (d.waistCm !== undefined) set.waistCm = d.waistCm === null ? null : Math.round(d.waistCm * 10) / 10
  if (d.sleepGood !== undefined) set.sleepGood = d.sleepGood
  if (d.proteinHit !== undefined) set.proteinHit = d.proteinHit
  if (d.cardioType !== undefined) set.cardioType = d.cardioType?.trim() || null
  if (d.cardioMin !== undefined) set.cardioMin = d.cardioMin
  if (d.note !== undefined) set.note = d.note?.trim() || null
  const db = await getDb()
  if (Object.keys(set).length === 0) return
  await db
    .insert(bodyMetric)
    .values({ date: d.date, ...set })
    .onConflictDoUpdate({ target: bodyMetric.date, set })
  revalidatePath('/')
  revalidatePath('/body')
}
