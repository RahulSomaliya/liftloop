'use client'

import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'

export interface SwapRequest {
  exerciseName: string
  options: { id: string; name: string }[]
  onPick(exerciseId: string): void
}

/** Swap picker (spec §6.3): the slot's swap list plus the original exercise when already swapped. */
export function SwapSheet({ request, onClose, busy }: { request: SwapRequest | null; onClose(): void; busy: boolean }) {
  return (
    <Sheet open={request !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="gap-3 rounded-t-3xl border-border bg-card px-4 pb-8">
        <SheetTitle className="px-2 text-[17px] font-bold">Swap {request?.exerciseName}</SheetTitle>
        <SheetDescription className="px-2 text-[13px] text-muted-foreground">The goal is recomputed for the new exercise. Sets already logged in this slot are removed.</SheetDescription>
        <div className="flex flex-col divide-y divide-border rounded-2xl border border-border">
          {request?.options.length === 0 && <p className="px-4 py-4 text-[14px] text-muted-foreground">No swaps configured for this exercise.</p>}
          {request?.options.map((o) => (
            <button key={o.id} type="button" disabled={busy} onClick={() => request.onPick(o.id)} className="flex h-14 items-center px-4 text-left text-[15px] font-semibold disabled:opacity-50">
              {o.name}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}
