import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))

import { finishSession, startSession } from '@/actions/session'
import { logSet } from '@/actions/sets'
import { asc } from 'drizzle-orm'
import { buildBackup, hasUserData, restoreBackup } from '../backup'
import { getDb, type Db } from '../client'
import { runMigrations } from '../migrate'
import { exercise, session, sessionExercise, setLog, template } from '../schema'
import { SCHEMA_VERSION } from '../schema-version'
import { seedProgram } from '../seed'

let db: Db
const S1 = '55555555-5555-4555-8555-555555555555'

beforeAll(async () => {
  db = await getDb()
  await runMigrations(db, 'pglite')
  await seedProgram(db)
})

describe('backup / restore (§11.4)', () => {
  it('round-trips every table with original ids', async () => {
    const [pushA] = await db.select().from(template).orderBy(asc(template.orderIndex))
    await startSession({ id: S1, templateId: pushA.id })
    const [se] = await db.select().from(sessionExercise)
    await logSet({ sessionExerciseId: se.id, setIndex: 0, rev: 1, load: 25, reps: 12, toFailure: false, unit: 'kg' })
    await finishSession({ sessionId: S1, type: 'normal', sleepGood: true, shoulderPain: 0, elbowPain: 0, note: null })
    expect(await hasUserData(db)).toBe(true)

    const file = await buildBackup(db)
    expect(file.schema_version).toBe(SCHEMA_VERSION)
    expect(file.tables.exercise).toHaveLength(30)
    expect(file.tables.session).toHaveLength(1)
    expect(file.tables.set_log).toHaveLength(1)

    // JSON round trip (Dates → strings) then restore into the same db
    const json = JSON.parse(JSON.stringify(file)) as unknown
    await expect(restoreBackup(db, json)).rejects.toMatchObject({ code: 'CONFLICT' })
    const r = await restoreBackup(db, json, { confirm: 'RESTORE' })
    expect(r.restored.session).toBe(1)
    expect(r.restored.exercise).toBe(30)
    const sessions = await db.select().from(session)
    expect(sessions[0].id).toBe(S1)
    expect(sessions[0].finishedAt).toBeInstanceOf(Date)
    const sets = await db.select().from(setLog)
    expect(sets[0].sessionExerciseId).toBe(se.id)
    expect((await db.select().from(exercise)).length).toBe(30)
  })
  it('refuses a newer schema and garbage', async () => {
    const file = JSON.parse(JSON.stringify(await buildBackup(db))) as { schema_version: string }
    await expect(restoreBackup(db, { ...file, schema_version: '9999_future' }, { confirm: 'RESTORE' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(restoreBackup(db, { hello: 'world' }, { confirm: 'RESTORE' })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
})
