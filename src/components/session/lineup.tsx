'use client'

import { Check, ChevronRight, List } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

// Focus mode (spec §6.3 v1.2): the session shows ONE exercise. These pieces are the only view of
// the whole lineup — a 4 px strip under the header, a sheet listing every exercise, and the same
// list as the recap once everything is done.

export type LineupState = 'done' | 'now' | 'todo'

export interface LineupItem {
  id: string
  name: string
  /** verdict line when done, "k of n sets · goal" when current, goal line when upcoming */
  sub: string
  state: LineupState
  postponed: boolean
  /** superset partner of the previous item ("then") */
  then: boolean
}

export function LineupStrip({ states, onOpen }: { states: LineupState[]; onOpen(): void }) {
  const now = states.indexOf('now')
  const label = `${now === -1 ? states.length : now + 1} of ${states.length}`
  return (
    <button type="button" onClick={onOpen} aria-label={`Lineup, exercise ${label}`} className="flex h-11 w-full items-center gap-3 px-4 text-left">
      <span className="text-[13px] font-semibold tabular-nums text-muted-foreground">{label}</span>
      <span className="flex flex-1 gap-1" aria-hidden>
        {states.map((st, i) => (
          <span key={i} className={cn('h-1 flex-1 rounded-full', st === 'done' ? 'bg-primary' : st === 'now' ? 'bg-primary/15 shadow-[inset_0_0_0_1px_var(--primary)]' : 'bg-secondary')} />
        ))}
      </span>
      <span className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
        <List size={16} aria-hidden /> Lineup
      </span>
    </button>
  )
}

export function LineupRows({ items, onJump, className }: { items: LineupItem[]; onJump?: (index: number) => void; className?: string }) {
  return (
    <div className={cn('flex flex-col rounded-2xl border border-border', className)}>
      {items.map((it, i) => {
        const inner = (
          <>
            <span className="flex w-7 shrink-0 items-center justify-center">
              {it.state === 'done' ? <Check size={18} strokeWidth={2.6} className="text-success" aria-label="done" /> : it.state === 'now' ? <span className="size-2.5 rounded-full bg-primary" aria-label="current" /> : <span className="text-[13px] font-semibold tabular-nums text-muted-foreground/70">{it.then ? '+' : i + 1}</span>}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-1.5">
                <span className={cn('truncate text-[15px] font-semibold', it.state === 'done' && 'text-muted-foreground')}>{it.name}</span>
                {it.postponed && <span className="shrink-0 rounded-md border border-border px-1.5 py-px text-[11px] font-semibold text-muted-foreground/70">postponed</span>}
              </span>
              <span className="truncate text-[13px] tabular-nums text-muted-foreground/70">{it.sub}</span>
            </span>
            {it.state === 'now' ? <span className="text-[12px] font-bold text-primary">now</span> : it.state === 'todo' && onJump ? <ChevronRight size={16} className="text-muted-foreground/70" aria-hidden /> : null}
          </>
        )
        const cls = 'flex h-14 w-full items-center gap-3 border-t border-border px-3 text-left first:border-t-0'
        return onJump ? (
          <button key={it.id} type="button" onClick={() => onJump(i)} aria-current={it.state === 'now' ? 'true' : undefined} className={cls}>
            {inner}
          </button>
        ) : (
          <div key={it.id} className={cls}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}

export function LineupSheet({ open, items, elapsedMin, onClose, onJump, onShort }: { open: boolean; items: LineupItem[]; elapsedMin: number; onClose(): void; onJump(index: number): void; onShort: (() => void) | null }) {
  const done = items.filter((i) => i.state === 'done').length
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="gap-3 rounded-t-3xl border-border bg-card px-4 pb-[calc(var(--safe-bottom)+2rem)]">
        <div className="flex items-baseline justify-between pl-2 pr-9">
          <SheetTitle className="text-[17px] font-bold">Lineup</SheetTitle>
          <span className="text-[13px] tabular-nums text-muted-foreground/70">
            {done} of {items.length} done · {elapsedMin} min
          </span>
        </div>
        <SheetDescription className="px-2 text-[13px] text-muted-foreground">Tap an exercise to do it now. Postponed ones wait one place behind the current one.</SheetDescription>
        <LineupRows
          items={items}
          className="max-h-[60dvh] overflow-y-auto"
          onJump={(i) => {
            onJump(i)
            onClose()
          }}
        />
        {onShort && (
          <button
            type="button"
            onClick={() => {
              onClose()
              onShort()
            }}
            className="py-1 text-center text-[14px] font-medium text-muted-foreground/70"
          >
            Finish as short session
          </button>
        )}
      </SheetContent>
    </Sheet>
  )
}
