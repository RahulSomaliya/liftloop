'use server'

import { and, asc, eq, isNull, lt } from 'drizzle-orm'
import { z } from 'zod'
import { getDb, type Tx } from '@/db/client'
import { recomputeExercise, recomputePrs, type ExerciseDone } from '@/db/recompute'
import { exercise, session, sessionExercise, setLog } from '@/db/schema'
import { parseExerciseLine } from '@/lib/domain/shorthand'
import { AppError } from '@/lib/errors'

const uuid = z.string().uuid()

export interface SetRow {
  setIndex: number
  rev: number
  load: number | null
  reps: number | null
  toFailure: boolean
  isPr: boolean
  deleted: boolean
}

export interface SetWriteResult {
  applied: boolean
  row: SetRow
  exerciseDone: ExerciseDone | null
}

const logSchema = z.object({
  sessionExerciseId: uuid,
  setIndex: z.number().int().min(0).max(19),
  rev: z.number().int().min(1),
  load: z.number().min(-500).max(2000).nullable(),
  reps: z.number().int().min(0).max(200).nullable(),
  toFailure: z.boolean().default(false),
  unit: z.enum(['lb', 'kg']),
})

const toRow = (r: typeof setLog.$inferSelect): SetRow => ({ setIndex: r.setIndex, rev: r.rev, load: r.load, reps: r.reps, toFailure: r.toFailure, isPr: r.isPr, deleted: r.deletedAt !== null })

async function guardOpen(tx: Tx, sessionExerciseId: string) {
  const [row] = await tx
    .select({ se: sessionExercise, s: session })
    .from(sessionExercise)
    .innerJoin(session, eq(session.id, sessionExercise.sessionId))
    .where(eq(sessionExercise.id, sessionExerciseId))
    .limit(1)
  if (!row || row.s.deletedAt) throw new AppError('NOT_FOUND', 'Exercise not found', 404)
  return row
}

/**
 * Guarded upsert (spec §11.2): applies only when `rev` beats the stored rev. Returns the stored row
 * either way so the client can resubmit once with row.rev + 1.
 */
export async function logSet(input: z.input<typeof logSchema>): Promise<SetWriteResult> {
  const parsed = logSchema.safeParse(input)
  if (!parsed.success) throw new AppError('VALIDATION', 'Invalid set')
  const d = parsed.data
  const db = await getDb()
  return db.transaction(async (tx) => {
    const ctx = await guardOpen(tx, d.sessionExerciseId)
    const now = new Date()
    const [written] = await tx
      .insert(setLog)
      .values({ sessionExerciseId: d.sessionExerciseId, setIndex: d.setIndex, rev: d.rev, load: d.load, reps: d.reps, toFailure: d.toFailure, unit: d.unit, updatedAt: now })
      .onConflictDoUpdate({
        target: [setLog.sessionExerciseId, setLog.setIndex],
        set: { load: d.load, reps: d.reps, toFailure: d.toFailure, unit: d.unit, rev: d.rev, updatedAt: now, deletedAt: null },
        setWhere: lt(setLog.rev, d.rev),
      })
      .returning()
    if (!written) {
      const [current] = await tx.select().from(setLog).where(and(eq(setLog.sessionExerciseId, d.sessionExerciseId), eq(setLog.setIndex, d.setIndex))).limit(1)
      return { applied: false, row: toRow(current), exerciseDone: null }
    }
    await recomputePrs(tx, ctx.se.exerciseId)
    const done = await recomputeExercise(tx, d.sessionExerciseId)
    const [fresh] = await tx.select().from(setLog).where(eq(setLog.id, written.id)).limit(1)
    return { applied: true, row: toRow(fresh), exerciseDone: done }
  })
}

const revSchema = z.object({ sessionExerciseId: uuid, setIndex: z.number().int().min(0).max(19), rev: z.number().int().min(1) })

