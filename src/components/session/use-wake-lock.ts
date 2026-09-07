'use client'

import { useEffect } from 'react'

/** Keeps the screen on during a session (spec §5.1.8); re-requests when the tab becomes visible. */
export function useWakeLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const request = async (): Promise<void> => {
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        lock = null // denied (low battery) or unsupported — nothing to do
      }
    }
    const onVisible = (): void => {
      if (document.visibilityState === 'visible' && !cancelled) void request()
    }
    void request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      void lock?.release().catch(() => undefined)
    }
  }, [enabled])
}
