'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { createExercise, setExerciseArchived, updateExercise, type ExerciseInput } from '@/actions/editor'
import { Button } from '@/components/ui/button'
import type { ExerciseCfg, MuscleGroup } from '@/lib/domain/types'
import { MUSCLE_LABEL, MUSCLE_ORDER } from '@/lib/domain/weekly-sets'

interface Props {
  exercise: (ExerciseCfg & { archived: boolean; defaultLo: number | null; defaultHi: number | null; defaultSets: number | null }) | null
  library: { id: string; name: string }[]
}

const field = 'h-11 w-full rounded-xl border border-border bg-secondary px-3 text-[14px] outline-none focus:ring-2 focus:ring-ring'
const label = 'flex flex-col gap-1 text-[12px] text-muted-foreground'

const numOrNull = (v: string): number | null => (v.trim() === '' ? null : Number(v.replace(',', '.')))

/** Exercise settings editor (spec §6.4). Create when `exercise` is null. */
export function ExerciseForm({ exercise, library }: Props) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [f, setF] = useState({
    name: exercise?.name ?? '',
    aliases: exercise?.aliases.join(', ') ?? '',
    loadType: exercise?.loadType ?? 'stack',
    unit: exercise?.unit ?? 'kg',
    barWeight: exercise?.barWeight === null || exercise?.barWeight === undefined ? '' : String(exercise.barWeight),
    increment: exercise?.increment === null || exercise?.increment === undefined ? '' : String(exercise.increment),
    progression: exercise?.progression ?? 'load_up',
    restSeconds: String(exercise?.restSeconds ?? 90),
    unilateral: exercise?.unilateral ?? '',
    muscles: exercise?.muscles ?? [{ group: 'chest' as MuscleGroup, credit: 1 }],
    swapIds: exercise?.swapIds ?? [],
    cue: exercise?.cue ?? '',
    defaultLo: exercise?.defaultLo?.toString() ?? '',
    defaultHi: exercise?.defaultHi?.toString() ?? '',
    defaultSets: exercise?.defaultSets?.toString() ?? '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }))

  function toInput(): ExerciseInput {
    return {
      name: f.name,
      aliases: f.aliases.split(',').map((a) => a.trim()).filter(Boolean),
      loadType: f.loadType,
      unit: f.unit,
      barWeight: numOrNull(f.barWeight),
      increment: numOrNull(f.increment),
      progression: f.progression,
      restSeconds: Number(f.restSeconds),
      unilateral: f.unilateral === '' ? null : (f.unilateral as 'arm' | 'leg'),
      muscles: f.muscles,
      swapIds: f.swapIds,
      cue: f.cue.trim() || null,
      defaultLo: numOrNull(f.defaultLo),
      defaultHi: numOrNull(f.defaultHi),
      defaultSets: numOrNull(f.defaultSets),
    }
  }

  function save() {
    start(async () => {
      try {
        if (exercise) {
          await updateExercise({ id: exercise.id, patch: toInput() })
          toast.success('Exercise saved')
          router.push(`/exercise/${exercise.id}`)
        } else {
          const { id } = await createExercise(toInput())
          toast.success('Exercise created')
          router.push(`/exercise/${id}`)
        }
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save')
      }
    })
  }

  function toggleArchived() {
    if (!exercise) return
    start(async () => {
      try {
        await setExerciseArchived({ id: exercise.id, archived: !exercise.archived })
        toast.success(exercise.archived ? 'Exercise restored' : 'Exercise archived')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not update')
      }
    })
  }

  const rack = f.loadType === 'dumbbell' || f.loadType === 'bodyweight'

  return (
    <form
      className="flex flex-col gap-3.5"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <label className={label}>
        Name
        <input value={f.name} onChange={(e) => set('name', e.target.value)} className={field} required />
      </label>
      <label className={label}>
        Aliases (comma-separated, for notes import)
        <input value={f.aliases} onChange={(e) => set('aliases', e.target.value)} className={field} />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className={label}>
          Load type
          <select value={f.loadType} onChange={(e) => set('loadType', e.target.value as ExerciseInput['loadType'])} className={field}>
            <option value="stack">stack</option>
            <option value="per_side">per side (bar / sled)</option>
            <option value="dumbbell">dumbbell</option>
            <option value="bodyweight">bodyweight</option>
          </select>
        </label>
        <label className={label}>
          Unit
          <select value={f.unit} onChange={(e) => set('unit', e.target.value as 'lb' | 'kg')} className={field}>
            <option value="kg">kg</option>
            <option value="lb">lb</option>
          </select>
        </label>
        <label className={label}>
          Increment {rack ? '(rack stepping, leave empty)' : ''}
          <input inputMode="decimal" value={f.increment} onChange={(e) => set('increment', e.target.value)} disabled={rack} className={field} />
        </label>
        <label className={label}>
          Bar weight (per_side)
          <input inputMode="decimal" value={f.barWeight} onChange={(e) => set('barWeight', e.target.value)} disabled={f.loadType !== 'per_side'} className={field} />
        </label>
        <label className={label}>
          Progression
          <select value={f.progression} onChange={(e) => set('progression', e.target.value as 'load_up' | 'assist_down')} className={field}>
            <option value="load_up">load up</option>
            <option value="assist_down">assist down (assisted machine)</option>
          </select>
        </label>
        <label className={label}>
          Rest (s)
          <input inputMode="numeric" value={f.restSeconds} onChange={(e) => set('restSeconds', e.target.value)} className={field} />
        </label>
        <label className={label}>
          Unilateral
          <select value={f.unilateral} onChange={(e) => set('unilateral', e.target.value)} className={field}>
            <option value="">no</option>
            <option value="arm">per arm</option>
            <option value="leg">per leg</option>
          </select>
        </label>
        <label className={label}>
          Defaults (lo / hi / sets)
          <span className="grid grid-cols-3 gap-1">
            <input inputMode="numeric" value={f.defaultLo} onChange={(e) => set('defaultLo', e.target.value)} placeholder="lo" className={field} />
            <input inputMode="numeric" value={f.defaultHi} onChange={(e) => set('defaultHi', e.target.value)} placeholder="hi" className={field} />
            <input inputMode="numeric" value={f.defaultSets} onChange={(e) => set('defaultSets', e.target.value)} placeholder="sets" className={field} />
          </span>
        </label>
      </div>
      <fieldset className="flex flex-col gap-2 rounded-2xl border border-border p-3">
        <legend className="px-1 text-[12px] text-muted-foreground">Muscles (credit per set)</legend>
        {f.muscles.map((m, i) => (
          <div key={i} className="grid grid-cols-[1fr_88px_44px] gap-2">
            <select value={m.group} onChange={(e) => set('muscles', f.muscles.map((x, j) => (j === i ? { ...x, group: e.target.value as MuscleGroup } : x)))} className={field}>
              {MUSCLE_ORDER.map((g) => (
                <option key={g} value={g}>
                  {MUSCLE_LABEL[g]}
                </option>
              ))}
            </select>
            <select value={m.credit} onChange={(e) => set('muscles', f.muscles.map((x, j) => (j === i ? { ...x, credit: Number(e.target.value) } : x)))} className={field}>
              {[1, 0.5, 0.25].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button type="button" aria-label="Remove muscle" onClick={() => set('muscles', f.muscles.filter((_, j) => j !== i))} disabled={f.muscles.length === 1} className="h-11 rounded-xl border border-border text-muted-foreground disabled:opacity-40">
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={() => set('muscles', [...f.muscles, { group: 'back', credit: 0.5 }])} disabled={f.muscles.length >= 6} className="h-10 rounded-xl border border-dashed border-border text-[13px] text-muted-foreground">
          + muscle
        </button>
      </fieldset>
      <label className={label}>
        Swaps
        <select multiple value={f.swapIds} onChange={(e) => set('swapIds', [...e.target.selectedOptions].map((o) => o.value))} className="min-h-28 w-full rounded-xl border border-border bg-secondary px-3 py-2 text-[14px]">
          {library.filter((l) => l.id !== exercise?.id).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Cue (shown on the card)
        <textarea value={f.cue} onChange={(e) => set('cue', e.target.value)} rows={2} className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-ring" />
      </label>
      <Button type="submit" disabled={pending} className="h-13 rounded-2xl text-[15px] font-bold">
        {pending ? 'Saving…' : exercise ? 'Save changes' : 'Create exercise'}
      </Button>
      {exercise && (
        <button type="button" onClick={toggleArchived} disabled={pending} className="h-11 text-[14px] font-medium text-muted-foreground">
          {exercise.archived ? 'Restore exercise' : 'Archive exercise'}
        </button>
      )}
    </form>
  )
}
