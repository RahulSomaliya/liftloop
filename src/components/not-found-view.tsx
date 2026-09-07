import Link from 'next/link'

/** Shared 404 body: the (app) route group renders it inside the tab-bar layout, the root for unknown URLs. */
export function NotFoundView() {
  return (
    <main className="flex flex-col gap-4 px-5 pt-2">
      <header className="flex h-14 items-center">
        <h1 className="text-[20px] font-bold tracking-[-0.02em]">Not found</h1>
      </header>
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-[14px] text-muted-foreground">There is nothing at this address. The session or exercise may have been removed, or the link is wrong.</p>
        <Link href="/" className="flex h-14 items-center justify-center rounded-2xl bg-primary text-[16px] font-bold text-primary-foreground">
          Go to Home
        </Link>
        <Link href="/history" className="flex h-12 items-center justify-center rounded-2xl border border-border bg-secondary text-[15px] font-semibold">
          Open History
        </Link>
      </section>
    </main>
  )
}
