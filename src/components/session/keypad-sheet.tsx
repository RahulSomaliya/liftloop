'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'

export interface KeypadRequest {
  title: string
  unit: string
  value: number | null
  /** allow negative / decimal input */
  decimal: boolean
  onDone(value: number): void
}

/** Numeric keypad sheet opened by a long-press on a chip (spec §6.3). */
export function KeypadSheet({ request, onClose }: { request: KeypadRequest | null; onClose(): void }) {
  const [text, setText] = useState('')
  const [prevRequest, setPrevRequest] = useState<KeypadRequest | null>(null)
  if (request !== prevRequest) {
    setPrevRequest(request)
    setText(request?.value === null || request?.value === undefined ? '' : String(request.value))
  }

  const parsed = Number(text.replace(',', '.'))
  const valid = text.trim() !== '' && !Number.isNaN(parsed)

  return (
    <Sheet open={request !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="gap-4 rounded-t-3xl border-border bg-card px-5 pb-8">
        <SheetTitle className="text-[17px] font-bold">{request?.title}</SheetTitle>
        <SheetDescription className="sr-only">Enter a value</SheetDescription>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid || !request) return
            request.onDone(parsed)
            onClose()
          }}
        >
          <label className="flex h-16 items-center gap-2 rounded-2xl border border-border bg-secondary px-4">
            <input
              autoFocus
              inputMode={request?.decimal ? 'decimal' : 'numeric'}
              enterKeyHint="done"
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label={request?.title}
              className="w-full min-w-0 bg-transparent text-[28px] font-semibold tabular-nums outline-none"
            />
            <span className="text-[15px] text-muted-foreground">{request?.unit}</span>
          </label>
          <Button type="submit" disabled={!valid} className="h-14 rounded-2xl text-[17px] font-bold">
            Done
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
