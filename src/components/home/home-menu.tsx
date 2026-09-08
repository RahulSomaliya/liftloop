'use client'

import { Ellipsis } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { endEasyWeek, startEasyWeek } from '@/actions/program'
import { logWalk, startSession } from '@/actions/session'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

type Mode = 'menu' | 'template' | 'advance' | 'walk'

interface Props {
  templates: { id: string; name: string }[]
  nextTemplateId: string
  hasLiveSession: boolean
  manualEasy: boolean
}

export function HomeMenu({ templates, nextTemplateId, hasLiveSession, manualEasy }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('menu')
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null)
  const [minutes, setMinutes] = useState('20')
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()

  function close() {
    setOpen(false)
    setMode('menu')
    setPicked(null)
  }

  function startPicked(advancesLoop: boolean) {
    if (!picked) return
    start(async () => {
      try {
        const { sessionId } = await startSession({ id: crypto.randomUUID(), templateId: picked.id, advancesLoop })
        close()
        router.push(`/session/${sessionId}`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not start')
      }
    })
  }

  function saveWalk() {
    const m = Math.round(Number(minutes))
    start(async () => {
      try {
        await logWalk({ minutes: m, note: note || null })
        toast.success(`Walk logged · ${m} min`)
        close()
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not log the walk')
      }
    })
  }

  function toggleEasy() {
    start(async () => {
      try {
        if (manualEasy) {
          await endEasyWeek()
          toast.success('Easy week ended')
        } else {
          const r = await startEasyWeek()
          toast.success(`Easy week until ${r.to}`)
        }
        close()
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not update the easy week')
      }
    })
  }

  const item = 'flex h-14 w-full items-center rounded-xl px-4 text-left text-[15px] font-semibold disabled:opacity-40'

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="More actions" className="flex size-11 items-center justify-center rounded-xl text-muted-foreground">
        <Ellipsis size={22} />
      </button>
      <Sheet open={open} onOpenChange={(o) => !o && close()}>
        <SheetContent side="bottom" className="gap-3 rounded-t-3xl border-border bg-card px-4 pb-[calc(var(--safe-bottom)+2rem)]">
          {mode === 'menu' && (
            <>
              <SheetTitle className="px-2 text-[17px] font-bold">Actions</SheetTitle>
              <SheetDescription className="sr-only">Home actions</SheetDescription>
              <div className="flex flex-col divide-y divide-border rounded-2xl border border-border">
                <button type="button" className={item} disabled={hasLiveSession} onClick={() => setMode('template')}>
                  Start a different template
                </button>
                <button type="button" className={item} onClick={() => setMode('walk')}>
                  Log a walk day
                </button>
                <button type="button" className={item} onClick={toggleEasy} disabled={pending}>
                  {manualEasy ? 'End easy week' : 'Start easy week now'}
                </button>
              </div>
            </>
          )}
          {mode === 'template' && (
            <>
              <SheetTitle className="px-2 text-[17px] font-bold">Which template?</SheetTitle>
              <SheetDescription className="sr-only">Pick a template to start</SheetDescription>
              <div className="grid grid-cols-2 gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setPicked(t)
                      setMode('advance')
                    }}
                    className={cn('h-14 rounded-xl border border-border bg-secondary text-[15px] font-semibold', t.id === nextTemplateId && 'border-primary')}
                  >
                    {t.name}
                    {t.id === nextTemplateId ? ' · next' : ''}
                  </button>
                ))}
              </div>
            </>
          )}
          {mode === 'advance' && picked && (
            <>
              <SheetTitle className="px-2 text-[17px] font-bold">Start {picked.name}</SheetTitle>
              <SheetDescription className="px-2 text-[14px] text-muted-foreground">Advance the loop as if this was the next one?</SheetDescription>
              <Button onClick={() => startPicked(true)} disabled={pending} className="h-14 rounded-2xl text-[16px] font-bold">
                Yes, advance the loop
              </Button>
              <Button onClick={() => startPicked(false)} disabled={pending} variant="secondary" className="h-13 rounded-2xl text-[15px] font-semibold">
                No, keep the loop where it is
              </Button>
            </>
          )}
          {mode === 'walk' && (
            <>
              <SheetTitle className="px-2 text-[17px] font-bold">Log a walk day</SheetTitle>
              <SheetDescription className="px-2 text-[14px] text-muted-foreground">Cardio only — the loop does not advance.</SheetDescription>
              <label className="flex h-14 items-center gap-2 rounded-xl border border-border bg-secondary px-4">
                <input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="Minutes" className="w-full bg-transparent text-[22px] font-bold tabular-nums outline-none" />
                <span className="text-[14px] text-muted-foreground">min</span>
              </label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="h-12 rounded-xl border border-border bg-secondary px-4 text-[15px] outline-none" />
              <Button onClick={saveWalk} disabled={pending || !(Number(minutes) > 0)} className="h-14 rounded-2xl text-[16px] font-bold">
                Save walk
              </Button>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
