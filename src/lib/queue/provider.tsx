'use client'

import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { SetWriteResult } from '@/actions/sets'
import { createRunner } from './runner'
import { localStorageStore } from './store'
import { serverActionTransport } from './transport'
import type { QueueOp, Runner } from './types'

type AppliedListener = (op: QueueOp, result: SetWriteResult) => void

interface QueueContextValue {
  runner: Runner
  pending: number
  subscribe(listener: AppliedListener): () => void
}

const QueueContext = createContext<QueueContextValue | null>(null)

/** Mounts the one FIFO runner for the whole authed app (spec §11.2); every screen shares it. */
export function QueueProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [listeners] = useState(() => new Set<AppliedListener>())
  const [pending, setPending] = useState(0)
  const runner = useMemo(
    () =>
      createRunner(localStorageStore(), serverActionTransport, {
        onApplied: (op, result) => listeners.forEach((l) => l(op, result)),
        onChange: setPending,
        onPausedAuth: () => {
          toast.error('Signed out — sign in to keep saving your sets')
          router.push('/login')
        },
        onDropped: (op, message) => {
          const what = op.kind === 'logSet' ? `Set ${op.setIndex + 1}: ${op.load ?? '—'} ${op.unit} × ${op.reps ?? 'f'}` : `Set ${op.setIndex + 1} ${op.kind === 'deleteSet' ? 'delete' : 'restore'}`
          toast.error(`1 set could not be saved — ${message}`, { description: what, duration: Infinity, closeButton: true })
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runner is created once per mount
    [],
  )

  useEffect(() => runner.start(), [runner])

  // Coming back from /login: resume a paused queue.
  useEffect(() => {
    if (runner.paused()) runner.resume()
  }, [runner])

  const value = useMemo<QueueContextValue>(
    () => ({
      runner,
      pending,
      subscribe(listener) {
        listeners.add(listener)
        return () => listeners.delete(listener)
      },
    }),
    [runner, pending, listeners],
  )

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>
}

export function useQueue(): QueueContextValue {
  const ctx = useContext(QueueContext)
  if (!ctx) throw new Error('useQueue must be used inside QueueProvider')
  return ctx
}
