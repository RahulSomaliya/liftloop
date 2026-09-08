'use client'

import { Check, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { deleteSet, logSet, restoreSet } from '@/actions/sets'
import { DeleteSessionButton } from './delete-session-button'
import type { SessionDetailExercise } from '@/db/queries/history'
import { formatLoad } from '@/lib/domain/load-format'

interface Props {
  sessionId: string
  title: string
  exercises: SessionDetailExercise[]
}

/** Edit mode for a finished session (spec §6.5): direct rev-guarded writes, undo on delete. */
export function EditSets({ sessionId, title, exercises }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [drafts, setDrafts] = useState<Record<string, { load: string; reps: string }>>({})
  const key = (seId: string, i: number) => `${seId}:${i}`

  function save(e: SessionDetailExercise, setIndex: number, rev: number) {
    const d = drafts[key(e.id, setIndex)]
    if (!d) return
    const load = d.load.trim() === '' ? null : Number(d.load.replace(',', '.'))
    const reps = d.reps.trim() === '' || d.reps.trim().toLowerCase() === 'f' ? null : Number(d.reps)
    if ((load !== null && Number.isNaN(load)) || (reps !== null && Number.isNaN(reps))) {
      toast.error('Enter numbers (or f for a failure set)')
      return
    }
    start(async () => {
      try {
        const r = await logSet({ sessionExerciseId: e.id, setIndex, rev: rev + 1, load, reps, toFailure: reps === null, unit: e.exercise.unit })
        if (!r.applied) toast.error('That set changed elsewhere — reload and try again')
        else toast.success('Saved')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save')
      }
    })
  }

  function remove(e: SessionDetailExercise, setIndex: number, rev: number) {
    start(async () => {
      try {
        await deleteSet({ sessionExerciseId: e.id, setIndex, rev: rev + 1 })
        router.refresh()
        toast('Set deleted', {
          duration: 6000,
          action: {
            label: 'Undo',
            onClick: () => {
              void restoreSet({ sessionExerciseId: e.id, setIndex, rev: rev + 2 })
                .then(() => router.refresh())
                .catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'Could not restore'))
            },
          },
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not delete')
      }
    })
  }

  const input = 'h-11 w-full min-w-0 rounded-xl border border-border bg-secondary px-3 text-[16px] font-semibold tabular-nums outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="flex flex-col gap-4">
      {exercises.map((e) => (
        <section key={e.id} className="flex flex-col gap-2">
          <h3 className="text-[14px] font-semibold">{e.exercise.name}</h3>
          {e.setLogs.length === 0 && <p className="text-[13px] text-muted-foreground/70">not logged</p>}
          {e.setLogs.map((l) => {
            const k = key(e.id, l.setIndex)
            const d = drafts[k] ?? { load: l.load === null ? '' : String(l.load), reps: l.reps === null ? 'f' : String(l.reps) }
            return (
              <div key={k} className="flex items-center gap-2">
                <span className="w-11 text-[13px] text-muted-foreground/70">Set {l.setIndex + 1}</span>
                <input inputMode="decimal" value={d.load} onChange={(ev) => setDrafts({ ...drafts, [k]: { ...d, load: ev.target.value } })} aria-label={`${e.exercise.name} set ${l.setIndex + 1} load`} className={input} />
                <span className="text-[12px] text-muted-foreground/70">{formatLoad(e.exercise, 1).replace(/^1\s?/, '')}</span>
                <input inputMode="numeric" value={d.reps} onChange={(ev) => setDrafts({ ...drafts, [k]: { ...d, reps: ev.target.value } })} aria-label={`${e.exercise.name} set ${l.setIndex + 1} reps`} className={input} />
                <button type="button" disabled={pending} onClick={() => save(e, l.setIndex, l.rev)} aria-label="Save set" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50">
                  <Check size={20} strokeWidth={2.6} />
                </button>
                <button type="button" disabled={pending} onClick={() => remove(e, l.setIndex, l.rev)} aria-label="Delete set" className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground disabled:opacity-50">
                  <Trash2 size={18} />
                </button>
              </div>
            )
          })}
        </section>
      ))}
      <DeleteSessionButton sessionId={sessionId} title={title} />
    </div>
  )
}
