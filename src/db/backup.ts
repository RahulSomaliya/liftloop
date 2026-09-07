// JSON backup and restore (spec §11.4). Not a server-action module: takes a db handle.
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '@/db/client'
import { bodyMetric, exercise, exportLog, gymConfig, program, session, sessionExercise, setLog, template, templateExercise } from '@/db/schema'
import { AppError } from '@/lib/errors'
import { SCHEMA_VERSION } from './schema-version'

/** Insert order (FK-safe). Deletion runs in reverse. `login_attempt` is never backed up. */
export const BACKUP_TABLES = ['gym_config', 'exercise', 'program', 'template', 'template_exercise', 'session', 'session_exercise', 'set_log', 'body_metric', 'export_log'] as const
export type BackupTable = (typeof BACKUP_TABLES)[number]

const TABLE_MAP = {
  gym_config: gymConfig,
  exercise,
  program,
  template,
  template_exercise: templateExercise,
  session,
  session_exercise: sessionExercise,
  set_log: setLog,
  body_metric: bodyMetric,
  export_log: exportLog,
} as const

const row = z.record(z.string(), z.unknown())
export const backupFileSchema = z.object({
  app: z.literal('liftloop'),
  schema_version: z.string().regex(/^\d{4}_/),
  exported_at: z.string(),
  tables: z.object(Object.fromEntries(BACKUP_TABLES.map((t) => [t, z.array(row)])) as Record<BackupTable, z.ZodArray<typeof row>>),
})
export type BackupFile = z.infer<typeof backupFileSchema>

export const USER_TABLES: BackupTable[] = ['session', 'session_exercise', 'set_log', 'body_metric', 'export_log']

export const versionNumber = (tag: string): number => Number.parseInt(tag.slice(0, 4), 10)

export async function buildBackup(db: Db, now = new Date()): Promise<BackupFile> {
  const tables = {} as Record<BackupTable, Record<string, unknown>[]>
  for (const t of BACKUP_TABLES) tables[t] = (await db.select().from(TABLE_MAP[t])) as Record<string, unknown>[]
  return { app: 'liftloop', schema_version: SCHEMA_VERSION, exported_at: now.toISOString(), tables }
}

export async function hasUserData(db: Db): Promise<boolean> {
  for (const t of USER_TABLES) {
    const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(TABLE_MAP[t])
    if (Number(r.n) > 0) return true
  }
  return false
}

/** Timestamps arrive as ISO strings in JSON; Drizzle `timestamptz` columns want Date objects. */
function revive(r: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(r)) {
    out[k] = /(At|_at)$/.test(k) && typeof v === 'string' ? new Date(v) : v
  }
  return out
}

/**
 * Transactional wipe-and-restore. Refuses a dump from a newer schema; an older dump inserts fine
 * because migrations are expand-only. When user data exists the caller must pass confirm 'RESTORE'.
 */
export async function restoreBackup(db: Db, file: unknown, opts: { confirm?: string } = {}): Promise<{ restored: Record<BackupTable, number> }> {
  const parsed = backupFileSchema.safeParse(file)
  if (!parsed.success) throw new AppError('VALIDATION', 'Not a LiftLoop backup file')
  const data = parsed.data
  if (versionNumber(data.schema_version) > versionNumber(SCHEMA_VERSION)) {
    throw new AppError('VALIDATION', `This backup is from a newer app version (${data.schema_version}); update the app first`)
  }
  if ((await hasUserData(db)) && opts.confirm !== 'RESTORE') throw new AppError('CONFLICT', 'This database already has data — type RESTORE to replace everything', 409)

  const restored = {} as Record<BackupTable, number>
  await db.transaction(async (tx) => {
    for (const t of [...BACKUP_TABLES].reverse()) await tx.delete(TABLE_MAP[t])
    for (const t of BACKUP_TABLES) {
      const rows = data.tables[t].map(revive)
      restored[t] = rows.length
      for (let i = 0; i < rows.length; i += 200) {
        // Rows come from our own export, so their shape matches the table; cast at the boundary.
        await tx.insert(TABLE_MAP[t]).values(rows.slice(i, i + 200) as never)
      }
    }
  })
  return { restored }
}
