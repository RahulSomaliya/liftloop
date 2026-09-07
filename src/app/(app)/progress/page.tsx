import { asc } from 'drizzle-orm'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { AdherenceHeatmap } from '@/components/progress/adherence-heatmap'
import { WeeklySets } from '@/components/progress/weekly-sets'
import { getDb } from '@/db/client'
import { adherence, weeklyMuscleSets } from '@/db/queries/progress'
import { exercise } from '@/db/schema'
import { todayIST } from '@/lib/domain/time'

export const dynamic = 'force-dynamic'

export default async function ProgressPage() {
  const today = todayIST()
  const db = await getDb()
  const [adh, sets, exercises] = await Promise.all([adherence(db, today), weeklyMuscleSets(db, today), db.select({ id: exercise.id, name: exercise.name }).from(exercise).orderBy(asc(exercise.name))])
  const last4 = adh.weekTargets.slice(-4)
  const done = last4.reduce((a, w) => a + w.done, 0)
  const target = last4.reduce((a, w) => a + w.target, 0)

  return (
    <main className="flex flex-col gap-4 px-5 pt-2">
      <header className="flex h-14 items-center gap-2">
        <Link href="/more" aria-label="Back" className="-ml-3 flex size-11 items-center justify-center text-muted-foreground">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="text-[17px] font-bold">Progress</h1>
      </header>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground">ADHERENCE · 12 WEEKS</h2>
          <span className="text-[13px] tabular-nums text-muted-foreground">
            last 4 weeks <span className="font-semibold text-foreground">{done}/{target}</span>
          </span>
        </div>
        <AdherenceHeatmap days={adh.days} weekTargets={adh.weekTargets} today={today} />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground">HARD SETS THIS WEEK · {sets.weeks[sets.weeks.length - 1]?.label}</h2>
        <WeeklySets weeks={sets.weeks} />
      </section>

      <section className="flex flex-col rounded-2xl border border-border bg-card">
        <h2 className="px-4 pt-3.5 pb-1 text-[13px] font-semibold tracking-wide text-muted-foreground">EXERCISE CHARTS</h2>
        {exercises.map((e) => (
          <Link key={e.id} href={`/exercise/${e.id}`} className="flex h-12 items-center justify-between border-t border-border px-4 text-[14px] font-medium">
            <span className="truncate">{e.name}</span>
            <ChevronRight size={16} className="text-muted-foreground/70" />
          </Link>
        ))}
      </section>
    </main>
  )
}
