// Runs drizzle migrations against PGlite (local) or Neon (uses the UNPOOLED url when present).
// Usage: pnpm db:migrate   — also imported by tests and by the seed script.
import 'dotenv/config'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import { migrate as migrateNeon } from 'drizzle-orm/neon-serverless/migrator'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDb, dbKind, type Db } from './client'

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'drizzle')

export async function runMigrations(db: Db, kind = dbKind()): Promise<void> {
  if (kind === 'pglite') await migratePglite(db as never, { migrationsFolder })
  else await migrateNeon(db as never, { migrationsFolder })
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  const { db, close, kind } = await createDb(url)
  console.log(`Migrating (${kind}) from ${migrationsFolder}`)
  await runMigrations(db, kind)
  await close()
  console.log('Migrations applied')
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
