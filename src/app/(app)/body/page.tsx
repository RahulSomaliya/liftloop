import { format } from 'date-fns'
import { BodyEntry } from '@/components/body/body-entry'
import { WeightSparkline } from '@/components/body/weight-sparkline'
import { getDb } from '@/db/client'
import { loadBodyPage } from '@/db/queries/body'
import { todayIST, tzDate } from '@/lib/domain/time'

export const dynamic = 'force-dynamic'

export default async function BodyPage() {
  const today = todayIST()
  const db = await getDb()
  const data = await loadBodyPage(db, today)
  const recent = [...data.rows].reverse().slice(0, 7)

  return (
    <main className="flex flex-col gap-4 px-5 pt-2">
      <header className="flex h-14 items-center justify-between">
        <h1 className="text-[20px] font-bold tracking-[-0.02em]">Body</h1>
        <span className="text-[13px] tabular-nums text-muted-foreground">{format(tzDate(today), 'EEE d MMM')}</span>
      </header>
      <BodyEntry date={today} row={data.today} avg7={data.avg7Today} />
      <section className="rounded-2xl border border-border bg-card p-4">
        <WeightSparkline series={data.series} />
      </section>
      <section className="flex flex-col">
        <h2 className="px-1 pb-2 text-[13px] font-semibold tracking-wide text-muted-foreground">LAST 7 ENTRIES</h2>
        {recent.length === 0 && <p className="px-1 text-[14px] text-muted-foreground/70">Nothing logged yet.</p>}
        {recent.map((r) => (
          <div key={r.date} className="grid h-10 grid-cols-4 items-center gap-2 border-t border-border px-1 text-[14px] tabular-nums">
            <span className="text-muted-foreground/70">{format(tzDate(r.date), 'EEE d')}</span>
            <span className="font-semibold">{r.weightKg ?? '—'}</span>
            <span className={r.sleepGood === true ? 'text-success' : r.sleepGood === false ? 'text-destructive' : 'text-muted-foreground/70'}>{r.sleepGood === null ? '—' : r.sleepGood ? 'good' : 'bad'}</span>
            <span className="text-muted-foreground">{r.cardioType || r.cardioMin !== null ? [r.cardioType, r.cardioMin !== null ? `${r.cardioMin}m` : null].filter(Boolean).join(' ') : '—'}</span>
          </div>
        ))}
      </section>
    </main>
  )
}
