'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'

export function LoginForm() {
  const router = useRouter()
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passcode }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }
      router.replace('/')
      router.refresh()
    } catch {
      setError('Network error — try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label htmlFor="passcode" className="text-[13px] font-semibold tracking-wide text-muted-foreground">
        PASSCODE
      </label>
      <input
        id="passcode"
        type="password"
        autoComplete="current-password"
        autoFocus
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        className="h-14 rounded-2xl border border-border bg-card px-4 text-[22px] tracking-[0.3em] text-foreground outline-none focus:ring-2 focus:ring-ring"
        aria-invalid={error ? true : undefined}
      />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={busy || passcode.length === 0} className="h-14 rounded-2xl text-[17px] font-bold">
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )
}
