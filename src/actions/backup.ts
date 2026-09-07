'use server'

import { revalidatePath } from 'next/cache'
import { restoreBackup as restore, type BackupTable } from '@/db/backup'
import { getDb } from '@/db/client'

export async function restoreFromBackup(input: { file: unknown; confirm?: string }): Promise<{ restored: Record<BackupTable, number> }> {
  const db = await getDb()
  const result = await restore(db, input.file, { confirm: input.confirm })
  revalidatePath('/', 'layout')
  return result
}
