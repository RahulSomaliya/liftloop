import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SetWriteResult } from '@/actions/sets'
import { backoffMs, createRunner } from '../runner'
import { memoryStore } from '../store'
import type { NewOp, OpOutcome, QueueOp } from '../types'

const applied = (rev: number): SetWriteResult => ({ applied: true, row: { setIndex: 0, rev, load: 27, reps: 12, toFailure: false, isPr: false, deleted: false }, exerciseDone: null })
const stale = (rev: number): SetWriteResult => ({ applied: false, row: { setIndex: 0, rev, load: 27, reps: 12, toFailure: false, isPr: false, deleted: false }, exerciseDone: null })

const op = (i: number, rev = 1): NewOp => ({
  kind: 'logSet', sessionId: 's1', sessionExerciseId: 'se1', setIndex: i, rev, load: 27, reps: 12, toFailure: false, unit: 'kg',
})

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i += 1) await Promise.resolve()
}

describe('queue runner (§11.2–11.3)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('drains FIFO with one op in flight', async () => {
    const seen: number[] = []
    let release: (() => void) | null = null
    const transport = vi.fn(async (o: QueueOp): Promise<OpOutcome> => {
      seen.push(o.setIndex)
      if (o.setIndex === 0) await new Promise<void>((r) => (release = r))
      return { ok: true, result: applied(o.rev) }
    })
    const r = createRunner(memoryStore(), transport)
    r.enqueue(op(0))
    r.enqueue(op(1))
    r.enqueue(op(2))
    await flush()
    expect(seen).toEqual([0])
    expect(r.pending()).toBe(3)
    release!()
    await flush()
    expect(seen).toEqual([0, 1, 2])
    expect(r.pending()).toBe(0)
  })

  it('retries network/server errors with backoff and never drops them', async () => {
    let fail = 2
    const transport = vi.fn(async (o: QueueOp): Promise<OpOutcome> => {
      if (fail > 0) {
        fail -= 1
        return { ok: false, status: 'server', message: '500' }
      }
      return { ok: true, result: applied(o.rev) }
    })
    const r = createRunner(memoryStore(), transport)
    r.enqueue(op(0))
    await flush()
    expect(r.pending()).toBe(1)
    await vi.advanceTimersByTimeAsync(backoffMs(1))
    await flush()
    expect(r.pending()).toBe(1)
    await vi.advanceTimersByTimeAsync(backoffMs(2))
    await flush()
    expect(r.pending()).toBe(0)
    expect(transport).toHaveBeenCalledTimes(3)
    expect(backoffMs(1)).toBe(1000)
    expect(backoffMs(6)).toBe(30000)
  })

  it('pauses on auth, keeps ops, resumes', async () => {
    let authed = false
    const paused = vi.fn()
    const transport = vi.fn(async (o: QueueOp): Promise<OpOutcome> => (authed ? { ok: true, result: applied(o.rev) } : { ok: false, status: 'auth', message: '401' }))
    const r = createRunner(memoryStore(), transport, { onPausedAuth: paused })
    r.enqueue(op(0))
    r.enqueue(op(1))
    await flush()
    expect(paused).toHaveBeenCalledTimes(1)
    expect(r.paused()).toBe(true)
    expect(r.pending()).toBe(2)
    authed = true
    r.resume()
    await flush()
    expect(r.pending()).toBe(0)
  })

  it('drops a rejected op with a message and continues', async () => {
    const dropped = vi.fn()
    const transport = vi.fn(async (o: QueueOp): Promise<OpOutcome> => (o.setIndex === 0 ? { ok: false, status: 'rejected', message: 'Invalid set' } : { ok: true, result: applied(o.rev) }))
    const r = createRunner(memoryStore(), transport, { onDropped: dropped })
    r.enqueue(op(0))
    r.enqueue(op(1))
    await flush()
    expect(dropped).toHaveBeenCalledWith(expect.objectContaining({ setIndex: 0 }), 'Invalid set')
    expect(r.pending()).toBe(0)
  })

  it('re-submits a stale write once at row.rev + 1, then drops', async () => {
    const revs: number[] = []
    const transport = vi.fn(async (o: QueueOp): Promise<OpOutcome> => {
      revs.push(o.rev)
      return { ok: true, result: o.rev >= 4 ? applied(o.rev) : stale(3) }
    })
    const appliedHook = vi.fn()
    const r = createRunner(memoryStore(), transport, { onApplied: appliedHook })
    r.enqueue(op(0, 1))
    await flush()
    expect(revs).toEqual([1, 4])
    expect(appliedHook).toHaveBeenCalledTimes(1)

    const dropped = vi.fn()
    const alwaysStale = createRunner(memoryStore(), async () => ({ ok: true, result: stale(9) }), { onDropped: dropped })
    alwaysStale.enqueue(op(1, 1))
    await flush()
    expect(dropped).toHaveBeenCalledTimes(1)
    expect(alwaysStale.pending()).toBe(0)
  })

  it('persists between runners', async () => {
    const store = memoryStore()
    const never = () => new Promise<OpOutcome>(() => undefined)
    const r1 = createRunner(store, never)
    r1.enqueue(op(0))
    await flush()
    const r2 = createRunner(store, async (o) => ({ ok: true, result: applied(o.rev) }))
    expect(r2.pending()).toBe(1)
    await r2.drain()
    expect(r2.pending()).toBe(0)
    expect(store.load()).toEqual([])
  })
})
