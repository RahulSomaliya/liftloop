'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

// Route error boundary for every app screen (Next renders this instead of the page when a server
// component or action throws during render). The (app) layout — tab bar, queue runner — stays
// mounted, so queued set writes keep draining while this is shown.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[liftloop] screen failed to render', error)
  }, [error])

  return (
    <main className="flex flex-col gap-4 px-5 pt-2">
      <header className="flex h-14 items-center">
        <h1 className="text-[20px] font-bold tracking-[-0.02em]">Something went wrong</h1>
      </header>
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-[14px] text-muted-foreground">This screen could not load. Sets you logged while offline stay queued on this phone and will save once a screen loads.</p>
        {error.digest && <p className="text-[12px] tabular-nums text-muted-foreground/70">Error id {error.digest}</p>}
        <Button onClick={reset} className="h-14 rounded-2xl text-[16px] font-bold">
          Try again
        </Button>
        <Link href="/" className="flex h-12 items-center justify-center rounded-2xl border border-border bg-secondary text-[15px] font-semibold">
          Go to Home
        </Link>
      </section>
    </main>
  )
}
