'use server'

import { and, eq, inArray, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db/client'
import { loadExerciseCfgs } from '@/db/queries/session'
import { recomputePrs } from '@/db/recompute'
import { session, sessionExercise, setLog, template } from '@/db/schema'
import { isValidISTDate, istMidday, todayIST } from '@/lib/domain/time'
import { AppError } from '@/lib/errors'

const segment = z.object({
  load: z.number().min(-500).max(2000),
  sets: z.array(z.object({ reps: z.number().int().min(0).max(200).nullable(), toFailure: z.boolean() })).min(1).max(20),
})
const entry = z.object({
  exerciseId: z.string().uuid(),
  lo: z.number().int().min(1).max(100).nullable(),
  hi: z.number().int().min(1).max(100).nullable(),
  sets: z.number().int().min(1).max(20),
  segments: z.array(segment).min(1).max(10),
})
const group = z.object({
  date: z.string().refine(isValidISTDate, 'Invalid date'),
  templateName: z.string().max(40).nullable(),
  entries: z.array(entry).min(1).max(40),
})
const schema = z.object({ groups: z.array(group).min(1).max(60) })

export type ImportInput = z.input<typeof schema>

/**
 * Notes-text import (spec §5.3): one imported session per date. Refuses any date that already
 * has a live session (the preview asks the user to re-date). Imported rows carry no goal or
 * verdict; they feed history, goals and PRs but not week dots or report counts.
 */
export async function importNotes(input: ImportInput): Promise<{ created: number; sessionIds: string[] }> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) throw new AppError('VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid import')
  const today = todayIST()
  const groups = parsed.data.groups
  for (const g of groups) if (g.date > today) throw new AppError('VALIDATION', `${g.date} is in the future`)
  const db = await getDb()
  const dates = groups.map((g) => g.date)
  const clashes = await db.select({ date: session.date }).from(session).where(and(isNull(session.deletedAt), inArray(session.date, dates)))
  if (clashes.length) throw new AppError('CONFLICT', `Already have a session on ${[...new Set(clashes.map((c) => c.date))].sort().join(', ')} — change those dates first`, 409)

  const exerciseIds = [...new Set(groups.flatMap((g) => g.entries.map((e) => e.exerciseId)))]
  const cfgs = await loadExerciseCfgs(db, exerciseIds)
  for (const id of exerciseIds) if (!cfgs.has(id)) throw new AppError('NOT_FOUND', 'Unknown exercise in import', 404)
  const templates = await db.select({ id: template.id, name: template.name }).from(template)
  const templateId = (name: string | null): string | null => templates.find((t) => t.name.toLowerCase() === name?.toLowerCase())?.id ?? null

  const sessionIds = await db.transaction(async (tx) => {
    const ids: string[] = []
    for (const g of groups) {
      const at = istMidday(g.date)
      const [s] = await tx
        .insert(session)
        .values({ date: g.date, startedAt: at, finishedAt: at, templateId: templateId(g.templateName), type: 'normal', source: 'imported', advancedLoop: false, note: 'Imported from notes' })
        .returning({ id: session.id })
      ids.push(s.id)
      for (let i = 0; i < g.entries.length; i += 1) {
        const e = g.entries[i]
        const [se] = await tx
          .insert(sessionExercise)
          .values({ sessionId: s.id, exerciseId: e.exerciseId, orderIndex: i, sets: e.sets, lo: e.lo, hi: e.hi, goal: null })
          .returning({ id: sessionExercise.id })
        const unit = cfgs.get(e.exerciseId)!.unit
        let setIndex = 0
        for (const seg of e.segments) {
          for (const st of seg.sets) {
            await tx.insert(setLog).values({ sessionExerciseId: se.id, setIndex, rev: 1, load: seg.load, reps: st.reps, toFailure: st.toFailure || st.reps === null, unit })
            setIndex += 1
          }
        }
      }
    }
    for (const id of exerciseIds) await recomputePrs(tx, id)
    return ids
  })
  revalidatePath('/')
  revalidatePath('/history')
  return { created: sessionIds.length, sessionIds }
}
