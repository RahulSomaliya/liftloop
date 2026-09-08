'use client'

import { ChevronDown, ChevronLeft, ChevronRight, Timer } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { finishSession, postponeExercise, setExerciseNote, swapExercise } from '@/actions/session'
import { logSetsFromShorthand } from '@/actions/sets'
import { useRouter } from 'next/navigation'
import type { SessionView } from '@/db/queries/session'
import type { SessionSummary } from '@/db/queries/summary'
import type { SetWriteResult } from '@/actions/sets'
import { primeAudio } from '@/lib/beep'
import { nextIncomplete, postponeAt } from '@/lib/domain/lineup'
import type { LoggedSet } from '@/lib/domain/types'
import { collapsedLine, getVerdict } from '@/lib/domain/verdict'
import { useQueue } from '@/lib/queue/provider'
import type { QueueOp } from '@/lib/queue/types'
import { cn } from '@/lib/utils'
import { CheckinSheet, type CheckinValues } from './checkin-sheet'
import { ExerciseCard, type Slot, type SlotSet } from './exercise-card'
import { KeypadSheet, type KeypadRequest } from './keypad-sheet'
import { LineupRows, LineupSheet, LineupStrip, type LineupItem, type LineupState } from './lineup'
import { Summary } from './summary'
import { SwapSheet, type SwapRequest } from './swap-sheet'
import { useWakeLock } from './use-wake-lock'
import { fmtClock, useRestTimer } from './use-rest-timer'

const UNDO_MS = 5000 // postpone undo toast

function initSlots(view: SessionView): Slot[] {
  return view.exercises.map((e) => {
    const sets: SlotSet[] = e.setLogs.map((s) => ({ ...s, status: 'saved' as const }))
    const logged: LoggedSet[] = sets.map((s) => ({ setIndex: s.setIndex, load: s.load, reps: s.reps, toFailure: s.toFailure }))
    const collapsed = e.verdict && e.nextNote ? collapsedLine(e.exercise, logged, { verdict: e.verdict, nextNote: e.nextNote }) : null
    return { id: e.id, exercise: e.exercise, goal: e.goal, sets, collapsed, restSeconds: e.restSeconds, supersetGroup: e.supersetGroup, note: e.note, swappedFrom: e.swappedFrom }
  })
}

function isComplete(slot: Slot): boolean {
  const n = slot.goal?.sets ?? 0
  return n > 0 && Array.from({ length: n }, (_, i) => slot.sets.some((s) => s.setIndex === i)).every(Boolean)
}

/**
 * Focus mode (spec §6.3 v1.2): one exercise on screen — the one at `openIndex` — with a 4 px
 * lineup strip under the header and a Lineup sheet for the rest. `slots` follow the session's
 * order_index; postpone reorders them (server + optimistic) so the postponed one comes back after
 * the next exercise.
 */
