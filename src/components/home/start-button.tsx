'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { startSession } from '@/actions/session'
import { Button } from '@/components/ui/button'

export function StartButton({ templateId, templateName }: { templateId: string; templateName: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  // One id per button mount: a retry after a timeout re-sends the same id, so Start is idempotent.
  const [clientId] = useState(() => crypto.randomUUID())

  function onStart() {
    start(async () => {
      try {
        const { sessionId } = await startSession({ id: clientId, templateId, advancesLoop: true })
        router.push(`/session/${sessionId}`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not start — check your connection and try again')
      }
    })
  }

  return (
    <Button onClick={onStart} disabled={pending} size="lg" className="h-14 w-full rounded-2xl text-[17px] font-bold">
      {pending ? 'Starting…' : `Start ${templateName}`}
    </Button>
  )
}
