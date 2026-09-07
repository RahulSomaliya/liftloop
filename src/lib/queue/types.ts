// Client write queue types (spec §11.2–11.3). Only SET writes are queued; everything else is a
// direct server action gated on the queue being empty for that session.
import type { SetWriteResult } from '@/actions/sets'
import type { Unit } from '@/lib/domain/types'

interface OpBase {
  id: string
  sessionId: string
  sessionExerciseId: string
  setIndex: number
  /** (row rev as last loaded, or 0) + 1 */
  rev: number
  createdAt: number
  attempts: number
  /** Set after one automatic re-submit at row.rev + 1 (§11.2); a second refusal drops the op. */
  resubmitted: boolean
}

export interface LogSetOp extends OpBase {
  kind: 'logSet'
  load: number | null
  reps: number | null
  toFailure: boolean
  unit: Unit
}

export interface DeleteSetOp extends OpBase {
  kind: 'deleteSet'
}

export interface RestoreSetOp extends OpBase {
  kind: 'restoreSet'
}

export type QueueOp = LogSetOp | DeleteSetOp | RestoreSetOp

/** Omit that distributes over a union (plain Omit collapses QueueOp to its common keys). */
export type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never
export type NewOp = DistributiveOmit<QueueOp, 'attempts' | 'resubmitted' | 'createdAt' | 'id'> & { id?: string }

export type OpOutcome =
  | { ok: true; result: SetWriteResult }
  | { ok: false; status: 'network' | 'server' | 'auth' | 'rejected'; message: string }

export type Transport = (op: QueueOp) => Promise<OpOutcome>

export interface QueueStore {
  load(): QueueOp[]
  save(ops: QueueOp[]): void
}

export interface RunnerHooks {
  onApplied?(op: QueueOp, result: SetWriteResult): void
  onPausedAuth?(): void
  onDropped?(op: QueueOp, message: string): void
  onChange?(pending: number): void
}

export interface Runner {
  enqueue(op: NewOp): QueueOp
  drain(): Promise<void>
  pending(): number
  pendingFor(sessionId: string): number
  paused(): boolean
  resume(): void
  start(): () => void
  /** Optimistic view: the queued ops for a slot, oldest first. */
  opsFor(sessionExerciseId: string): QueueOp[]
}
