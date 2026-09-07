import { format } from 'date-fns'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CopyButton } from '@/components/copy-button'
import { EditSets } from '@/components/history/edit-sets'
import { getDb } from '@/db/client'
import { getSessionDetail } from '@/db/queries/history'
import { formatLoad } from '@/lib/domain/load-format'
import { tzDate } from '@/lib/domain/time'
import { markFor } from '@/lib/domain/verdict'

export const dynamic = 'force-dynamic'

export default async function SessionDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { id } = await params
  const editing = (await searchParams).edit === '1'
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const db = await getDb()
  const s = await getSessionDetail(db, id)
  if (!s) notFound()
  if (!s.finishedAt && s.source === 'logged') redirect(`/session/${id}`)

  const title = s.type === 'walk' ? 'Walk' : s.source === 'imported' ? 'Imported' : (s.templateName ?? 'Session')
  const chips = [format(tzDate(s.date), 'EEE d MMM')]
  if (s.durationMin !== null) chips.push(`${s.durationMin} min`)
  if (s.type === 'short') chips.push('short session')
  if (s.sleepGood !== null) chips.push(`sleep: ${s.sleepGood ? 'good' : 'bad'}`)
  if (s.shoulderPain !== null) chips.push(`shoulder ${s.shoulderPain}`)
  if (s.elbowPain !== null) chips.push(`elbow ${s.elbowPain}`)
  if (!s.advancedLoop && s.type !== 'walk') chips.push('loop not advanced')

  return (
    <main className="flex flex-col gap-4 px-5 pt-2">
      <header className="flex h-14 items-center gap-2">
        <Link href="/history" aria-label="Back to History" className="-ml-3 flex size-11 items-center justify-center text-muted-foreground">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="flex-1 text-[17px] font-bold">{title}</h1>
        {s.type !== 'walk' && (
          <Link href={editing ? `/history/${id}` : `/history/${id}?edit=1`} className="flex h-11 items-center rounded-xl px-3 text-[13px] font-semibold text-primary">
            {editing ? 'Done' : 'Edit'}
          </Link>
        )}
      </header>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <span key={c} className="rounded-full border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium tabular-nums text-muted-foreground">
            {c}
          </span>
        ))}
      </div>
      {s.note && <p className="text-[14px] text-muted-foreground">Note: {s.note}</p>}

      {s.type === 'walk' ? (
        <p className="text-[14px] text-muted-foreground">Cardio only, loop not advanced.</p>
      ) : editing ? (
        <EditSets sessionId={s.id} exercises={s.exercises} />
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground">SHORTHAND</h2>
              <CopyButton text={s.shorthand} label="Copy" />
            </div>
            <pre className="overflow-x-auto rounded-2xl border border-border bg-card p-3.5 font-mono text-[12px] leading-relaxed text-muted-foreground">{s.shorthand || '(no sets logged)'}</pre>
          </section>

          <section className="flex flex-col">
            <div className="grid grid-cols-[1.6fr_0.5fr_0.9fr_0.7fr_0.4fr] gap-2 px-1 py-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground/70">
              <span>EXERCISE</span>
              <span>SET</span>
              <span>LOAD</span>
              <span>REPS</span>
              <span />
            </div>
            {s.exercises.map((e) =>
              e.setLogs.length === 0 ? (
                <div key={e.id} className="grid grid-cols-[1.6fr_0.5fr_0.9fr_0.7fr_0.4fr] gap-2 border-t border-border px-1 py-2.5 text-[14px]">
                  <span className="truncate font-semibold">{e.exercise.name}</span>
                  <span className="col-span-4 text-muted-foreground/70">not logged</span>
                </div>
              ) : (
                e.setLogs.map((l, i) => {
                  const mark = e.goal ? markFor(e.goal, l.setIndex, l.reps) : null
                  return (
                    <div key={`${e.id}-${l.setIndex}`} className="grid h-10 grid-cols-[1.6fr_0.5fr_0.9fr_0.7fr_0.4fr] items-center gap-2 border-t border-border px-1 text-[14px] tabular-nums">
                      <span className="truncate font-semibold">{i === 0 ? <Link href={`/exercise/${e.exercise.id}`}>{e.exercise.name}</Link> : ''}</span>
                      <span className="text-muted-foreground/70">{l.setIndex + 1}</span>
                      <span>{formatLoad(e.exercise, l.load)}</span>
                      <span>
                        {l.reps === null ? 'f' : l.reps}
                        {l.reps !== null && e.exercise.unilateral ? `/${e.exercise.unilateral}` : ''}
                      </span>
                      <span className={`text-[12px] font-bold ${l.isPr || mark === 'up' ? 'text-success' : 'text-muted-foreground/70'}`}>{l.isPr ? 'PR' : mark === 'up' ? '↑' : mark === 'eq' ? '=' : mark === 'down' ? '↓' : ''}</span>
                    </div>
                  )
                })
              ),
            )}
          </section>
          {s.exercises.some((e) => e.collapsed || e.note) && (
            <section className="flex flex-col">
              {s.exercises.map((e) =>
                e.collapsed || e.note ? (
                  <div key={e.id} className="flex flex-col gap-0.5 border-b border-border py-2.5">
                    <span className="text-[14px] font-semibold">{e.exercise.name}</span>
                    {e.collapsed && <span className="text-[13px] tabular-nums text-muted-foreground">{e.collapsed}</span>}
                    {e.note && <span className="text-[13px] text-muted-foreground/70">Note: {e.note}</span>}
                  </div>
                ) : null,
              )}
            </section>
          )}
        </>
      )}
    </main>
  )
}
