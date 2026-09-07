import { format } from 'date-fns'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getDb } from '@/db/client'
import { exerciseDetail } from '@/db/queries/exercise'
import { formatLoad } from '@/lib/domain/load-format'
import { tzDate } from '@/lib/domain/time'

export const dynamic = 'force-dynamic'

export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const d = await exerciseDetail(await getDb(), id)
  if (!d) notFound()
  const ex = d.exercise
  const stepping = ex.increment === null ? 'dumbbell rack' : `+${ex.increment} ${ex.unit}`
  const settings: [string, string][] = [
    ['Load', ex.loadType === 'per_side' ? `per side (${ex.unit})${ex.barWeight ? `, bar ${ex.barWeight} ${ex.unit}` : ''}` : ex.loadType === 'bodyweight' ? `bodyweight, added ${ex.unit}` : ex.loadType === 'dumbbell' ? `dumbbell (${ex.unit})` : `stack (${ex.unit})`],
    ['Step', ex.progression === 'assist_down' ? `−${ex.increment} ${ex.unit} assist` : stepping],
    ['Rest', `${ex.restSeconds} s`],
    ['Muscles', ex.muscles.map((m) => `${m.group.replace('_', ' ')} ${m.credit}`).join(', ')],
  ]
  if (ex.unilateral) settings.push(['Unilateral', `per ${ex.unilateral}`])
  if (ex.aliases.length) settings.push(['Aliases', ex.aliases.join(', ')])
  if (d.swaps.length) settings.push(['Swaps', d.swaps.map((s) => s.name).join(', ')])

  return (
    <main className="flex flex-col gap-4 px-5 pt-2">
      <header className="flex h-14 items-center gap-2">
        <Link href="/history" aria-label="Back" className="-ml-3 flex size-11 items-center justify-center text-muted-foreground">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="truncate text-[17px] font-bold">{ex.name}</h1>
      </header>
      {ex.cue && <p className="text-[14px] text-muted-foreground">{ex.cue}</p>}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="flex flex-col items-center gap-0.5 rounded-2xl border border-border bg-card py-3.5">
          <span className="text-[22px] font-bold tabular-nums tracking-[-0.02em]">{d.best ? `${formatLoad(ex, d.best.load)} × ${d.best.reps}` : '—'}</span>
          <span className="text-[12px] font-medium text-muted-foreground/70">best set</span>
        </div>
        <div className="flex flex-col items-center gap-0.5 rounded-2xl border border-border bg-card py-3.5">
          <span className="text-[22px] font-bold tabular-nums tracking-[-0.02em]">{d.history.length}</span>
          <span className="text-[12px] font-medium text-muted-foreground/70">sessions</span>
        </div>
      </div>
      <section className="flex flex-col">
        <h2 className="px-1 pb-2 text-[13px] font-semibold tracking-wide text-muted-foreground">HISTORY</h2>
        {d.history.length === 0 && <p className="px-1 text-[14px] text-muted-foreground/70">No sessions yet.</p>}
        {d.history.map((h) => (
          <Link key={h.sessionId} href={`/history/${h.sessionId}`} className="flex items-center gap-3 border-t border-border py-2.5">
            <span className="w-16 text-[13px] tabular-nums text-muted-foreground/70">{format(tzDate(h.date), 'd MMM')}</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-mono text-[14px] tabular-nums">{h.line}</span>
              <span className="text-[12px] text-muted-foreground/70">
                {h.label}
                {h.verdict ? ` · ${h.verdict === 'done' ? 'easy' : h.verdict}` : ''}
              </span>
            </span>
          </Link>
        ))}
      </section>
      <section className="flex flex-col rounded-2xl border border-border bg-card">
        {settings.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-4 border-t border-border px-4 py-3 text-[14px] first:border-t-0">
            <span className="text-muted-foreground">{k}</span>
            <span className="text-right">{v}</span>
          </div>
        ))}
        <p className="border-t border-border px-4 py-3 text-[12px] text-muted-foreground/70">Editing comes with the program editor (v1.1). Until then, edit `src/db/seed/program-v2.ts` and re-seed.</p>
      </section>
    </main>
  )
}
