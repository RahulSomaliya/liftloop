'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { updateRestPrefs } from '@/actions/editor'
import type { RestPrefs } from '@/lib/domain/types'
import { cn } from '@/lib/utils'

const PRESETS = [60, 90, 120, 150, 180]
const MIN = 15
const MAX = 600

/** Settings → Rest timer (spec §6.3 v1.2): one duration for every exercise, or the program's, plus the end-of-rest ping. */
export function RestSettingsForm({ rest, programDefault }: { rest: RestPrefs; programDefault: string }) {
  const router = useRouter()
  const [override, setOverride] = useState<number | null>(rest.overrideSeconds)
  const [custom, setCustom] = useState(rest.overrideSeconds !== null && !PRESETS.includes(rest.overrideSeconds) ? String(rest.overrideSeconds) : '')
  const [ping, setPing] = useState(rest.ping)
  const [pending, start] = useTransition()

  function save(next: { overrideSeconds: number | null; ping: boolean }) {
    start(async () => {
      try {
        await updateRestPrefs(next)
        toast.success(next.overrideSeconds === null ? 'Rest: program defaults' : `Rest: ${next.overrideSeconds} s for every exercise`)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not save')
      }
    })
  }
  function pick(seconds: number | null) {
    setOverride(seconds)
    if (seconds === null || PRESETS.includes(seconds)) setCustom('')
    save({ overrideSeconds: seconds, ping })
  }
  function commitCustom() {
    if (custom.trim() === '') return
    const n = Math.round(Number(custom))
    if (Number.isNaN(n) || n < MIN || n > MAX) {
      toast.error(`Rest must be between ${MIN} and ${MAX} seconds`)
      return
    }
    setCustom(String(n))
    pick(n)
  }
  function togglePing() {
    const next = !ping
    setPing(next)
    save({ overrideSeconds: override, ping: next })
  }

  const chip = (on: boolean) => cn('flex h-10 items-center justify-center rounded-[10px] border px-3.5 text-[14px] font-semibold tabular-nums whitespace-nowrap', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-secondary text-foreground')
  const customOn = override !== null && !PRESETS.includes(override)

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4" aria-busy={pending || undefined}>
      <h2 className="text-[13px] font-semibold tracking-wide text-muted-foreground">REST TIMER</h2>
      <div className="flex flex-col gap-2">
        <p className="text-[15px] font-semibold">Rest between sets</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => pick(null)} aria-pressed={override === null} className={chip(override === null)}>
            Program
          </button>
          {PRESETS.map((s) => (
            <button key={s} type="button" onClick={() => pick(s)} aria-pressed={override === s} className={chip(override === s)}>
              {s} s
            </button>
          ))}
          <label className={cn(chip(customOn), 'gap-1 px-2.5')}>
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onBlur={commitCustom}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
              inputMode="numeric"
              placeholder="custom"
              aria-label="Custom rest in seconds"
              className="w-14 bg-transparent text-center outline-none placeholder:font-medium placeholder:text-muted-foreground"
            />
            s
          </label>
        </div>
        <p className="text-[13px] text-muted-foreground/70">Program: {programDefault}. Per-exercise values live under Program → Edit.</p>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-[15px] font-semibold">Ping when rest ends</p>
          <p className="text-[13px] text-muted-foreground/70">Beep and buzz while LiftLoop is open, even on silent.</p>
        </div>
        <button type="button" role="switch" aria-checked={ping} aria-label="Ping when rest ends" onClick={togglePing} className={cn('relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors', ping ? 'bg-primary' : 'bg-secondary')}>
          <span className={cn('absolute top-0.5 size-[27px] rounded-full bg-background shadow-md transition-[left]', ping ? 'left-[22px]' : 'left-0.5')} />
        </button>
      </div>
    </section>
  )
}
