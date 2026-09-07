import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getDb } from '@/db/client'
import { loadReportInput } from '@/db/queries/report'
import { exportLog } from '@/db/schema'
import { generateCoachReport } from '@/lib/domain/report'
import { addDaysIST, isValidISTDate, todayIST } from '@/lib/domain/time'
import { env } from '@/lib/env'

/**
 * Optional read-only coach endpoint (spec §5.2): the coach fetches the markdown by URL with a long
 * secret. Public in the proxy; the token is the only guard, so it is compared in constant time and
 * a missing env var disables the route entirely.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const secret = env.COACH_EXPORT_TOKEN
  if (!secret) return new NextResponse('Not found', { status: 404 })
  const url = new URL(req.url)
  const token = url.searchParams.get('token') ?? ''
  const a = createHash('sha256').update(token).digest()
  const b = createHash('sha256').update(secret).digest()
  if (!timingSafeEqual(a, b)) return new NextResponse('Unauthorized', { status: 401 })

  const today = todayIST()
  let from = url.searchParams.get('from')
  let to = url.searchParams.get('to')
  if (!(from && to && isValidISTDate(from) && isValidISTDate(to) && from <= to)) {
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days') ?? 14) || 14))
    to = today
    from = addDaysIST(today, -(days - 1))
  }
  const db = await getDb()
  const input = await loadReportInput(db, { from, to, today, ownerName: env.REPORT_OWNER_NAME ?? null })
  const text = generateCoachReport(input)
  await db.insert(exportLog).values({ fromDate: from, toDate: to })
  return new NextResponse(text, { headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store' } })
}
