'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * Rest timer driven by an end timestamp (spec §6.3), so backgrounding the tab does not stall it:
 * on every tick we compute remaining = endsAt − now. Visual only — the pill turns green and pulses,
 * `progress` (0..1, elapsed share) drives the line under the session header. There is deliberately
 * NO sound: any AudioContext / audioSession use in the PWA took over the iPhone's audio session
 * and paused Spotify every time Rahul switched apps (2026-09-10). A ping returns with a native app.
 */
export function useRestTimer() {
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [total, setTotal] = useState(0)
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    if (endsAt === null) return
    const tick = (): void => setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)))
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
    setTotal(seconds)
    setEndsAt(Date.now() + seconds * 1000)
  }, [])

  const clear = useCallback(() => {
    setEndsAt(null)
    setRemaining(0)
  }, [])

  const running = endsAt !== null && remaining > 0
  const done = endsAt !== null && remaining === 0
  const progress = endsAt === null || total === 0 ? 0 : Math.min(1, Math.max(0, 1 - remaining / total))
  return { running, done, remaining, progress, start, clear }
}

export function fmtClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
