'use client'

import { ArrowRightToLine, ArrowUp, Check, ChevronDown, Equal, Minus, Plus } from 'lucide-react'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { formatLoad } from '@/lib/domain/load-format'
import { step, stepDown } from '@/lib/domain/stepping'
import type { ExerciseCfg, Goal, GymCfg, Mark } from '@/lib/domain/types'
import { markFor } from '@/lib/domain/verdict'
import { cn } from '@/lib/utils'
import type { KeypadRequest } from './keypad-sheet'

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
  open: boolean
  onOpen(): void
  onLog(setIndex: number, load: number, reps: number | null, toFailure: boolean): void
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
type Active = { setIndex: number; field: 'load' | 'reps' } | null

const LONG_PRESS_MS = 500

function useLongPress(onLong: () => void, onTap: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longFired = useRef(false)
  return {
    onPointerDown: () => {
      longFired.current = false
      timer.current = setTimeout(() => {
        longFired.current = true
        onLong()
      }, LONG_PRESS_MS)
    },
    onPointerUp: () => {
      if (timer.current) clearTimeout(timer.current)
      if (!longFired.current) onTap()
    },
    onPointerLeave: () => {
      if (timer.current) clearTimeout(timer.current)
    },
    onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
  }
}

function MarkIcon({ mark }: { mark: Mark }) {
  if (mark === 'up') return <ArrowUp size={14} strokeWidth={2.6} className="text-success" aria-label="above goal" />
  if (mark === 'eq') return <Equal size={14} strokeWidth={2.6} className="text-muted-foreground" aria-label="matched goal" />
  if (mark === 'down') return <ChevronDown size={14} strokeWidth={2.6} className="text-muted-foreground/70" aria-label="under goal" />
  return null
}

