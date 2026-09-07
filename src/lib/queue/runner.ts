// FIFO runner (spec §11.2–11.3): one op in flight, strict order, persisted between attempts.
//  network / server error → exponential backoff (1 s → 30 s), never dropped
//  auth                   → pause (ops kept), caller redirects to sign-in, resume() after
//  rejected (4xx)         → drop that op, tell the user, keep draining
//  stale (applied=false)  → re-submit ONCE at row.rev + 1, then drop
import type { QueueOp, Runner, RunnerHooks, QueueStore, Transport } from './types'

export const MAX_BACKOFF_MS = 30_000
export const BASE_BACKOFF_MS = 1_000
export const TICK_MS = 10_000
export const MAX_SERVER_ATTEMPTS = 12

export function backoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1))
}

export function createRunner(store: QueueStore, transport: Transport, hooks: RunnerHooks = {}, now: () => number = () => Date.now()): Runner {
  let queue: QueueOp[] = store.load()
  let draining = false
  let isPaused = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const persist = (): void => {
    store.save(queue)
    hooks.onChange?.(queue.length)
  }

  const scheduleDrain = (ms: number): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void drain()
    }, ms)
  }

  async function drain(): Promise<void> {
    if (draining || isPaused) return
    draining = true
    try {
      while (queue.length > 0 && !isPaused) {
        const op = queue[0]
        let outcome
        try {
          outcome = await transport(op)
        } catch (e) {
          outcome = { ok: false as const, status: 'network' as const, message: e instanceof Error ? e.message : 'Network error' }
        }
        if (outcome.ok) {
          if (outcome.result.applied) {
            queue = queue.slice(1)
            persist()
            hooks.onApplied?.(op, outcome.result)
            continue
          }
          // Stale: the server holds a newer rev. Re-submit once with the user's latest intent.
          if (!op.resubmitted) {
            queue = [{ ...op, rev: outcome.result.row.rev + 1, resubmitted: true }, ...queue.slice(1)]
            persist()
            continue
          }
          queue = queue.slice(1)
          persist()
          hooks.onDropped?.(op, 'This set could not be saved (a newer edit exists)')
          continue
        }
        if (outcome.status === 'auth') {
          isPaused = true
          hooks.onPausedAuth?.()
          return
        }
        if (outcome.status === 'rejected') {
          queue = queue.slice(1)
          persist()
          hooks.onDropped?.(op, outcome.message)
          continue
        }
        // network / server: keep the op, back off, retry later
        const attempts = op.attempts + 1
        if (outcome.status === 'server' && attempts >= MAX_SERVER_ATTEMPTS) {
          queue = queue.slice(1)
          persist()
          hooks.onDropped?.(op, `${outcome.message} (gave up after ${attempts} attempts)`)
          continue
        }
        queue = [{ ...op, attempts }, ...queue.slice(1)]
        persist()
        scheduleDrain(backoffMs(attempts))
        return
      }
    } finally {
      draining = false
    }
  }

  return {
    enqueue(partial) {
      const op = { ...partial, id: partial.id ?? cryptoId(), createdAt: now(), attempts: 0, resubmitted: false } as QueueOp
      queue = [...queue, op]
      persist()
      void drain()
      return op
    },
    drain,
    pending: () => queue.length,
    pendingFor: (sessionId) => queue.filter((o) => o.sessionId === sessionId).length,
    paused: () => isPaused,
    resume() {
      isPaused = false
      void drain()
    },
    start() {
      const onOnline = (): void => void drain()
      const onVisible = (): void => {
        if (typeof document === 'undefined' || document.visibilityState === 'visible') void drain()
      }
      globalThis.addEventListener?.('online', onOnline)
      globalThis.document?.addEventListener('visibilitychange', onVisible)
      const interval = setInterval(() => {
        if (queue.length > 0) void drain()
      }, TICK_MS)
      void drain()
      return () => {
        globalThis.removeEventListener?.('online', onOnline)
        globalThis.document?.removeEventListener('visibilitychange', onVisible)
        clearInterval(interval)
        if (timer) clearTimeout(timer)
      }
    },
    opsFor: (sessionExerciseId) => queue.filter((o) => o.sessionExerciseId === sessionExerciseId),
  }
}

function cryptoId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}
