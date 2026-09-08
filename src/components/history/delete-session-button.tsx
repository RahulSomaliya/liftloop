'use client'

import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { deleteSession, undoDeleteSession } from '@/actions/session'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'

const UNDO_MS = 8000

/**
 * Delete a session from its History page (spec §6.5, v1.2: one visible action for every session
 * type, not buried in Edit mode). Confirm sheet → soft delete → back to History with an undo toast.
 * The server hands the loop pointer back when this was the latest workout (`deleteSession`).
 */
export function DeleteSessionButton({ sessionId, title }: { sessionId: string; title: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()

  function confirm() {
    start(async () => {
      try {
        await deleteSession({ sessionId })
        setOpen(false)
        router.push('/history')
        toast(`${title} deleted`, {
          duration: UNDO_MS,
          action: {
            label: 'Undo',
            onClick: () => {
              void undoDeleteSession({ sessionId })
                .then(() => router.refresh())
                .catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'Could not restore'))
            },
          },
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not delete the session')
      }
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="mt-2 flex h-12 items-center justify-center gap-2 rounded-2xl border border-border text-[15px] font-semibold text-destructive">
        <Trash2 size={18} aria-hidden /> Delete session
      </button>
      <Sheet open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <SheetContent side="bottom" className="gap-3 rounded-t-3xl border-border bg-card px-5 pb-[calc(var(--safe-bottom)+2rem)]">
          <SheetTitle className="text-[17px] font-bold">Delete {title}?</SheetTitle>
          <SheetDescription className="text-[14px] text-muted-foreground">It disappears from History, Progress and the coach export. If it was your latest workout, the loop steps back so the same template is next again. You can undo for a few seconds afterwards.</SheetDescription>
          <Button onClick={confirm} disabled={pending} variant="destructive" className="h-14 rounded-2xl text-[16px] font-bold">
            {pending ? 'Deleting…' : 'Delete'}
          </Button>
          <Button onClick={() => setOpen(false)} disabled={pending} variant="secondary" className="h-13 rounded-2xl text-[15px] font-semibold">
            Keep it
          </Button>
        </SheetContent>
      </Sheet>
    </>
  )
}
