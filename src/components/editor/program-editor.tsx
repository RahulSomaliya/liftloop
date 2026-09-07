'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { addTemplateEntry, reorderTemplateEntries, setTemplateEntryArchived, updateTemplateEntry } from '@/actions/editor'
import type { TemplateEntryRow } from '@/db/queries/session'
import { cn } from '@/lib/utils'

interface TemplateWithEntries {
  id: string
  name: string
  entries: TemplateEntryRow[]
}

const field = 'h-10 w-full min-w-0 rounded-lg border border-border bg-secondary px-2 text-[14px] tabular-nums outline-none focus:ring-2 focus:ring-ring'

function EntryRow({ entry, library, onChanged }: { entry: TemplateEntryRow; library: { id: string; name: string }[]; onChanged(): void }) {
  const [d, setD] = useState({ exerciseId: entry.exercise.id, sets: String(entry.sets), lo: String(entry.lo), hi: String(entry.hi), rest: entry.restSeconds === null ? '' : String(entry.restSeconds), group: entry.supersetGroup === null ? '' : String(entry.supersetGroup) })
  const [pending, start] = useTransition()
  const dirty = d.exerciseId !== entry.exercise.id || Number(d.sets) !== entry.sets || Number(d.lo) !== entry.lo || Number(d.hi) !== entry.hi || (d.rest === '' ? null : Number(d.rest)) !== entry.restSeconds || (d.group === '' ? null : Number(d.group)) !== entry.supersetGroup
  function save() {
    start(async () => {
      try {
        await updateTemplateEntry({ id: entry.templateExerciseId, patch: { exerciseId: d.exerciseId, sets: Number(d.sets), lo: Number(d.lo), hi: Number(d.hi), restSeconds: d.rest === '' ? null : Number(d.rest), supersetGroup: d.group === '' ? null : Number(d.group) } })
        toast.success('Entry saved')
        onChanged()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save')
      }
    })
  }
  function toggleArchive() {
    start(async () => {
      try {
        await setTemplateEntryArchived({ id: entry.templateExerciseId, archived: !entry.archived })
        onChanged()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not update')
      }
    })
  }
  return (
    <div className={cn('flex flex-col gap-2 border-t border-border px-3 py-2.5', entry.archived && 'opacity-50')}>
      <select value={d.exerciseId} onChange={(e) => setD({ ...d, exerciseId: e.target.value })} aria-label="Exercise" className={field} disabled={entry.archived}>
        {library.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-1.5">
        <input inputMode="numeric" value={d.sets} onChange={(e) => setD({ ...d, sets: e.target.value })} aria-label="Sets" placeholder="sets" className={field} disabled={entry.archived} />
        <input inputMode="numeric" value={d.lo} onChange={(e) => setD({ ...d, lo: e.target.value })} aria-label="Low reps" placeholder="lo" className={field} disabled={entry.archived} />
        <input inputMode="numeric" value={d.hi} onChange={(e) => setD({ ...d, hi: e.target.value })} aria-label="High reps" placeholder="hi" className={field} disabled={entry.archived} />
        <input inputMode="numeric" value={d.rest} onChange={(e) => setD({ ...d, rest: e.target.value })} aria-label="Rest seconds" placeholder="rest" className={field} disabled={entry.archived} />
        <input inputMode="numeric" value={d.group} onChange={(e) => setD({ ...d, group: e.target.value })} aria-label="Superset group" placeholder="ss" className={field} disabled={entry.archived} />
      </div>
      <div className="flex items-center gap-3 text-[13px]">
        <button type="button" onClick={save} disabled={pending || !dirty || entry.archived} className="h-9 rounded-lg bg-primary px-3 font-semibold text-primary-foreground disabled:opacity-40">
          Save
        </button>
        <button type="button" onClick={toggleArchive} disabled={pending} className="h-9 px-1 text-muted-foreground">
          {entry.archived ? 'Restore' : 'Archive'}
        </button>
      </div>
    </div>
  )
}

/** Template editor (spec §5.2): edit entries in place, reorder, archive, add from the library. */
export function ProgramEditor({ templates, library }: { templates: TemplateWithEntries[]; library: { id: string; name: string }[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [adding, setAdding] = useState<Record<string, string>>({})
  const refresh = () => router.refresh()

  function move(t: TemplateWithEntries, index: number, dir: -1 | 1) {
    const ids = t.entries.map((e) => e.templateExerciseId)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    start(async () => {
      try {
        await reorderTemplateEntries({ templateId: t.id, ids })
        refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not reorder')
      }
    })
  }

  function add(t: TemplateWithEntries) {
    const exerciseId = adding[t.id]
    if (!exerciseId) return
    start(async () => {
      try {
        await addTemplateEntry({ templateId: t.id, exerciseId })
        setAdding({ ...adding, [t.id]: '' })
        refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not add')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted-foreground">
        Entries are archived, never deleted, so past sessions keep their history. Edited rows are protected from re-seeding.{' '}
        <Link href="/exercise/new" className="font-semibold text-primary">
          New exercise
        </Link>
      </p>
      {templates.map((t) => (
        <section key={t.id} className="flex flex-col rounded-2xl border border-border bg-card">
          <h2 className="px-3 pt-3.5 pb-1 text-[15px] font-bold">{t.name}</h2>
          {t.entries.map((e, i) => (
            <div key={e.templateExerciseId} className="flex">
              <div className="flex flex-col items-center justify-center gap-1 border-t border-border px-1">
                <button type="button" aria-label="Move up" disabled={pending || i === 0} onClick={() => move(t, i, -1)} className="flex size-8 items-center justify-center rounded-md text-muted-foreground disabled:opacity-30">
                  <ArrowUp size={16} />
                </button>
                <button type="button" aria-label="Move down" disabled={pending || i === t.entries.length - 1} onClick={() => move(t, i, 1)} className="flex size-8 items-center justify-center rounded-md text-muted-foreground disabled:opacity-30">
                  <ArrowDown size={16} />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <EntryRow entry={e} library={library} onChanged={refresh} />
              </div>
            </div>
          ))}
          <div className="flex gap-2 border-t border-border p-3">
            <select value={adding[t.id] ?? ''} onChange={(e) => setAdding({ ...adding, [t.id]: e.target.value })} aria-label={`Add exercise to ${t.name}`} className={field}>
              <option value="">Add exercise…</option>
              {library.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => add(t)} disabled={pending || !adding[t.id]} className="h-10 shrink-0 rounded-lg border border-border bg-secondary px-3 text-[13px] font-semibold disabled:opacity-40">
              Add
            </button>
          </div>
        </section>
      ))}
    </div>
  )
}
