import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { ExportView } from '@/components/export/export-view'
import { getDb } from '@/db/client'
import { loadReportInput } from '@/db/queries/report'
import { generateCoachReport } from '@/lib/domain/report'
import { addDaysIST, isValidISTDate, todayIST, weekBoundsIST } from '@/lib/domain/time'

export const dynamic = 'force-dynamic'

type Preset = '14d' | '7d' | 'week' | 'custom'

function resolveRange(today: string, sp: { preset?: string; from?: string; to?: string }): { preset: Preset; from: string; to: string } {
  if (sp.from && sp.to && isValidISTDate(sp.from) && isValidISTDate(sp.to) && sp.from <= sp.to) return { preset: 'custom', from: sp.from, to: sp.to }
  if (sp.preset === '7d') return { preset: '7d', from: addDaysIST(today, -6), to: today }
  if (sp.preset === 'week') return { preset: 'week', from: weekBoundsIST(today).weekStart, to: today }
  return { preset: '14d', from: addDaysIST(today, -13), to: today }
}

export default async function ExportPage({ searchParams }: { searchParams: Promise<{ preset?: string; from?: string; to?: string }> }) {
  const sp = await searchParams
  const today = todayIST()
  const range = resolveRange(today, sp)
  const db = await getDb()
  const input = await loadReportInput(db, { from: range.from, to: range.to, today, ownerName: process.env.REPORT_OWNER_NAME ?? null })
  const text = generateCoachReport(input)
  const counts = { sessions: input.sessions.filter((s) => s.type !== 'walk' && s.source === 'logged').length, walks: input.sessions.filter((s) => s.type === 'walk').length }

  return (
    <main className="flex flex-col gap-3.5 px-5 pt-2">
      <header className="flex h-14 items-center gap-2">
        <Link href="/more" aria-label="Back" className="-ml-3 flex size-11 items-center justify-center text-muted-foreground">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="text-[17px] font-bold">Coach export</h1>
      </header>
      <ExportView text={text} from={range.from} to={range.to} preset={range.preset} sessions={counts.sessions} walks={counts.walks} />
    </main>
  )
}
