'use client'

import { useEffect } from 'react'

/**
 * iOS standalone PWA: when the software keyboard closes, WebKit can leave the page scrolled past
 * its end, which shows as a blank black band at the bottom until the next scroll (Rahul saw it
 * repeatedly during the first real workout, 2026-09-08). Snap the scroll position back into range
 * whenever the visual viewport grows back to (near) full height. The session keypad no longer
 * uses the native keyboard at all; this covers the remaining text fields (notes, settings, sign-in).
 */
export function KeyboardGapFix() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    let keyboardOpen = false
    const onResize = () => {
      const open = vv.height < window.innerHeight * 0.8
      if (keyboardOpen && !open) {
        const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
        window.scrollTo({ top: Math.min(window.scrollY, max), left: 0 })
      }
      keyboardOpen = open
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])
  return null
}
