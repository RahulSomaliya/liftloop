'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db/client'
import { bodyMetric } from '@/db/schema'
import { AppError } from '@/lib/errors'
import { todayIST } from '@/lib/domain/time'

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
