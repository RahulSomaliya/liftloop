import { format } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { getDb } from '@/db/client'
import { MonthCalendar } from '@/components/history/month-calendar'
import { listSessions, monthDots, type SessionListItem } from '@/db/queries/history'
import { todayIST, tzDate } from '@/lib/domain/time'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const KIND_DOT: Record<SessionListItem['kind'], string> = {
  push: 'bg-kind-push',
  pull: 'bg-kind-pull',
  legs: 'bg-kind-legs',
  walk: 'bg-kind-walk',
  imported: 'bg-kind-walk',
}

function meta(s: SessionListItem): string {
  if (!s.finished) return 'in progress'
  if (s.type === 'walk') return `${s.durationMin ?? 0} min`
  if (s.source === 'imported') return `${s.exerciseCount} exercise${s.exerciseCount === 1 ? '' : 's'}`
  const parts = [`${s.durationMin ?? 0} min`, `${s.setCount} set${s.setCount === 1 ? '' : 's'}`]
  if (s.prCount > 0) parts.push(`${s.prCount} PR`)
  if (s.shoulderPain !== null && s.shoulderPain > 0) parts.push(`shoulder ${s.shoulderPain}`)
  return parts.join(' · ')
}

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ view?: string; month?: string }> }) {
  const sp = await searchParams
  const today = todayIST()
  const calendar = sp.view === 'calendar'
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7)
  const db = await getDb()
  const sessions = calendar ? [] : await listSessions(db)
  const dots = calendar ? await monthDots(db, month) : []
  const groups = new Map<string, SessionListItem[]>()
  for (const s of sessions) {
    const key = format(tzDate(s.date), 'MMMM yyyy')
    groups.set(key, [...(groups.get(key) ?? []), s])
  }

  return (
    <main className="flex flex-col px-4 pt-2">
      <header className="flex h-14 items-center justify-between px-1">
        <h1 className="text-[20px] font-bold tracking-[-0.02em]">History</h1>
        <Link href={calendar ? '/history' : '/history?view=calendar'} className="flex h-11 items-center rounded-xl px-3 text-[13px] font-semibold text-primary">
          {calendar ? 'List' : 'Calendar'}
        </Link>
      </header>
      {calendar && <MonthCalendar yearMonth={month} dots={dots} today={today} />}
      {!calendar && sessions.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-[14px] text-muted-foreground">
          No sessions yet. Start one from Home and it will show up here.
        </p>
      )}
      {[...groups.entries()].map(([month, items]) => (
        <section key={month} className="flex flex-col">
          <h2 className="px-1 pb-2 pt-4 text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">{month}</h2>
          {items.map((s) => (
            <Link key={s.id} href={s.finished ? `/history/${s.id}` : `/session/${s.id}`} className="flex h-14 items-center gap-3 border-b border-border px-1">
              <span className={cn('size-2.5 shrink-0 rounded-full', KIND_DOT[s.kind])} aria-hidden />
              <span className="w-14 text-[13px] tabular-nums text-muted-foreground/70">{format(tzDate(s.date), 'EEE d')}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold">{s.type === 'walk' ? 'Walk' : s.source === 'imported' ? 'Imported' : (s.templateName ?? 'Session')}</span>
                  {!s.finished && <Tag>live</Tag>}
                  {s.type === 'short' && <Tag>short</Tag>}
                  {s.source === 'imported' && <Tag>imported</Tag>}
                </span>
                <span className="text-[13px] tabular-nums text-muted-foreground/70">{meta(s)}</span>
              </span>
              <ChevronRight size={18} className="text-muted-foreground/70" />
            </Link>
          ))}
        </section>
      ))}
    </main>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-border px-1.5 py-px text-[11px] font-semibold text-muted-foreground/70">{children}</span>
}
