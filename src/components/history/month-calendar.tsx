import { format } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { MonthDot } from '@/db/queries/history'
import { addDaysIST, tzDate } from '@/lib/domain/time'
import { cn } from '@/lib/utils'

const KIND_DOT: Record<MonthDot['kind'], string> = {
  push: 'bg-kind-push',
  pull: 'bg-kind-pull',
  legs: 'bg-kind-legs',
  walk: 'bg-kind-walk',
  imported: 'bg-kind-walk',
}

function shiftMonth(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Month grid (Mon–Sun) with one dot per live session, coloured by kind (spec §6.5). Server component. */
export function MonthCalendar({ yearMonth, dots, today }: { yearMonth: string; dots: MonthDot[]; today: string }) {
  const first = `${yearMonth}-01`
  const firstDate = tzDate(first)
  const daysInMonth = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0).getDate()
  const offset = (firstDate.getDay() + 6) % 7 // Monday = 0
  const cells: (string | null)[] = [...Array.from({ length: offset }, () => null), ...Array.from({ length: daysInMonth }, (_, i) => addDaysIST(first, i))]
  while (cells.length % 7) cells.push(null)
  const byDate = new Map<string, MonthDot[]>()
  for (const d of dots) byDate.set(d.date, [...(byDate.get(d.date) ?? []), d])

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center justify-between px-1">
        <Link href={`/history?view=calendar&month=${shiftMonth(yearMonth, -1)}`} aria-label="Previous month" className="flex size-11 items-center justify-center text-muted-foreground">
          <ChevronLeft size={20} />
        </Link>
        <h2 className="text-[15px] font-semibold">{format(firstDate, 'MMMM yyyy')}</h2>
        <Link href={`/history?view=calendar&month=${shiftMonth(yearMonth, 1)}`} aria-label="Next month" className="flex size-11 items-center justify-center text-muted-foreground">
          <ChevronRight size={20} />
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-muted-foreground/70">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
          if (!date) return <span key={i} />
          const sessions = byDate.get(date) ?? []
          const inner = (
            <>
              <span className={cn('text-[13px] tabular-nums', date === today ? 'font-bold text-primary' : date > today ? 'text-muted-foreground/40' : 'text-foreground')}>{Number(date.slice(-2))}</span>
              <span className="flex h-2 items-center gap-0.5">
                {sessions.slice(0, 3).map((s) => (
                  <span key={s.id} className={cn('size-1.5 rounded-full', KIND_DOT[s.kind], !s.finished && 'ring-1 ring-primary')} />
                ))}
              </span>
            </>
          )
          return sessions.length ? (
            <Link key={date} href={sessions[0].finished ? `/history/${sessions[0].id}` : `/session/${sessions[0].id}`} aria-label={`${date}, ${sessions.length} session${sessions.length === 1 ? '' : 's'}`} className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg bg-secondary/60">
              {inner}
            </Link>
          ) : (
            <span key={date} className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg">
              {inner}
            </span>
          )
        })}
      </div>
    </section>
  )
}
