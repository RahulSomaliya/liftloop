'use client'

import { Check } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { upsertBodyMetric, type BodyMetricInput } from '@/actions/body'
import type { BodyMetricRow } from '@/db/queries/body'
import { cn } from '@/lib/utils'

function num(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v.replace(',', '.'))
  return Number.isNaN(n) ? null : n
}

export function BodyEntry({ date, row, avg7 }: { date: string; row: BodyMetricRow | null; avg7: number | null }) {
  const [weight, setWeight] = useState(row?.weightKg === null || row?.weightKg === undefined ? '' : String(row.weightKg))
  const [waist, setWaist] = useState(row?.waistCm === null || row?.waistCm === undefined ? '' : String(row.waistCm))
  const [cardioType, setCardioType] = useState(row?.cardioType ?? '')
  const [cardioMin, setCardioMin] = useState(row?.cardioMin === null || row?.cardioMin === undefined ? '' : String(row.cardioMin))
  const [sleep, setSleep] = useState<boolean | null>(row?.sleepGood ?? null)
  const [protein, setProtein] = useState<boolean | null>(row?.proteinHit ?? null)
  const [pending, start] = useTransition()

  function save(patch: Omit<BodyMetricInput, 'date'>, undo?: () => void) {
    start(async () => {
      try {
        await upsertBodyMetric({ date, ...patch })
      } catch (e) {
        undo?.()
        toast.error(e instanceof Error ? e.message : 'Could not save')
      }
    })
  }

  const field = 'flex h-12 items-center gap-1.5 rounded-xl border border-border bg-secondary px-3.5'
  const input = 'w-full min-w-0 bg-transparent text-[17px] font-semibold tabular-nums outline-none'

  return (
    <section className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between">
        <label className="flex items-baseline gap-1.5">
          <input
            inputMode="decimal"
            enterKeyHint="done"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onBlur={() => save({ weightKg: num(weight) })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="—"
            aria-label="Body weight in kilograms"
            className="w-28 bg-transparent text-[40px] font-bold leading-none tabular-nums tracking-[-0.03em] outline-none"
          />
          <span className="text-[15px] text-muted-foreground/70">kg</span>
        </label>
        <span className="text-[13px] tabular-nums text-muted-foreground">
          7-day avg <span className="font-semibold text-foreground">{avg7 ?? '—'}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className={field}>
          <span className="text-[13px] text-muted-foreground">Waist</span>
          <input inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} onBlur={() => save({ waistCm: num(waist) })} placeholder="—" aria-label="Waist in centimetres" className={cn(input, 'text-right')} />
          <span className="text-[12px] text-muted-foreground/70">cm</span>
        </label>
        <div role="group" aria-label="Sleep" className="grid h-12 grid-cols-2 gap-1 rounded-xl border border-border bg-secondary p-1">
          {[
            { v: true, label: 'Slept well' },
            { v: false, label: 'Bad' },
          ].map(({ v, label }) => (
            <button
              key={label}
              type="button"
              aria-pressed={sleep === v}
              onClick={() => {
                const prev = sleep
                setSleep(v)
                save({ sleepGood: v }, () => setSleep(prev))
              }}
              className={cn('rounded-[9px] text-[13px] font-medium', sleep === v ? 'bg-accent font-semibold text-foreground' : 'text-muted-foreground')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          aria-pressed={protein === true}
          onClick={() => {
            const next = protein === true ? null : true
            const prev = protein
            setProtein(next)
            save({ proteinHit: next }, () => setProtein(prev))
          }}
          className={cn(field, 'justify-between text-left')}
        >
          <span className="text-[13px] text-muted-foreground">Protein ≥140 g</span>
          <span className={cn('flex size-6 items-center justify-center rounded-md border', protein ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>{protein && <Check size={16} strokeWidth={3} />}</span>
        </button>
        <div className={field}>
          <input value={cardioType} onChange={(e) => setCardioType(e.target.value)} onBlur={() => save({ cardioType: cardioType || null })} placeholder="Cardio" aria-label="Cardio type" className={cn(input, 'text-[14px]')} />
          <input inputMode="numeric" value={cardioMin} onChange={(e) => setCardioMin(e.target.value)} onBlur={() => save({ cardioMin: num(cardioMin) === null ? null : Math.round(num(cardioMin) as number) })} placeholder="min" aria-label="Cardio minutes" className={cn(input, 'w-12 text-right')} />
        </div>
      </div>
      {pending && <span className="sr-only">Saving</span>}
    </section>
  )
}
