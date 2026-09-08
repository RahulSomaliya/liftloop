import { Skeleton } from '@/components/ui/skeleton'

// Mirrors SessionScreen's sticky header and collapsed exercise cards (the tab bar is hidden here).
export default function SessionLoading() {
  return (
    <div aria-busy="true" className="mt-[calc(var(--safe-top)*-1)] flex flex-col">
      <span className="sr-only">Loading…</span>
      <header className="sticky top-0 z-10 flex h-[calc(3.5rem+var(--safe-top))] items-center justify-between border-b border-border bg-card px-3 pr-4 pt-[var(--safe-top)]">
        <div className="flex items-center gap-2.5">
          <Skeleton className="ml-2.5 size-6 rounded-full" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-16 rounded-full" />
          <Skeleton className="h-4 w-12" />
        </div>
      </header>
      <main className="flex flex-col gap-3 px-3 pt-3">
        <Skeleton className="h-11 w-full rounded-xl" />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5">
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className={i % 2 ? 'h-4 w-1/2' : 'h-4 w-2/5'} />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="size-4 rounded-full" />
          </div>
        ))}
      </main>
    </div>
  )
}
