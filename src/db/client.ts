// One `getDb()` for every runtime (spec §10.1):
//  - production / any Postgres URL → Neon serverless Pool over WebSocket (supports transactions)
//  - DATABASE_URL unset or "pglite:<dir>" → embedded PGlite (file-backed; "pglite:memory" in tests)
// Both are Postgres, so `drizzle/` migrations are shared. Keep this file free of `server-only`
// so `tsx src/db/*.ts` scripts can import it.
import { PGlite } from '@electric-sql/pglite'
import { Pool } from '@neondatabase/serverless'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import * as schema from './schema'

export type Db = PgDatabase<PgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

export type DbKind = 'pglite' | 'neon'

export function dbKind(url = process.env.DATABASE_URL): DbKind {
  return !url || url.startsWith('pglite:') ? 'pglite' : 'neon'
}

function pgliteDir(url = process.env.DATABASE_URL): string | undefined {
  const target = url?.replace(/^pglite:/, '') || '.pglite'
  return target === 'memory' ? undefined : target
}

// Cached on globalThis, not at module scope: Next's dev server evaluates this module once per
// bundle (pages, route handlers, actions) and HMR re-evaluates it — each copy would open its own
// PGlite on the same directory and see a different database (seen as an empty /api/backup while
// pages showed sessions). One process, one client.
const g = globalThis as typeof globalThis & { __liftloopDb?: { db: Db; close: () => Promise<void> } | null }

/** Creates a fresh, uncached client (tests use this for isolated in-memory databases). */
export async function createDb(url = process.env.DATABASE_URL): Promise<{ db: Db; close: () => Promise<void>; kind: DbKind }> {
  if (dbKind(url) === 'pglite') {
    const client = new PGlite(pgliteDir(url))
    await client.waitReady
    const db = drizzlePglite(client, { schema }) as unknown as Db
    return { db, close: () => client.close(), kind: 'pglite' }
  }
  const pool = new Pool({ connectionString: url })
  const db = drizzleNeon(pool, { schema }) as unknown as Db
  return { db, close: () => pool.end(), kind: 'neon' }
}

let creating: Promise<{ db: Db; close: () => Promise<void> }> | null = null

export async function getDb(): Promise<Db> {
  if (g.__liftloopDb) return g.__liftloopDb.db
  creating ??= createDb().then((c) => {
    g.__liftloopDb = { db: c.db, close: c.close }
    return g.__liftloopDb
  })
  return (await creating).db
}
