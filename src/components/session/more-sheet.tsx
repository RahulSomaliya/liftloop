'use client'

import { ArrowUpDown, ChevronRight, Keyboard, PencilLine, Settings2 } from 'lucide-react'
import Link from 'next/link'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'

interface Props {
  open: boolean
  exerciseName: string
  exerciseId: string
  shorthandHint: string
  swapNames: string[]
  hasNote: boolean
  /** true while unsaved set writes are queued: swap / type-it-instead wait (spec §11.2) */
  gated: boolean
  onClose(): void
  onTypeIt(): void
  onSwap(): void
  onNote(): void
}

/** The rarely used card actions, two taps away (spec §6.3 v1.3: "only the buttons I actually use"). */
export function MoreSheet({ open, exerciseName, exerciseId, shorthandHint, swapNames, hasNote, gated, onClose, onTypeIt, onSwap, onNote }: Props) {
  const row = 'flex h-15 w-full items-center gap-3.5 border-t border-border px-1 text-left first:border-t-0 disabled:opacity-40'
  const iconBox = 'flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground'
  const act = (fn: () => void) => () => {
    onClose()
    fn()
  }
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="gap-3 rounded-t-3xl border-border bg-card px-5 pb-[calc(var(--safe-bottom)+2rem)]">
        <SheetTitle className="px-1 text-[17px] font-bold">{exerciseName}</SheetTitle>
        <SheetDescription className="sr-only">More actions for this exercise</SheetDescription>
        <div className="flex flex-col">
          <button type="button" onClick={act(onTypeIt)} disabled={gated} title={gated ? 'Wait for sets to save' : undefined} className={row}>
            <span className={iconBox}>
              <Keyboard size={20} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-semibold">Type it instead</span>
              <span className="truncate text-[13px] text-muted-foreground/70">{shorthandHint} logs every set at once</span>
            </span>
            <ChevronRight size={16} className="text-muted-foreground/70" />
          </button>
          <button type="button" onClick={act(onSwap)} disabled={gated} title={gated ? 'Wait for sets to save' : undefined} className={row}>
            <span className={iconBox}>
              <ArrowUpDown size={20} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-semibold">Swap exercise</span>
              <span className="truncate text-[13px] text-muted-foreground/70">{swapNames.length ? swapNames.join(' · ') : 'No swaps set up'}</span>
            </span>
            <ChevronRight size={16} className="text-muted-foreground/70" />
          </button>
          <button type="button" onClick={act(onNote)} className={row}>
            <span className={iconBox}>
              <PencilLine size={20} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-semibold">{hasNote ? 'Edit the note' : 'Add a note'}</span>
              <span className="truncate text-[13px] text-muted-foreground/70">Grip, seat height, how it felt</span>
            </span>
            <ChevronRight size={16} className="text-muted-foreground/70" />
          </button>
          <Link href={`/exercise/${exerciseId}/edit`} onClick={onClose} className={row}>
            <span className={iconBox}>
              <Settings2 size={20} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-semibold">Exercise settings</span>
              <span className="truncate text-[13px] text-muted-foreground/70">Unit, load type, weight steps</span>
            </span>
            <ChevronRight size={16} className="text-muted-foreground/70" />
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}