export function ExerciseCard({ slot, gym, open, onOpen, onLog, onKeypad, onNote, onSwap, onShorthand, onPostpone, gated }: Props) {
  const { exercise, goal } = slot
  const setCount = goal?.sets ?? 0
  const [drafts, setDrafts] = useState<Draft[]>(() => initDrafts(goal))
  const [prevGoal, setPrevGoal] = useState(goal)
  if (goal !== prevGoal) {
    setPrevGoal(goal)
    setDrafts(initDrafts(goal))
  }
  const [active, setActive] = useState<Active>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState(slot.note ?? '')
  const [shorthandOpen, setShorthandOpen] = useState(false)
  const [line, setLine] = useState('')
  const [lineBusy, setLineBusy] = useState(false)

  const logged = new Map(slot.sets.map((s) => [s.setIndex, s]))
  const allLogged = setCount > 0 && Array.from({ length: setCount }, (_, i) => logged.has(i)).every(Boolean)
  const unit = exercise.unit

  function setLoad(i: number, load: number | null, cascade = true) {
    setDrafts((d) =>
      d.map((row, j) => {
        if (j === i) return { ...row, load }
        if (cascade && j > i && !logged.has(j)) return { ...row, load }
        return row
      }),
    )
  }
  function setReps(i: number, reps: number) {
    setDrafts((d) => d.map((row, j) => (j === i ? { ...row, reps: Math.max(0, reps) } : row)))
  }

  function bumpLoad(i: number, dir: 1 | -1) {
    const cur = drafts[i]?.load
    if (cur === null || cur === undefined) return
    const next = dir === 1 ? step(exercise, cur, gym) : stepDown(exercise, cur, gym)
    if (next !== null) setLoad(i, next)
  }

  function confirm(i: number) {
    const d = drafts[i]
    if (!d || d.load === null) {
      onKeypad({ title: `${exercise.name} — weight`, unit, value: null, decimal: true, onDone: (v) => setLoad(i, v) })
      return
    }
    onLog(i, d.load, d.reps, false)
    setActive(null)
    setEditing(null)
  }

  if (!open) {
    return (
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[15px] font-semibold">{exercise.name}</span>
          <span className={cn('truncate text-[13px] tabular-nums', allLogged ? 'text-muted-foreground' : 'text-muted-foreground/70')}>{allLogged ? (slot.collapsed ?? 'done') : (goal?.line ?? '')}</span>
        </span>
        {allLogged ? <Check size={18} className="text-success" aria-label="done" /> : <ChevronDown size={18} className="text-muted-foreground/70" />}
      </button>
    )
  }

  return (
    <section className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-4" aria-label={exercise.name}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-bold tracking-[-0.01em]">
          <Link href={`/exercise/${exercise.id}`}>{exercise.name}</Link>
        </h2>
        {goal && (
          <span className="whitespace-nowrap text-[13px] tabular-nums text-muted-foreground/70">
            {goal.lo === goal.hi ? goal.hi : `${goal.lo}–${goal.hi}`}
            {' × '}{goal.sets}
          </span>
        )}
      </div>
      {slot.swappedFrom && <p className="-mt-2 text-[12px] text-muted-foreground/70">swapped from {slot.swappedFrom.name}</p>}
      {goal && <p className="text-[24px] font-bold leading-[1.15] tracking-[-0.02em] tabular-nums">{goal.line}</p>}
      {exercise.cue && <p className="-mt-1 text-[13px] leading-snug text-muted-foreground">{exercise.cue}</p>}

      <div className="flex flex-col gap-2.5">
        {Array.from({ length: setCount }, (_, i) => {
          const done = logged.get(i)
          const isEditing = editing === i
          if (done && !isEditing) {
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setDrafts((d) => d.map((row, j) => (j === i ? { load: done.load, reps: done.reps ?? row.reps } : row)))
                  setEditing(i)
                }}
                className="flex h-11 w-full items-center gap-2.5 rounded-xl bg-background px-3 text-left"
              >
                <span className="w-11 text-[13px] font-medium text-muted-foreground/70">Set {i + 1}</span>
                <span className="text-[17px] font-semibold tabular-nums">
                  {formatLoad(exercise, done.load)} × {done.reps === null ? 'f' : done.reps}
                </span>
                {goal && <MarkIcon mark={markFor(goal, i, done.reps)} />}
                {done.isPr && <span className="rounded border border-success px-1 text-[10px] font-bold tracking-wider text-success">PR</span>}
                {done.status === 'pending' && <span className="text-[11px] text-muted-foreground/70">saving…</span>}
                <span className="flex-1" />
                <span className="text-[13px] text-muted-foreground/70">edit</span>
              </button>
            )
          }
          const d = drafts[i] ?? { load: null, reps: goal?.hi ?? 0 }
          const ghost = goal?.ghost
          // While a −/+ stepper is open the row is ~400 px wide; the ✓ moves to its own line so
          // nothing squeezes or overflows on a 393 px phone (real-device finding, 2026-09-08).
          const stepping = active?.setIndex === i
          const check = (
            <button
              type="button"
              onClick={() => confirm(i)}
              aria-label={`Log set ${i + 1} as ${d.load === null ? 'unset' : formatLoad(exercise, d.load)} × ${d.reps}`}
              className="flex h-12 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground active:scale-95"
            >
              <Check size={24} strokeWidth={2.6} />
            </button>
          )
          return (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="w-11 text-[13px] font-medium text-muted-foreground/70">Set {i + 1}</span>
                <Chip
                  label={d.load === null ? 'tap to set' : formatLoad(exercise, d.load)}
                  empty={d.load === null}
                  width="w-[108px]"
                  active={active?.setIndex === i && active.field === 'load'}
                  onTap={() => (d.load === null ? confirm(i) : setActive(active?.setIndex === i && active.field === 'load' ? null : { setIndex: i, field: 'load' }))}
                  onLong={() => onKeypad({ title: `${exercise.name} — weight`, unit, value: d.load, decimal: true, onDone: (v) => setLoad(i, v) })}
                  onMinus={() => bumpLoad(i, -1)}
                  onPlus={() => bumpLoad(i, 1)}
                />
                <Chip
                  label={String(d.reps)}
                  width="w-[72px]"
                  active={active?.setIndex === i && active.field === 'reps'}
                  onTap={() => setActive(active?.setIndex === i && active.field === 'reps' ? null : { setIndex: i, field: 'reps' })}
                  onLong={() => onKeypad({ title: `${exercise.name} — reps`, unit: 'reps', value: d.reps, decimal: false, onDone: (v) => setReps(i, Math.round(v)) })}
                  onMinus={() => setReps(i, d.reps - 1)}
                  onPlus={() => setReps(i, d.reps + 1)}
                />
                <span className="flex-1" />
                {!stepping && check}
              </div>
              {stepping && <div className="flex justify-end">{check}</div>}
              {ghost && !isEditing && (
                <div className="flex gap-2 pl-[52px] text-[12px] text-muted-foreground/60">
                  <span className="w-[108px] text-center">last {formatLoad(exercise, ghost.load)}</span>
                  <span className="w-[72px] text-center">last {ghost.reps[Math.min(i, ghost.reps.length - 1)] ?? '—'}</span>
                </div>
              )}
              {isEditing && (
                <button type="button" onClick={() => setEditing(null)} className="self-end pr-1 text-[12px] text-muted-foreground">
                  cancel
                </button>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 pt-1 text-[14px] font-medium text-muted-foreground">
        <button type="button" disabled={gated} title={gated ? 'Wait for sets to save' : undefined} onClick={() => setShorthandOpen((o) => !o)} className={cn('disabled:opacity-40', shorthandOpen && 'text-foreground')}>
          type it instead
        </button>
        <button type="button" disabled={gated} title={gated ? 'Wait for sets to save' : undefined} onClick={onSwap} className="disabled:opacity-40">
          swap
        </button>
        <button type="button" onClick={() => setNoteOpen((o) => !o)} className={cn(slot.note && 'text-foreground')}>
          note{slot.note ? ' ·' : ''}
        </button>
        {onPostpone && (
          <button type="button" onClick={onPostpone} title="Machine busy? Do the next exercise first" className="ml-auto flex items-center gap-1.5">
            postpone <ArrowRightToLine size={16} aria-hidden />
          </button>
        )}
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
          className="w-full rounded-xl border border-border bg-secondary px-3 py-2 text-[14px] outline-none focus:ring-2 focus:ring-ring"
        />
      )}
    </section>
  )
}

function initDrafts(goal: Goal | null): Draft[] {
  if (!goal) return []
  return Array.from({ length: goal.sets }, (_, i) => ({ load: goal.load, reps: goal.prefillRepsPerSet[i] ?? goal.hi }))
}

function Chip({ label, empty, width, active, onTap, onLong, onMinus, onPlus }: { label: string; empty?: boolean; width: string; active: boolean; onTap(): void; onLong(): void; onMinus(): void; onPlus(): void }) {
  const press = useLongPress(onLong, onTap)
  return (
    <div className="flex items-center gap-1">
      {active && (
        <button type="button" onClick={onMinus} aria-label="decrease" className="flex size-11 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground">
          <Minus size={20} />
        </button>
      )}
      <button
        type="button"
        {...press}
        className={cn('flex h-12 items-center justify-center rounded-xl border bg-secondary text-[20px] font-semibold tabular-nums tracking-[-0.01em] select-none', width, active ? 'border-primary' : 'border-border', empty && 'text-[13px] font-medium text-muted-foreground')}
      >
        {label}
      </button>
      {active && (
        <button type="button" onClick={onPlus} aria-label="increase" className="flex size-11 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground">
          <Plus size={20} />
        </button>
      )}
    </div>
  )
}
