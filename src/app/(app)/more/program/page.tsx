import { asc } from 'drizzle-orm'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { ProgramEditor } from '@/components/editor/program-editor'
import { exercise } from '@/db/schema'
import { getDb } from '@/db/client'
import { loadProgram } from '@/db/queries/home'
import { loadTemplateEntries } from '@/db/queries/session'
import { PROGRAM_V2 } from '@/db/seed/program-v2'

export const dynamic = 'force-dynamic'

export default async function ProgramPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const editing = (await searchParams).edit === '1'
  const db = await getDb()
  const prog = await loadProgram(db)
  const templates = await Promise.all(prog.templates.map(async (t) => ({ ...t, entries: await loadTemplateEntries(db, t.id, { includeArchived: editing }) })))
  const library = editing ? await db.select({ id: exercise.id, name: exercise.name }).from(exercise).orderBy(asc(exercise.name)) : []
  return (
    <main className="flex flex-col gap-4 px-5 pt-2">
      <header className="flex h-14 items-center gap-2">
        <Link href="/more" aria-label="Back" className="-ml-3 flex size-11 items-center justify-center text-muted-foreground">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="flex-1 text-[17px] font-bold">Program v{PROGRAM_V2.program.version}</h1>
        <Link href={editing ? '/more/program' : '/more/program?edit=1'} className="flex h-11 items-center rounded-xl px-3 text-[13px] font-semibold text-primary">
          {editing ? 'Done' : 'Edit'}
        </Link>
      </header>
      {editing && <ProgramEditor templates={templates.map((t) => ({ id: t.id, name: t.name, entries: t.entries }))} library={library} />}
      {!editing && (
        <p className="text-[13px] text-muted-foreground">
          Loop: {prog.templates.map((t) => t.name).join(' → ')}. Started {prog.startDate}. Next: <span className="font-semibold text-foreground">{prog.templates[prog.nextIndex]?.name}</span>.
        </p>
      )}
      {!editing && templates.map((t) => (
        <section key={t.id} className="flex flex-col rounded-2xl border border-border bg-card">
          <h2 className="px-4 pt-3.5 pb-2 text-[15px] font-bold">{t.name}</h2>
          {t.entries.map((e, i) => {
            const superset = e.supersetGroup !== null && t.entries[i - 1]?.supersetGroup === e.supersetGroup
            return (
              <div key={e.templateExerciseId} className="flex items-center gap-3 border-t border-border px-4 py-2.5 text-[14px]">
                <span className="w-5 text-[12px] text-muted-foreground/70">{superset ? '+' : i + 1}</span>
                <Link href={`/exercise/${e.exercise.id}`} className="min-w-0 flex-1 truncate font-medium">
                  {e.exercise.name}
                </Link>
                <span className="tabular-nums text-muted-foreground">
                  {e.lo === e.hi ? e.hi : `${e.lo}–${e.hi}`}
                  {e.exercise.unilateral ? `/${e.exercise.unilateral}` : ''} × {e.sets}
                </span>
                <span className="w-9 text-right text-[12px] tabular-nums text-muted-foreground/70">{e.restSeconds ?? e.exercise.restSeconds}s</span>
              </div>
            )
          })}
        </section>
      ))}
      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="pb-1 text-[13px] font-semibold tracking-wide text-muted-foreground">WARM-UP</h2>
        <ul className="text-[14px] text-muted-foreground">
          {PROGRAM_V2.warmup.map((w) => (
            <li key={w}>· {w}</li>
          ))}
        </ul>
      </section>
    </main>
  )
}
