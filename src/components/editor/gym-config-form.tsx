'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateGymConfig } from '@/actions/editor'
import { Button } from '@/components/ui/button'
import type { GymCfg } from '@/lib/domain/types'

const parseList = (s: string): number[] => s.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean).map((x) => Number(x.replace(',', '.')))

export function GymConfigForm({ gym }: { gym: GymCfg }) {
  const router = useRouter()
  const [plates, setPlates] = useState(gym.platesLb.join(', '))
  const [rack, setRack] = useState(gym.dumbbellRackLb.join(', '))
  const [step, setStep] = useState(String(gym.stackStepKg))
  const [pending, start] = useTransition()
  const field = 'h-11 w-full rounded-xl border border-border bg-secondary px-3 text-[14px] tabular-nums outline-none focus:ring-2 focus:ring-ring'
  function save() {
    const p = parseList(plates)
    const r = parseList(rack)
    if (p.some(Number.isNaN) || r.some(Number.isNaN) || Number.isNaN(Number(step))) {
      toast.error('Numbers only, separated by commas')
      return
    }
    start(async () => {
      try {
        await updateGymConfig({ platesLb: p, dumbbellRackLb: r, stackStepKg: Number(step) })
        toast.success('Gym config saved')
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save')
      }
    })
  }
  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
        Plates (lb, per side)
        <input value={plates} onChange={(e) => setPlates(e.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
        Dumbbell rack (lb) — steps of 5 above the last entry
        <input value={rack} onChange={(e) => setRack(e.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-[12px] text-muted-foreground">
        Stack step (kg)
        <input inputMode="decimal" value={step} onChange={(e) => setStep(e.target.value)} className={field} />
      </label>
      <Button type="submit" disabled={pending} className="h-12 rounded-2xl text-[15px] font-bold">
        {pending ? 'Saving…' : 'Save gym config'}
      </Button>
    </form>
  )
}
