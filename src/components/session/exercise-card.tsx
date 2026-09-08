'use client'

import { ArrowRightToLine, ArrowUp, Check, ChevronDown, Ellipsis, Equal } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatLoad } from '@/lib/domain/load-format'
import { step, stepDown } from '@/lib/domain/stepping'
import type { ExerciseCfg, Goal, GymCfg, Mark } from '@/lib/domain/types'
import { markFor } from '@/lib/domain/verdict'
import { cn } from '@/lib/utils'
import type { KeypadRequest } from './keypad-sheet'
import { MoreSheet } from './more-sheet'

export interface SlotSet {
  setIndex: number
  rev: number
  load: number | null
  reps: number | null
  toFailure: boolean
  isPr: boolean
  status: 'saved' | 'pending'
}

export interface Slot {
  id: string
  exercise: ExerciseCfg
  goal: Goal | null
  sets: SlotSet[]
  collapsed: string | null
  restSeconds: number
  supersetGroup: number | null
  note: string | null
  swappedFrom: { id: string; name: string } | null
}

interface Props {
  slot: Slot
  gym: GymCfg
  /** effective rest after a set (Settings override or the slot's own) — for the hint line */
  restSeconds: number
  swapNames: string[]
  onLog(setIndex: number, load: number, reps: number | null, toFailure: boolean): void
  onRemoveSet(setIndex: number): void
  onKeypad(req: KeypadRequest): void
  onNote(note: string): void
  onSwap(): void
  onShorthand(line: string): Promise<boolean>
  /** null when this is the last exercise in the lineup (nothing to wait behind) */
  onPostpone: (() => void) | null
  /** true while this session has unsaved set writes: swap / shorthand are gated (spec §11.2) */
  gated: boolean
}

type Draft = { load: number | null; reps: number }

const FLASH_MS = 1200

function MarkIcon({ mark }: { mark: Mark }) {
  if (mark === 'up') return <ArrowUp size={14} strokeWidth={2.6} className="text-success" aria-label="above goal" />
  if (mark === 'eq') return <Equal size={14} strokeWidth={2.6} className="text-muted-foreground" aria-label="matched goal" />
  if (mark === 'down') return <ChevronDown size={14} strokeWidth={2.6} className="text-muted-foreground/70" aria-label="under goal" />
  return null
}

/**
 * The current exercise (spec §6.3 v1.3): logged sets stack as compact rows, ONE input row for the
 * next set, nothing for the sets after it. Chips open the in-app keypad; ✓ logs what the chips say.
 * The rarely used actions live behind "•••".
 */
