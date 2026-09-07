'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { getDb } from '@/db/client'
import { loadProgram } from '@/db/queries/home'
import { program } from '@/db/schema'
import { addDaysIST, todayIST, weekBoundsIST } from '@/lib/domain/time'

/** "Start easy week now" (spec §2.2): a manual override from today to this week's Sunday. */
export async function startEasyWeek(): Promise<{ from: string; to: string }> {
  const today = todayIST()
  const db = await getDb()
  const prog = await loadProgram(db)
  const active = prog.easyWeekOverrides.find((o) => o.from <= today && today <= o.to)
  if (active) return active
  const next = { from: today, to: weekBoundsIST(today).weekEnd }
  await db.update(program).set({ easyWeekOverrides: [...prog.easyWeekOverrides, next] }).where(eq(program.id, prog.id))
  revalidatePath('/')
  return next
}

/** "End easy week" early: the active override ends yesterday (or is removed if it started today). */
export async function endEasyWeek(): Promise<void> {
  const today = todayIST()
  const db = await getDb()
  const prog = await loadProgram(db)
  const overrides = prog.easyWeekOverrides
    .map((o) => (o.from <= today && today <= o.to ? { ...o, to: addDaysIST(today, -1) } : o))
    .filter((o) => o.from <= o.to)
  await db.update(program).set({ easyWeekOverrides: overrides }).where(eq(program.id, prog.id))
  revalidatePath('/')
}
