'use client'

import { useEffect } from 'react'

/** Registers the static-asset service worker in production only (dev would cache stale chunks). */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  }, [])
  return null
}
