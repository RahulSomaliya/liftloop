'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { upsertTodaySleep, upsertTodayWeight } from '@/actions/body'
import { cn } from '@/lib/utils'

export function QuickEntry({ weightKg, sleepGood }: { weightKg: number | null; sleepGood: boolean | null }) {
  const [weight, setWeight] = useState(weightKg === null ? '' : String(weightKg))
  const [sleep, setSleep] = useState<boolean | null>(sleepGood)
  const [pending, start] = useTransition()

  function saveWeight() {
    const v = Number(weight.replace(',', '.'))
    if (!weight || Number.isNaN(v)) return
    if (weightKg !== null && Math.abs(v - weightKg) < 0.05) return
    start(async () => {
      try {
        const r = await upsertTodayWeight({ weightKg: v })
        setWeight(String(r.weightKg))
        toast.success(`Weight saved: ${r.weightKg} kg`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save weight')
      }
    })
  }

  function saveSleep(good: boolean) {
    if (sleep === good) return
    setSleep(good)
    start(async () => {
      try {
        await upsertTodaySleep({ good })
      } catch (e) {
        setSleep(sleepGood)
        toast.error(e instanceof Error ? e.message : 'Could not save sleep')
      }
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4">
      <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground">TODAY</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-muted-foreground">Weight</span>
          <span className="flex h-12 items-center gap-1.5 rounded-xl border border-border bg-secondary px-3.5">
            <input
              inputMode="decimal"
              enterKeyHint="done"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              onBlur={saveWeight}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              placeholder="—"
              aria-label="Body weight in kilograms"
              className="w-full min-w-0 bg-transparent text-[20px] font-semibold tabular-nums outline-none"
              disabled={pending}
            />
            <span className="text-[13px] text-muted-foreground/70">kg</span>
          </span>
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-muted-foreground">Slept well?</span>
          <div role="group" aria-label="Sleep" className="grid h-12 grid-cols-2 gap-1 rounded-xl border border-border bg-secondary p-1">
            {[
              { v: true, label: 'Good' },
              { v: false, label: 'Bad' },
            ].map(({ v, label }) => (
              <button
                key={label}
                type="button"
                aria-pressed={sleep === v}
                onClick={() => saveSleep(v)}
                className={cn('rounded-[9px] text-[14px] font-medium transition-colors', sleep === v ? 'bg-accent font-semibold text-foreground' : 'text-muted-foreground')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
