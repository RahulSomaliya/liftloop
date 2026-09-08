'use client'

import { Delete } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export interface KeypadRequest {
  exerciseName: string
  /** "Weight for set 1" */
  label: string
  /** 'kg' | 'lb' | 'reps' */
  unit: string
  value: number | null
  decimal: boolean
  /** ± by the exercise's stepping rule (weight) or 1 (reps); null hides the buttons */
  stepUp: ((v: number) => number) | null
  stepDown: ((v: number) => number | null) | null
  stepLabel: string | null
  /** "last 32.5" — last time's number */
  preset: { label: string; value: number } | null
  /** Exercise settings (unit, load type, steps) */
  settingsHref: string | null
  onDone(value: number): void
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

/**
 * In-app numeric keypad (spec §6.3 v1.3). Replaces the native keyboard: on iPhone the keyboard
 * pushed the sheet half off-screen and left a blank band behind after closing (first real
 * workout, 2026-09-08). Nothing here is a focusable text field, so no keyboard ever opens.
 */
export function KeypadSheet({ request, onClose }: { request: KeypadRequest | null; onClose(): void }) {
  const [text, setText] = useState('')
  const [prevRequest, setPrevRequest] = useState<KeypadRequest | null>(null)
  if (request !== prevRequest) {
    setPrevRequest(request)
    setText(request?.value === null || request?.value === undefined ? '' : String(request.value))
  }

  const parsed = Number(text)
  const valid = text !== '' && text !== '.' && !Number.isNaN(parsed)
  const unitLabel = request?.unit === 'reps' ? 'reps' : (request?.unit ?? '')

  function press(k: string) {
    setText((t) => {
      if (k === '.') return !request?.decimal || t.includes('.') ? t : t === '' ? '0.' : `${t}.`
      if (t === '0') return k
      if (t.length >= 6) return t
      return `${t}${k}`
    })
  }
  function backspace() {
    setText((t) => t.slice(0, -1))
  }
  function bump(dir: 1 | -1) {
    if (!request) return
    const base = valid ? parsed : (request.preset?.value ?? request.value ?? 0)
    const next = dir === 1 ? request.stepUp?.(base) : request.stepDown?.(base)
    if (next !== null && next !== undefined) setText(String(next))
  }
  function confirm() {
    if (!valid || !request) return
    request.onDone(parsed)
    onClose()
  }

  const keyCls = 'flex h-13 items-center justify-center rounded-xl text-[24px] font-semibold tabular-nums'
  const quickCls = 'flex h-10 items-center justify-center rounded-[10px] border px-3.5 text-[14px] font-semibold tabular-nums whitespace-nowrap'

  return (
    <Sheet open={request !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="gap-3.5 rounded-t-3xl border-border bg-card px-5 pb-[calc(var(--safe-bottom)+2rem)]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] font-semibold tracking-[0.04em] text-muted-foreground/70 uppercase">{request?.exerciseName}</span>
          <SheetTitle className="text-[17px] font-bold">{request?.label}</SheetTitle>
        </div>
        <SheetDescription className="sr-only">Enter a value with the keypad</SheetDescription>
        <div data-keypad-display aria-live="polite" className="flex h-[72px] items-baseline justify-center gap-2 rounded-2xl border border-border bg-background">
          <span className={cn('text-[44px] font-bold tabular-nums tracking-[-0.03em]', text === '' && 'text-muted-foreground/40')}>{text === '' ? '–' : text}</span>
          <span className="text-[17px] text-muted-foreground">{unitLabel}</span>
        </div>
        {(request?.stepUp || request?.preset) && (
          <div className="flex justify-center gap-2">
            {request.stepDown && (
              <button type="button" onClick={() => bump(-1)} aria-label="step down" className={cn(quickCls, 'border-border bg-secondary')}>
                − {request.stepLabel}
              </button>
            )}
            {request.preset && (
              <button type="button" onClick={() => setText(String(request.preset!.value))} className={cn(quickCls, String(request.preset.value) === text ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-secondary')}>
                {request.preset.label}
              </button>
            )}
            {request.stepUp && (
              <button type="button" onClick={() => bump(1)} aria-label="step up" className={cn(quickCls, 'border-border bg-secondary')}>
                + {request.stepLabel}
              </button>
            )}
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <button key={k} type="button" onClick={() => press(k)} aria-label={`digit ${k}`} className={cn(keyCls, 'bg-secondary')}>
              {k}
            </button>
          ))}
          <button type="button" onClick={() => press('.')} disabled={!request?.decimal} aria-label="decimal point" className={cn(keyCls, 'text-muted-foreground disabled:opacity-30')}>
            .
          </button>
          <button type="button" onClick={() => press('0')} aria-label="digit 0" className={cn(keyCls, 'bg-secondary')}>
            0
          </button>
          <button type="button" onClick={backspace} aria-label="backspace" className={cn(keyCls, 'text-muted-foreground')}>
            <Delete size={24} />
          </button>
        </div>
        <button type="button" onClick={confirm} disabled={!valid} aria-label="Confirm value" className="flex h-14 items-center justify-center rounded-2xl bg-primary text-[17px] font-bold text-primary-foreground disabled:opacity-40">
          {valid ? `Set ${text} ${unitLabel}` : 'Enter a number'}
        </button>
        {request?.settingsHref && (
          <p className="text-center text-[13px] text-muted-foreground/70">
            Wrong unit?{' '}
            <Link href={request.settingsHref} className="font-semibold text-muted-foreground">
              Exercise settings
            </Link>
          </p>
        )}
      </SheetContent>
    </Sheet>
  )
}
