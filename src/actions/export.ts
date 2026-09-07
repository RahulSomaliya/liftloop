'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDb } from '@/db/client'
import { exportLog } from '@/db/schema'
import { isValidISTDate } from '@/lib/domain/time'
import { AppError } from '@/lib/errors'

const schema = z.object({ from: z.string().refine(isValidISTDate), to: z.string().refine(isValidISTDate) })

/** Written by Copy/Share after they succeed (spec §8); the preview never writes. */
export async function recordExport(input: { from: string; to: string }): Promise<void> {
  const parsed = schema.safeParse(input)
  if (!parsed.success) throw new AppError('VALIDATION', 'Invalid date range')
  const db = await getDb()
  await db.insert(exportLog).values({ fromDate: parsed.data.from, toDate: parsed.data.to })
  revalidatePath('/')
}
