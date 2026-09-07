import type { QueueOp, QueueStore } from './types'

export const QUEUE_KEY = 'liftloop.queue.v1'

/** localStorage-backed store. Every access is wrapped: storage can be blocked or full. */
export function localStorageStore(key = QUEUE_KEY): QueueStore {
  return {
    load() {
      try {
        const raw = globalThis.localStorage?.getItem(key)
        if (!raw) return []
        const parsed: unknown = JSON.parse(raw)
        return Array.isArray(parsed) ? (parsed as QueueOp[]) : []
      } catch {
        return []
      }
    },
    save(ops) {
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(ops))
      } catch {
        // Storage full or blocked: the in-memory queue still drains; nothing else to do.
      }
    },
  }
}

export function memoryStore(initial: QueueOp[] = []): QueueStore {
  let ops = [...initial]
  return {
    load: () => [...ops],
    save: (next) => {
      ops = [...next]
    },
  }
}