export function ExerciseCard({ slot, gym, restSeconds, swapNames, onLog, onRemoveSet, onKeypad, onNote, onSwap, onShorthand, onPostpone, gated }: Props) {
  const { exercise, goal } = slot
  const setCount = goal?.sets ?? 0
  const [drafts, setDrafts] = useState<Draft[]>(() => initDrafts(goal))
  const [prevGoal, setPrevGoal] = useState(goal)
  if (goal !== prevGoal) {
    setPrevGoal(goal)
    setDrafts(initDrafts(goal))
  }
  const [editing, setEditing] = useState<number | null>(null)
  const [flash, setFlash] = useState<number | null>(null)
  const [cueOpen, setCueOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState(slot.note ?? '')
  const [shorthandOpen, setShorthandOpen] = useState(false)
  const [line, setLine] = useState('')
  const [lineBusy, setLineBusy] = useState(false)

  useEffect(() => {
    if (flash === null) return
    const id = setTimeout(() => setFlash(null), FLASH_MS)
    return () => clearTimeout(id)
  }, [flash])

  const logged = new Map(slot.sets.map((s) => [s.setIndex, s]))
  const currentIndex = Array.from({ length: setCount }, (_, i) => i).find((i) => !logged.has(i)) ?? null
  const remaining = currentIndex === null ? 0 : setCount - currentIndex
  const unit = exercise.unit
  const settingsHref = `/exercise/${exercise.id}/edit`

  function setLoad(i: number, load: number | null) {
    // A new weight carries forward to the sets not logged yet.
    setDrafts((d) => d.map((row, j) => (j === i || (j > i && !logged.has(j)) ? { ...row, load } : row)))
  }
  function setReps(i: number, reps: number) {
    setDrafts((d) => d.map((row, j) => (j === i ? { ...row, reps: Math.max(0, reps) } : row)))
  }
  function log(i: number, d: Draft, load: number) {
    onLog(i, load, d.reps, false)
    setEditing(null)
    setFlash(i)
  }
  function weightKeypad(i: number, then?: (v: number) => void) {
    const d = drafts[i]
    onKeypad({
      exerciseName: exercise.name,
      label: `Weight for set ${i + 1}`,
      unit,
      value: d?.load ?? null,
      decimal: true,
      stepUp: (v) => step(exercise, v, gym),
      stepDown: (v) => stepDown(exercise, v, gym),
      stepLabel: exercise.increment === null ? 'step' : String(exercise.increment),
      preset: goal?.ghost ? { label: `last ${formatLoad(exercise, goal.ghost.load)}`, value: goal.ghost.load } : null,
      settingsHref,
      onDone: (v) => {
        setLoad(i, v)
        then?.(v)
      },
    })
  }
  function repsKeypad(i: number) {
    const d = drafts[i]
    const last = goal?.ghost?.reps[Math.min(i, (goal.ghost.reps.length || 1) - 1)] ?? null
    onKeypad({
      exerciseName: exercise.name,
      label: `Reps for set ${i + 1}`,
      unit: 'reps',
      value: d?.reps ?? null,
      decimal: false,
      stepUp: (v) => v + 1,
      stepDown: (v) => (v > 0 ? v - 1 : null),
      stepLabel: '1',
      preset: last !== null && last !== undefined ? { label: `last ${last}`, value: last } : null,
      settingsHref: null,
      onDone: (v) => setReps(i, Math.round(v)),
    })
  }
  function confirm(i: number) {
    const d = drafts[i] ?? { load: null, reps: goal?.hi ?? 0 }
    // ✓ with no weight yet: pick it on the keypad and log in the same go.
    if (d.load === null) return weightKeypad(i, (v) => log(i, { ...d, load: v }, v))
    log(i, d, d.load)
  }

  const chip = 'flex h-13 items-center justify-center rounded-[14px] border border-border bg-secondary text-[22px] font-semibold tabular-nums tracking-[-0.01em] select-none'

  function inputRow(i: number) {
    const d = drafts[i] ?? { load: null, reps: goal?.hi ?? 0 }
    const isEdit = editing === i
    return (
      <div key={`in-${i}`} className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <span className="w-11 shrink-0 text-[13px] font-medium text-muted-foreground/70">Set {i + 1}</span>
          <button type="button" onClick={() => weightKeypad(i)} aria-label={`Weight for set ${i + 1}`} className={cn(chip, 'w-[118px]', d.load === null && 'text-[14px] font-medium text-muted-foreground')}>
            {d.load === null ? 'tap to set' : formatLoad(exercise, d.load)}
          </button>
          <button type="button" onClick={() => repsKeypad(i)} aria-label={`Reps for set ${i + 1}`} className={cn(chip, 'w-[76px]')}>
            {d.reps}
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => confirm(i)}
            aria-label={`Log set ${i + 1} as ${d.load === null ? 'unset' : formatLoad(exercise, d.load)} × ${d.reps}`}
            className="flex h-13 w-[60px] shrink-0 items-center justify-center rounded-[14px] bg-primary text-primary-foreground"
          >
            <Check size={26} strokeWidth={2.6} />
          </button>
        </div>
        {isEdit && (
          <div className="flex justify-end gap-4 pr-1 text-[13px]">
            <button type="button" onClick={() => onRemoveSet(i)} className="text-destructive">
              remove set
            </button>
            <button type="button" onClick={() => setEditing(null)} className="text-muted-foreground">
              cancel
            </button>
          </div>
        )}
      </div>
    )
  }

  function loggedRow(i: number) {
    const done = logged.get(i)!
    const flashing = flash === i
    return (
      <button
        key={`done-${i}`}
        type="button"
        onClick={() => {
          setDrafts((d) => d.map((row, j) => (j === i ? { load: done.load, reps: done.reps ?? row.reps } : row)))
          setEditing(i)
        }}
        className={cn('flex h-11 w-full items-center gap-2.5 rounded-xl border px-3 text-left transition-colors duration-500', flashing ? 'border-success/40 bg-success/10' : 'border-transparent bg-background')}
      >
        <span className="w-11 text-[13px] font-medium text-muted-foreground/70">Set {i + 1}</span>
        <span className="text-[17px] font-semibold tabular-nums">
          {formatLoad(exercise, done.load)} × {done.reps === null ? 'f' : done.reps}
        </span>
        {goal && <MarkIcon mark={markFor(goal, i, done.reps)} />}
        {done.isPr && <span className="rounded border border-success px-1 text-[10px] font-bold tracking-wider text-success">PR</span>}
        <span className="flex-1" />
        <span className={cn('text-[13px] transition-colors', flashing ? 'font-semibold text-success' : 'text-muted-foreground/70')}>{flashing ? 'logged' : done.status === 'pending' ? 'saving…' : 'edit'}</span>
      </button>
    )
  }

  const rows: React.ReactNode[] = []
  for (let i = 0; i < setCount; i += 1) {
    if (logged.has(i) && editing !== i) rows.push(loggedRow(i))
    else if (editing === i || i === currentIndex) rows.push(inputRow(i))
  }
  const hint = editing !== null ? 'change the numbers, then ✓' : currentIndex === null ? 'all sets logged' : remaining === 1 ? (setCount === 1 ? '1 set' : 'last set') : `${remaining} sets left · rest ${restSeconds} s between`

  return (
    <section className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-4" aria-label={exercise.name}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-bold tracking-[-0.01em]">
          <Link href={`/exercise/${exercise.id}`}>{exercise.name}</Link>
        </h2>
        {goal && (
          <span className="whitespace-nowrap text-[13px] tabular-nums text-muted-foreground/70">
            {goal.lo === goal.hi ? goal.hi : `${goal.lo}–${goal.hi}`}
            {' × '}
            {goal.sets}
          </span>
        )}
      </div>
      {slot.swappedFrom && <p className="-mt-2 text-[12px] text-muted-foreground/70">swapped from {slot.swappedFrom.name}</p>}
      {goal && <p className="text-[24px] font-bold leading-[1.15] tracking-[-0.02em] tabular-nums">{goal.line}</p>}
      {exercise.cue && (
        <button type="button" onClick={() => setCueOpen((o) => !o)} className={cn('-mt-1 text-left text-[13px] leading-snug text-muted-foreground', !cueOpen && 'line-clamp-2')}>
          {exercise.cue}
        </button>
      )}

      <div className="flex flex-col gap-2.5">{rows}</div>
      <p className="text-[12px] text-muted-foreground/70">{hint}</p>

      <div className="flex items-center justify-between pt-0.5 text-[14px] font-medium text-muted-foreground">
        {onPostpone ? (
          <button type="button" onClick={onPostpone} title="Machine busy? Do the next exercise first" className="flex h-9 items-center gap-1.5">
            postpone <ArrowRightToLine size={16} aria-hidden />
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={() => setMoreOpen(true)} aria-label="More actions" className="flex h-9 w-11 items-center justify-center rounded-[10px] bg-secondary text-muted-foreground">
          <Ellipsis size={20} />
        </button>
      </div>

      {shorthandOpen && (
        <form
          className="flex items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!line.trim() || lineBusy) return
            setLineBusy(true)
            const ok = await onShorthand(line.trim())
            setLineBusy(false)
            if (ok) {
              setLine('')
              setShorthandOpen(false)
            }
          }}
        >
          <input
            value={line}
            onChange={(e) => setLine(e.target.value)}
            placeholder={goal?.load !== null && goal?.load !== undefined ? `${goal.load}.${goal.prefillRepsPerSet.join('.')}` : '27.12.12'}
            inputMode="decimal"
            enterKeyHint="done"
            autoFocus
            aria-label="Shorthand for this exercise"
            className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-secondary px-3.5 font-mono text-[16px] tabular-nums outline-none focus:ring-2 focus:ring-ring"
          />
          <button type="submit" disabled={lineBusy || !line.trim()} className="h-12 rounded-xl bg-primary px-4 text-[14px] font-bold text-primary-foreground disabled:opacity-50">
            Log
          </button>
        </form>
      )}
      {noteOpen && (
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onBlur={() => noteText.trim() !== (slot.note ?? '') && onNote(noteText)}
          placeholder="Note for this exercise"
          rows={2}
          autoFocus
          className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-ring"
        />
      )}
      {!noteOpen && slot.note && <p className="-mt-1 text-[13px] text-muted-foreground/70">Note: {slot.note}</p>}

      <MoreSheet
        open={moreOpen}
        exerciseName={exercise.name}
        exerciseId={exercise.id}
        shorthandHint={goal?.load !== null && goal?.load !== undefined ? `${goal.load}.${goal.prefillRepsPerSet.join('.')}` : '27.12.12'}
        swapNames={swapNames}
        hasNote={!!slot.note}
        gated={gated}
        onClose={() => setMoreOpen(false)}
        onTypeIt={() => setShorthandOpen(true)}
        onSwap={onSwap}
        onNote={() => setNoteOpen(true)}
      />
    </section>
  )
}

function initDrafts(goal: Goal | null): Draft[] {
  if (!goal) return []
  return Array.from({ length: goal.sets }, (_, i) => ({ load: goal.load, reps: goal.prefillRepsPerSet[i] ?? goal.hi }))
}
