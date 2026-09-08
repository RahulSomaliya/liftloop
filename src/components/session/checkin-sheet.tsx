'use client'

import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export interface CheckinValues {
  type: 'normal' | 'short'
  sleepGood: boolean | null
  shoulderPain: number
  elbowPain: number
  note: string
}

interface Props {
  open: boolean
  short: boolean
  templateName: string
  elapsedMin: number
  initialSleep: boolean | null
  pendingSets: number
  busy: boolean
  onClose(): void
  onSave(values: CheckinValues): void
}

function PainStepper({ label, value, onChange }: { label: string; value: number; onChange(v: number): void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{label}</span>
        <span className="text-[12px] text-muted-foreground/70">0 = none · 10 = worst</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label={`${label} less`} onClick={() => onChange(Math.max(0, value - 1))} className="flex size-12 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground">
          <Minus size={20} />
        </button>
        <span className="w-14 text-center text-[22px] font-bold tabular-nums" aria-live="polite">
          {value}
        </span>
        <button type="button" aria-label={`${label} more`} onClick={() => onChange(Math.min(10, value + 1))} className="flex size-12 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground">
          <Plus size={20} />
        </button>
      </div>
    </div>
  )
}

export function CheckinSheet({ open, short, templateName, elapsedMin, initialSleep, pendingSets, busy, onClose, onSave }: Props) {
  const [sleep, setSleep] = useState<boolean | null>(initialSleep)
  const [shoulder, setShoulder] = useState(0)
  const [elbow, setElbow] = useState(0)
  const [note, setNote] = useState('')
  const blocked = pendingSets > 0

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="gap-5 rounded-t-3xl border-border bg-card px-5 pb-[calc(var(--safe-bottom)+2rem)]">
        <div className="flex items-baseline justify-between">
          <SheetTitle className="text-[20px] font-bold tracking-[-0.02em]">Check-in{short ? ' · short session' : ''}</SheetTitle>
          <span className="text-[13px] tabular-nums text-muted-foreground/70">
            {templateName} · {elapsedMin} min
          </span>
        </div>
        <SheetDescription className="sr-only">Sleep, shoulder and elbow check-in before finishing</SheetDescription>
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold">Slept well?</span>
          <div role="group" aria-label="Sleep" className="grid h-12 w-40 grid-cols-2 gap-1 rounded-xl border border-border bg-secondary p-1">
            {[
              { v: true, label: 'Good' },
              { v: false, label: 'Bad' },
            ].map(({ v, label }) => (
              <button key={label} type="button" aria-pressed={sleep === v} onClick={() => setSleep(v)} className={cn('rounded-[9px] text-[14px] font-medium', sleep === v ? 'bg-accent font-semibold text-foreground' : 'text-muted-foreground')}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <PainStepper label="Left shoulder" value={shoulder} onChange={setShoulder} />
        <PainStepper label="Elbow" value={elbow} onChange={setElbow} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="h-12 rounded-xl border border-border bg-secondary px-3.5 text-[15px] outline-none focus:ring-2 focus:ring-ring" />
        <Button
          disabled={blocked || busy}
          onClick={() => onSave({ type: short ? 'short' : 'normal', sleepGood: sleep, shoulderPain: shoulder, elbowPain: elbow, note })}
          className="h-14 rounded-2xl text-[17px] font-bold"
        >
          {blocked ? `saving ${pendingSets} set${pendingSets === 1 ? '' : 's'}…` : busy ? 'Finishing…' : 'Save & finish'}
        </Button>
      </SheetContent>
    </Sheet>
  )
}
