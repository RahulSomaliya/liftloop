'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { beep } from '@/lib/beep'

/**
 * Rest timer driven by an end timestamp (spec §6.3), so backgrounding the tab does not stall it:
 * on every tick we compute remaining = endsAt − now; at 0 we beep once.
 */
export function useRestTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [remaining, setRemaining] = useState(0)
  const fired = useRef(false)

  useEffect(() => {
    if (endsAt === null) return
    const tick = (): void => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0 && !fired.current) {
        fired.current = true
        beep()
      }
    }
    tick()
    const id = setInterval(tick, 250)
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [endsAt])

  const start = useCallback((seconds: number) => {
    fired.current = false
    setEndsAt(Date.now() + seconds * 1000)
  }, [])

  const clear = useCallback(() => {
    setEndsAt(null)
    setRemaining(0)
  }, [])

  return { running: endsAt !== null && remaining > 0, done: endsAt !== null && remaining === 0, remaining, start, clear }
}

export function fmtClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
