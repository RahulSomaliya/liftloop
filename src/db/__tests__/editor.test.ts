import { asc, eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))

import { addTemplateEntry, createExercise, reorderTemplateEntries, setTemplateEntryArchived, updateExercise, updateGymConfig, updateRestPrefs, updateTemplateEntry } from '@/actions/editor'
import { startSession } from '@/actions/session'
import { getDb, type Db } from '../client'
import { runMigrations } from '../migrate'
import { loadGym, loadRestPrefs, loadTemplateEntries } from '../queries/session'
import { exercise, sessionExercise, template, templateExercise } from '../schema'
import { seedProgram } from '../seed'

let db: Db
let pushA: string

beforeAll(async () => {
  db = await getDb()
  await runMigrations(db, 'pglite')
  await seedProgram(db)
  ;[{ id: pushA }] = await db.select({ id: template.id }).from(template).orderBy(asc(template.orderIndex))
})

describe('program editor (§5.2, §2.3.6)', () => {
  it('edits an entry, survives re-seed, archives instead of deleting', async () => {
    const entries = await loadTemplateEntries(db, pushA)
    const first = entries[0]
    await updateTemplateEntry({ id: first.templateExerciseId, patch: { exerciseId: first.exercise.id, sets: 4, lo: 6, hi: 10, restSeconds: 150, supersetGroup: null } })
    await seedProgram(db)
    const [row] = await db.select().from(templateExercise).where(eq(templateExercise.id, first.templateExerciseId))
    expect(row).toMatchObject({ sets: 4, lo: 6, hi: 10, restSeconds: 150 })
    expect(row.editedAt).not.toBeNull()

    await setTemplateEntryArchived({ id: entries[5].templateExerciseId, archived: true })
    expect((await loadTemplateEntries(db, pushA)).length).toBe(5)
    expect((await loadTemplateEntries(db, pushA, { includeArchived: true })).length).toBe(6)
    await startSession({ id: '77777777-7777-4777-8777-777777777777', templateId: pushA })
    const started = await db.select().from(sessionExercise)
    expect(started).toHaveLength(5)
    expect(started[0].sets).toBe(2) // Ramp override still wins over the edited 4
    await expect(updateTemplateEntry({ id: first.templateExerciseId, patch: { exerciseId: first.exercise.id, sets: 3, lo: 12, hi: 8, restSeconds: null, supersetGroup: null } })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
  it('reorders and appends entries with editor defaults', async () => {
    const before = await loadTemplateEntries(db, pushA, { includeArchived: true })
    const ids = before.map((e) => e.templateExerciseId)
    await reorderTemplateEntries({ templateId: pushA, ids: [ids[1], ids[0], ...ids.slice(2)] })
    const after = await loadTemplateEntries(db, pushA, { includeArchived: true })
    expect(after[0].templateExerciseId).toBe(ids[1])
    expect(after[1].templateExerciseId).toBe(ids[0])
    await expect(reorderTemplateEntries({ templateId: pushA, ids: ids.slice(1) })).rejects.toMatchObject({ code: 'VALIDATION' })
    const [facePull] = await db.select().from(exercise).where(eq(exercise.name, 'Cable Face Pull'))
    const { id } = await addTemplateEntry({ templateId: pushA, exerciseId: facePull.id })
    const [added] = await db.select().from(templateExercise).where(eq(templateExercise.id, id))
    expect(added).toMatchObject({ orderIndex: 6, sets: 2, lo: 15, hi: 20 })
  })
  it('creates and edits exercises with validation', async () => {
    const base = { name: 'Machine Shoulder Press', aliases: ['Shoulder Press'], loadType: 'stack' as const, unit: 'kg' as const, barWeight: null, increment: 5, progression: 'load_up' as const, restSeconds: 90, unilateral: null, muscles: [{ group: 'front_delts' as const, credit: 1 }], swapIds: [], cue: null, defaultLo: 8, defaultHi: 12, defaultSets: 3 }
    const { id } = await createExercise(base)
    await expect(createExercise(base)).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(createExercise({ ...base, name: 'Bad', increment: null })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(updateExercise({ id, patch: { ...base, swapIds: [id] } })).rejects.toMatchObject({ code: 'VALIDATION' })
    await updateExercise({ id, patch: { ...base, restSeconds: 75, unilateral: 'arm' } })
    await seedProgram(db)
    const [row] = await db.select().from(exercise).where(eq(exercise.id, id))
    expect(row).toMatchObject({ restSeconds: 75, unilateral: 'arm', defaultHi: 12 })
    expect((await db.select().from(exercise)).length).toBe(31)
  })
  it('gym config edits are sorted, deduplicated and seed-protected', async () => {
    await updateGymConfig({ platesLb: [45, 2.5, 25, 2.5], dumbbellRackLb: [5, 2.5, 10, 7], stackStepKg: 2.5 })
    await seedProgram(db)
    const gym = await loadGym(db)
    expect(gym).toEqual({ platesLb: [2.5, 25, 45], dumbbellRackLb: [2.5, 5, 7, 10], stackStepKg: 2.5 })
  })
})

describe('rest timer settings (§6.3 v1.2)', () => {
  it('defaults to program rest, saves an override, survives re-seed, validates the range', async () => {
    expect(await loadRestPrefs(db)).toEqual({ overrideSeconds: null })
    await updateRestPrefs({ overrideSeconds: 75 })
    await seedProgram(db)
    expect(await loadRestPrefs(db)).toEqual({ overrideSeconds: 75 })
    await updateRestPrefs({ overrideSeconds: null })
    expect(await loadRestPrefs(db)).toEqual({ overrideSeconds: null })
    await expect(updateRestPrefs({ overrideSeconds: 5 })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(updateRestPrefs({ overrideSeconds: 1200 })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})
