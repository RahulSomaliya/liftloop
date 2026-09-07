import { NextResponse } from 'next/server'
import { buildBackup } from '@/db/backup'
import { getDb } from '@/db/client'
import { todayIST } from '@/lib/domain/time'

/** Full JSON dump (spec §11.4). Behind the auth proxy like every /api route except login. */
export async function GET(): Promise<NextResponse> {
  const file = await buildBackup(await getDb())
  return new NextResponse(JSON.stringify(file, null, 1), {
    headers: {
      'content-type': 'application/json',
      'content-disposition': `attachment; filename="liftloop-backup-${todayIST()}.json"`,
      'cache-control': 'no-store',
    },
  })
}
