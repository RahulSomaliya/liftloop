'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { discardSession, undoDiscard } from '@/actions/session'

export function DiscardButton({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  function onDiscard() {
    start(async () => {
      try {
        await discardSession({ sessionId })
        router.refresh()
        toast('Session discarded', {
          duration: 6000,
          action: {
            label: 'Undo',
            onClick: () => {
              void undoDiscard({ sessionId })
                .then(() => router.refresh())
                .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not restore'))
            },
          },
        })
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not discard')
      }
    })
  }
  return (
    <button type="button" onClick={onDiscard} disabled={pending} className="h-11 text-center text-[14px] font-medium text-muted-foreground/70">
      Discard
    </button>
  )
}