export function SessionScreen({ view }: { view: SessionView }) {
  const { runner, pending, subscribe } = useQueue()
  // Optimistic view from the first render: server rows with this session's queued ops overlaid.
  const [slots, setSlots] = useState<Slot[]>(() => initSlots(view).map((slot) => applyOps(slot, runner.opsFor(slot.id))))
  const [openIndex, setOpenIndex] = useState<number | null>(() => {
    const idx = initSlots(view).map((slot) => applyOps(slot, runner.opsFor(slot.id))).findIndex((s) => !isComplete(s))
    return idx === -1 ? null : idx
  })
  // A server re-render (after a swap or postpone) hands us a new view: rebuild the slots from it.
  const [prevView, setPrevView] = useState(view)
  if (view !== prevView) {
    setPrevView(view)
    const fresh = initSlots(view).map((slot) => applyOps(slot, runner.opsFor(slot.id)))
    setSlots(fresh)
    const idx = fresh.findIndex((s) => !isComplete(s))
    setOpenIndex(idx === -1 ? null : idx)
  }
  const slotsRef = useRef(slots)
  useEffect(() => {
    slotsRef.current = slots
  }, [slots])
  const router = useRouter()
  const [swap, setSwap] = useState<SwapRequest | null>(null)
  const [swapBusy, setSwapBusy] = useState(false)
  const [keypad, setKeypad] = useState<KeypadRequest | null>(null)
  const [checkin, setCheckin] = useState<{ open: boolean; short: boolean }>({ open: false, short: false })
  const [finishing, setFinishing] = useState(false)
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [warmupOpen, setWarmupOpen] = useState(false)
  const [lineupOpen, setLineupOpen] = useState(false)
  // Ids postponed in this visit — a tag in the lineup, nothing more (order lives on the server).
  const [postponed, setPostponed] = useState<ReadonlySet<string>>(() => new Set())
  const [elapsedMin, setElapsedMin] = useState(() => Math.max(0, Math.round((Date.now() - new Date(view.startedAt).getTime()) / 60000)))
  const timer = useRestTimer({ ping: view.rest.ping })
  const sessionPending = runner.pendingFor(view.id)
  useWakeLock(true)
  const online = useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb)
      window.addEventListener('offline', cb)
      return () => {
        window.removeEventListener('online', cb)
        window.removeEventListener('offline', cb)
      }
    },
    () => navigator.onLine,
    () => true,
  )

  useEffect(() => {
    const id = setInterval(() => setElapsedMin(Math.max(0, Math.round((Date.now() - new Date(view.startedAt).getTime()) / 60000))), 15000)
    return () => clearInterval(id)
  }, [view.startedAt])

  // Server results replace optimistic rows (rev, PR flag) and settle the verdict line.
  useEffect(
    () =>
      subscribe((op, result) => {
        setSlots((prev) =>
          prev.map((slot) => {
            if (slot.id !== op.sessionExerciseId) return slot
            const sets = result.row.deleted
              ? slot.sets.filter((s) => s.setIndex !== op.setIndex)
              : upsertSet(slot.sets, { setIndex: result.row.setIndex, rev: result.row.rev, load: result.row.load, reps: result.row.reps, toFailure: result.row.toFailure, isPr: result.row.isPr, status: 'saved' })
            return { ...slot, sets, collapsed: result.exerciseDone?.collapsed ?? (isCompleteSets(slot, sets) ? slot.collapsed : null) }
          }),
        )
      }),
    [subscribe],
  )

  const enqueueLog = useCallback(
    (slot: Slot, setIndex: number, load: number, reps: number | null, toFailure: boolean) => {
      const existing = slot.sets.find((s) => s.setIndex === setIndex)
      const rev = (existing?.rev ?? 0) + 1
      runner.enqueue({ kind: 'logSet', sessionId: view.id, sessionExerciseId: slot.id, setIndex, rev, load, reps, toFailure, unit: slot.exercise.unit })
      return rev
    },
    [runner, view.id],
  )

  function onLog(slotIndex: number, setIndex: number, load: number, reps: number | null, toFailure: boolean) {
    primeAudio()
    const slot = slots[slotIndex]
    const rev = enqueueLog(slot, setIndex, load, reps, toFailure)
    const nextSets = upsertSet(slot.sets, { setIndex, rev, load, reps, toFailure, isPr: false, status: 'pending' })
    const complete = isCompleteSets(slot, nextSets)
    let collapsed = slot.collapsed
    if (complete && slot.goal) {
      const logged: LoggedSet[] = nextSets.map((s) => ({ setIndex: s.setIndex, load: s.load, reps: s.reps, toFailure: s.toFailure }))
      const v = getVerdict({ goal: slot.goal, loggedSets: logged, exercise: slot.exercise, gym: view.gym, nextWeekPhase: view.nextWeekPhase })
      collapsed = collapsedLine(slot.exercise, logged, v)
    }
    setSlots((prev) => prev.map((s, i) => (i === slotIndex ? { ...s, sets: nextSets, collapsed: complete ? collapsed : null } : s)))
    timer.start(view.rest.overrideSeconds ?? slot.restSeconds)
    if (complete) {
      const done = slots.map((s, i) => (i === slotIndex ? true : isComplete(s)))
      const next = nextIncomplete(done, slotIndex)
      setOpenIndex(next === -1 ? null : next)
    }
  }

  // Undo for a logged set lives on the row (tap → "remove set"), not in a toast (v1.3).
  function onRemoveSet(slotIndex: number, setIndex: number) {
    const slot = slots[slotIndex]
    const existing = slot.sets.find((s) => s.setIndex === setIndex)
    if (!existing) return
    runner.enqueue({ kind: 'deleteSet', sessionId: view.id, sessionExerciseId: slot.id, setIndex, rev: existing.rev + 1 })
    setSlots((prev) => prev.map((s, i) => (i === slotIndex ? { ...s, sets: s.sets.filter((x) => x.setIndex !== setIndex), collapsed: null } : s)))
    timer.clear()
    setOpenIndex(slotIndex)
  }

  function onSwap(slotIndex: number) {
    const slot = slots[slotIndex]
    const options = view.exercises.find((e) => e.id === slot.id)?.swapOptions ?? []
    setSwap({
      exerciseName: slot.exercise.name,
      options,
      onPick: (exerciseId) => {
        setSwapBusy(true)
        swapExercise({ sessionExerciseId: slot.id, exerciseId })
          .then(() => {
            setSwap(null)
            toast.success('Swapped — goal recomputed')
            router.refresh()
          })
          .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not swap'))
          .finally(() => setSwapBusy(false))
      },
    })
  }

  // Postpone (v1.2): the slot trades places with the next one, optimistically, then on the server.
  // Undo postpones the exercise that jumped ahead, which swaps them back.
  async function movePostpone(index: number, id: string, tag: boolean) {
    const before = slotsRef.current
    if (index < 0 || index >= before.length - 1) return
    setSlots((prev) => postponeAt(prev, index))
    setPostponed((p) => {
      const next = new Set(p)
      if (tag) next.add(id)
      else next.delete(id)
      return next
    })
    try {
      await postponeExercise({ sessionExerciseId: before[index].id })
    } catch (e) {
      setSlots(before)
      setPostponed((p) => {
        const next = new Set(p)
        if (tag) next.delete(id)
        else next.add(id)
        return next
      })
      toast.error(e instanceof Error ? e.message : 'Could not postpone')
      throw e
    }
  }
  async function onPostpone(slotIndex: number) {
    const slot = slots[slotIndex]
    try {
      await movePostpone(slotIndex, slot.id, true)
    } catch {
      return
    }
    toast(`${slot.exercise.name} moved after this one`, {
      duration: UNDO_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          const j = slotsRef.current.findIndex((s) => s.id === slot.id)
          if (j > 0) void movePostpone(j - 1, slot.id, false).catch(() => undefined)
        },
      },
    })
  }

  async function onShorthand(slotIndex: number, line: string): Promise<boolean> {
    const slot = slots[slotIndex]
    try {
      const r = await logSetsFromShorthand({ sessionExerciseId: slot.id, line })
      if (r.errors.length) {
        toast.error(r.errors[0])
        return false
      }
      const sets: SlotSet[] = r.rows.map((x) => ({ setIndex: x.setIndex, rev: x.rev, load: x.load, reps: x.reps, toFailure: x.toFailure, isPr: x.isPr, status: 'saved' }))
      setSlots((prev) => prev.map((s, i) => (i === slotIndex ? { ...s, sets, collapsed: r.exerciseDone?.collapsed ?? null } : s)))
      if (r.exerciseDone) {
        const done = slots.map((s, i) => (i === slotIndex ? true : isComplete(s)))
        const next = nextIncomplete(done, slotIndex)
        setOpenIndex(next === -1 ? null : next)
      }
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not log the line')
      return false
    }
  }

  async function onNote(slot: Slot, note: string) {
    try {
      await setExerciseNote({ sessionExerciseId: slot.id, note })
      setSlots((prev) => prev.map((s) => (s.id === slot.id ? { ...s, note: note.trim() || null } : s)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the note')
    }
  }

  async function onFinish(values: CheckinValues) {
    setFinishing(true)
    try {
      const s = await finishSession({ sessionId: view.id, type: values.type, sleepGood: values.sleepGood, shoulderPain: values.shoulderPain, elbowPain: values.elbowPain, note: values.note || null })
      timer.clear()
      setSummary(s)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not finish — try again')
    } finally {
      setFinishing(false)
    }
  }

  const complete = useMemo(() => slots.map(isComplete), [slots])
  const allDone = complete.every(Boolean)
  // "Finish as short session" (spec §6.3): only the first exercise done — so it stays available
  // after that exercise completes and the screen has moved on to the next one.
  const shortAvailable = !allDone && complete.filter(Boolean).length <= 1
  const nothingLogged = slots.every((s) => s.sets.length === 0)
  const current = openIndex === null ? null : (slots[openIndex] ?? null)
  const nextIdx = openIndex === null ? -1 : nextIncomplete(complete, openIndex)
  const items: LineupItem[] = slots.map((s, i) => {
    const state: LineupState = i === openIndex ? 'now' : complete[i] ? 'done' : 'todo'
    const sub = state === 'done' ? (s.collapsed ?? 'done') : state === 'now' ? `${s.sets.length} of ${s.goal?.sets ?? 0} sets · ${s.goal?.line ?? ''}` : (s.goal?.line ?? '')
    return { id: s.id, name: s.exercise.name, sub, state, postponed: postponed.has(s.id), then: s.supersetGroup !== null && slots[i - 1]?.supersetGroup === s.supersetGroup }
  })
  const nextItem = nextIdx !== -1 && nextIdx !== openIndex ? items[nextIdx] : null
  const nextIsPartner = nextItem !== null && openIndex !== null && nextIdx === openIndex + 1 && nextItem.then

  function openCheckin(short: boolean) {
    toast.dismiss() // undo toasts sit exactly where the sheet's Save button lands
    setCheckin({ open: true, short })
  }

  if (summary) return <Summary summary={summary} />

  return (
    // The (app) shell pads for the status bar; this screen's sticky header paints under it instead.
    <div className="mt-[calc(var(--safe-top)*-1)] flex flex-col">
      <header className="sticky top-0 z-10 flex h-[calc(3.5rem+var(--safe-top))] items-center justify-between border-b border-border bg-card px-3 pr-4 pt-[var(--safe-top)]">
        <div className="flex items-center gap-2.5">
          <Link href="/" aria-label="Back to Home" className="flex size-11 items-center justify-center text-muted-foreground">
            <ChevronLeft size={22} />
          </Link>
          <div className="flex flex-col">
            <span className="text-[15px] font-bold">{view.templateName ?? 'Session'}</span>
            <span className="text-[12px] tabular-nums text-muted-foreground/70">{elapsedMin} min elapsed</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sessionPending > 0 && <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[12px] font-semibold text-primary">{sessionPending} unsaved</span>}
          <button
            type="button"
            onClick={timer.clear}
            aria-label={timer.running ? `Rest ${fmtClock(timer.remaining)}, tap to dismiss` : timer.done ? 'Rest over, go' : 'Rest timer'}
            className={cn('flex h-9 items-center gap-1.5 rounded-full px-3 text-[15px] font-bold tabular-nums', timer.running ? 'bg-primary text-primary-foreground' : timer.done ? 'animate-pulse bg-success/20 text-success motion-reduce:animate-none' : 'bg-secondary text-muted-foreground')}
          >
            <Timer size={16} /> {timer.running ? fmtClock(timer.remaining) : timer.done ? 'go' : '—'}
          </button>
          <button type="button" onClick={() => openCheckin(false)} className="text-[14px] font-semibold text-muted-foreground">
            Wrap up
          </button>
        </div>
        {(timer.running || timer.done) && <span aria-hidden className={cn('absolute bottom-[-1px] left-0 h-0.5 transition-[width] duration-200', timer.done ? 'bg-success' : 'bg-primary')} style={{ width: `${Math.round(timer.progress * 100)}%` }} />}
      </header>

      <LineupStrip states={items.map((i) => i.state)} onOpen={() => setLineupOpen(true)} />

      <main className="flex flex-col gap-3 px-3">
        {!online && (
          <p role="status" className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-[13px]">
            Offline — sets are saved on this phone and sync when you reconnect{sessionPending ? ` (${sessionPending} waiting)` : ''}.
          </p>
        )}
        {nothingLogged && (
          <>
            <button type="button" onClick={() => setWarmupOpen((o) => !o)} className="flex items-center justify-between rounded-xl border border-dashed border-border px-4 py-2.5 text-[13px] font-medium text-muted-foreground/70">
              <span>Warm-up checklist</span>
              <ChevronDown size={18} className={cn('transition-transform', warmupOpen && 'rotate-180')} />
            </button>
            {warmupOpen && (
              <ul className="-mt-1 flex flex-col gap-1.5 px-4 text-[14px] text-muted-foreground">
                {view.warmup.map((w) => (
                  <li key={w}>· {w}</li>
                ))}
              </ul>
            )}
          </>
        )}

        {current && openIndex !== null ? (
          <>
            <ExerciseCard
              key={current.id}
              slot={current}
              gym={view.gym}
              restSeconds={view.rest.overrideSeconds ?? current.restSeconds}
              swapNames={(view.exercises.find((e) => e.id === current.id)?.swapOptions ?? []).map((o) => o.name)}
              onLog={(setIndex, load, reps, toFailure) => onLog(openIndex, setIndex, load, reps, toFailure)}
              onRemoveSet={(setIndex) => onRemoveSet(openIndex, setIndex)}
              onKeypad={setKeypad}
              onNote={(note) => onNote(current, note)}
              onSwap={() => onSwap(openIndex)}
              onShorthand={(line) => onShorthand(openIndex, line)}
              onPostpone={openIndex < slots.length - 1 ? () => void onPostpone(openIndex) : null}
              gated={sessionPending > 0}
            />
            {nextItem && (
              <button type="button" onClick={() => setLineupOpen(true)} className="flex items-center justify-between gap-2 px-4 text-left text-[13px] text-muted-foreground/70">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0">{nextIsPartner ? 'Then ·' : 'Up next ·'}</span>
                  <span className="truncate font-medium text-muted-foreground">{nextItem.name}</span>
                  {nextItem.postponed && <span className="shrink-0 rounded-md border border-border px-1.5 py-px text-[11px] font-semibold">postponed</span>}
                </span>
                <ChevronRight size={14} aria-hidden />
              </button>
            )}
            {shortAvailable && (
              <button type="button" onClick={() => openCheckin(true)} className="py-1 text-center text-[14px] font-medium text-muted-foreground/70">
                Wrap up early
              </button>
            )}
          </>
        ) : (
          <>
            <LineupRows items={items} className="bg-card" />
            <button type="button" onClick={() => openCheckin(false)} className="mt-1 flex h-14 items-center justify-center rounded-2xl bg-primary text-[17px] font-bold text-primary-foreground">
              I&apos;m done
            </button>
          </>
        )}
      </main>

      <LineupSheet
        open={lineupOpen}
        items={items}
        elapsedMin={elapsedMin}
        onClose={() => setLineupOpen(false)}
        onJump={(i) => setOpenIndex(i)}
        onShort={shortAvailable ? () => openCheckin(true) : null}
      />
      <KeypadSheet request={keypad} onClose={() => setKeypad(null)} />
      <SwapSheet request={swap} busy={swapBusy} onClose={() => setSwap(null)} />
      <CheckinSheet
        key={String(checkin.open)}
        open={checkin.open}
        short={checkin.short}
        templateName={view.templateName ?? 'Session'}
        elapsedMin={elapsedMin}
        setCount={slots.reduce((n, s) => n + s.sets.length, 0)}
        initialSleep={view.todaySleepGood}
        pendingSets={pending === 0 ? 0 : sessionPending}
        busy={finishing}
        onClose={() => setCheckin((c) => ({ ...c, open: false }))}
        onSave={onFinish}
      />
    </div>
  )
}

function upsertSet(sets: SlotSet[], next: SlotSet): SlotSet[] {
  const others = sets.filter((s) => s.setIndex !== next.setIndex)
  return [...others, next].sort((a, b) => a.setIndex - b.setIndex)
}

function isCompleteSets(slot: Slot, sets: SlotSet[]): boolean {
  const n = slot.goal?.sets ?? 0
  return n > 0 && Array.from({ length: n }, (_, i) => sets.some((s) => s.setIndex === i)).every(Boolean)
}

function applyOps(slot: Slot, ops: QueueOp[]): Slot {
  let sets = slot.sets
  for (const op of ops) {
    if (op.kind === 'logSet') sets = upsertSet(sets, { setIndex: op.setIndex, rev: op.rev, load: op.load, reps: op.reps, toFailure: op.toFailure, isPr: false, status: 'pending' })
    else if (op.kind === 'deleteSet') sets = sets.filter((s) => s.setIndex !== op.setIndex)
  }
  return { ...slot, sets }
}

export type { SetWriteResult }