async function setDeleted(input: z.input<typeof revSchema>, deleted: boolean): Promise<SetWriteResult> {
  const parsed = revSchema.safeParse(input)
  if (!parsed.success) throw new AppError('VALIDATION', 'Invalid set')
  const d = parsed.data
  const db = await getDb()
  return db.transaction(async (tx) => {
    const ctx = await guardOpen(tx, d.sessionExerciseId)
    const [written] = await tx
      .update(setLog)
      .set({ deletedAt: deleted ? new Date() : null, rev: d.rev, updatedAt: new Date() })
      .where(and(eq(setLog.sessionExerciseId, d.sessionExerciseId), eq(setLog.setIndex, d.setIndex), lt(setLog.rev, d.rev)))
      .returning()
    const [current] = await tx.select().from(setLog).where(and(eq(setLog.sessionExerciseId, d.sessionExerciseId), eq(setLog.setIndex, d.setIndex))).limit(1)
    if (!current) throw new AppError('NOT_FOUND', 'Set not found', 404)
    if (!written) return { applied: false, row: toRow(current), exerciseDone: null }
    await recomputePrs(tx, ctx.se.exerciseId)
    const done = await recomputeExercise(tx, d.sessionExerciseId)
    return { applied: true, row: toRow(current), exerciseDone: done }
  })
}

export async function deleteSet(input: z.input<typeof revSchema>): Promise<SetWriteResult> {
  return setDeleted(input, true)
}

export async function restoreSet(input: z.input<typeof revSchema>): Promise<SetWriteResult> {
  return setDeleted(input, false)
}

const shorthandSchema = z.object({ sessionExerciseId: uuid, line: z.string().min(1).max(200) })

/** "type it instead": logs every set on the line, replacing the slot's existing sets. */
export async function logSetsFromShorthand(input: { sessionExerciseId: string; line: string }): Promise<{ rows: SetRow[]; exerciseDone: ExerciseDone | null; errors: string[] }> {
  const parsed = shorthandSchema.safeParse(input)
  if (!parsed.success) throw new AppError('VALIDATION', 'Invalid line')
  const { segments, errors } = parseExerciseLine(parsed.data.line)
  if (errors.length) return { rows: [], exerciseDone: null, errors: errors.map((e) => e.message) }
  const db = await getDb()
  return db.transaction(async (tx) => {
    const ctx = await guardOpen(tx, parsed.data.sessionExerciseId)
    const [ex] = await tx.select().from(exercise).where(eq(exercise.id, ctx.se.exerciseId)).limit(1)
    const existing = await tx.select().from(setLog).where(eq(setLog.sessionExerciseId, ctx.se.id))
    const revOf = (i: number): number => (existing.find((r) => r.setIndex === i)?.rev ?? 0) + 1
    const flat = segments.flatMap((seg) => seg.sets.map((s) => ({ load: seg.load, reps: s.reps, toFailure: s.toFailure })))
    const now = new Date()
    let i = 0
    for (const s of flat) {
      await tx
        .insert(setLog)
        .values({ sessionExerciseId: ctx.se.id, setIndex: i, rev: revOf(i), load: s.load, reps: s.reps, toFailure: s.toFailure, unit: ex.unit, updatedAt: now })
        .onConflictDoUpdate({
          target: [setLog.sessionExerciseId, setLog.setIndex],
          set: { load: s.load, reps: s.reps, toFailure: s.toFailure, unit: ex.unit, rev: revOf(i), updatedAt: now, deletedAt: null },
        })
      i += 1
    }
    for (const r of existing) if (r.setIndex >= flat.length && r.deletedAt === null) await tx.update(setLog).set({ deletedAt: now, rev: r.rev + 1, updatedAt: now }).where(eq(setLog.id, r.id))
    await recomputePrs(tx, ctx.se.exerciseId)
    const done = await recomputeExercise(tx, ctx.se.id)
    const rows = await tx.select().from(setLog).where(and(eq(setLog.sessionExerciseId, ctx.se.id), isNull(setLog.deletedAt))).orderBy(asc(setLog.setIndex))
    return { rows: rows.map(toRow), exerciseDone: done, errors: [] }
  })
}
