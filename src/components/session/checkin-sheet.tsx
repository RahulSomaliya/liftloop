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
  setCount: number
  initialSleep: boolean | null
  pendingSets: number
  busy: boolean
  onClose(): void
  onSave(values: CheckinValues): void
}

function PainRow({ label, value, onChange }: { label: string; value: number; onChange(v: number): void }) {
  const btn = 'flex h-11 w-12 items-center justify-center rounded-xl border border-border bg-secondary text-muted-foreground'
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{label}</span>
        <span className="text-[12px] text-muted-foreground/70">0 fine · 10 worst</span>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" aria-label={`${label} less`} onClick={() => onChange(Math.max(0, value - 1))} className={btn}>
          <Minus size={20} />
        </button>
        <span className="w-12 text-center text-[22px] font-bold tabular-nums" aria-live="polite">
          {value}
        </span>
        <button type="button" aria-label={`${label} more`} onClick={() => onChange(Math.min(10, value + 1))} className={btn}>
          <Plus size={20} />
        </button>
      </div>
    </div>
  )
}

/** End-of-session check-in (spec §6.3): sleep, shoulder, elbow, note — one primary action, "I'm done". */
export function CheckinSheet({ open, short, templateName, elapsedMin, setCount, initialSleep, pendingSets, busy, onClose, onSave }: Props) {
  const [sleep, setSleep] = useState<boolean | null>(initialSleep)
  const [shoulder, setShoulder] = useState(0)
  const [elbow, setElbow] = useState(0)
  const [note, setNote] = useState('')
  const blocked = pendingSets > 0

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="gap-4 rounded-t-3xl border-border bg-card px-5 pb-[calc(var(--safe-bottom)+2rem)]">
        <div className="flex flex-col gap-0.5">
          <SheetTitle className="text-[22px] font-bold tracking-[-0.02em]">{short ? 'Short and sweet.' : 'Nice work.'}</SheetTitle>
          <SheetDescription className="text-[13px] tabular-nums text-muted-foreground/70">
            {templateName} · {elapsedMin} min · {setCount} set{setCount === 1 ? '' : 's'}
          </SheetDescription>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[15px] font-semibold">Sleep last night</span>
          <div role="group" aria-label="Sleep" className="grid h-12 grid-cols-2 gap-1 rounded-[14px] border border-border bg-secondary p-1">
            {[
              { v: true, label: 'Good' },
              { v: false, label: 'Bad' },
            ].map(({ v, label }) => (
              <button key={label} type="button" aria-pressed={sleep === v} onClick={() => setSleep(v)} className={cn('rounded-[10px] text-[15px] font-medium', sleep === v ? 'bg-accent font-bold text-foreground' : 'text-muted-foreground')}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <PainRow label="Left shoulder" value={shoulder} onChange={setShoulder} />
        <PainRow label="Elbow" value={elbow} onChange={setElbow} />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to remember next time?" className="h-12 rounded-[14px] border border-border bg-secondary px-3.5 text-[15px] outline-none focus:ring-2 focus:ring-ring" />
        <Button
          disabled={blocked || busy}
          onClick={() => onSave({ type: short ? 'short' : 'normal', sleepGood: sleep, shoulderPain: shoulder, elbowPain: elbow, note })}
          className="h-14 rounded-2xl text-[17px] font-bold"
        >
          {blocked ? `saving ${pendingSets} set${pendingSets === 1 ? '' : 's'}…` : busy ? 'Saving…' : "I'm done"}
        </Button>
      </SheetContent>
    </Sheet>
  )
}
