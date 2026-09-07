// Maps a queued op to the server action and classifies the outcome for the runner (spec §11.3).
import { applySetOp } from '@/actions/sets'
import type { OpOutcome, QueueOp, Transport } from './types'

async function isSignedIn(): Promise<boolean> {
  try {
    const res = await fetch('/api/me', { cache: 'no-store', credentials: 'same-origin' })
    return res.ok
  } catch {
    return true // network is down, not auth — let the runner back off
  }
}

export const serverActionTransport: Transport = async (op: QueueOp): Promise<OpOutcome> => {
  let outcome
  try {
    outcome = await applySetOp(op)
  } catch (e) {
    // A thrown error here is a transport failure (offline, proxy redirect to sign-in, 5xx HTML).
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, status: 'network', message: 'Offline' }
    if (!(await isSignedIn())) return { ok: false, status: 'auth', message: 'Signed out' }
    return { ok: false, status: 'network', message: e instanceof Error ? e.message : 'Network error' }
  }
  if (outcome.ok) return { ok: true, result: outcome.result }
  if (outcome.code === 'UNAUTHENTICATED') return { ok: false, status: 'auth', message: outcome.message }
  if (outcome.code === 'INTERNAL') return { ok: false, status: 'server', message: outcome.message }
  return { ok: false, status: 'rejected', message: outcome.message }
}
