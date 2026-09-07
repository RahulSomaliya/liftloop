import { ButtonSkeleton, CardSkeleton } from '@/components/page-skeleton'
import { Skeleton } from '@/components/ui/skeleton'

// Home skeleton. Also the fallback for any (app) route without its own loading.tsx.
export default function HomeLoading() {
  return (
    <main aria-busy="true" className="flex flex-col gap-4 px-5 pt-2">
      <span className="sr-only">Loading…</span>
      <header className="flex h-14 items-center justify-between">
        <span className="text-[17px] font-bold tracking-[-0.02em]">
          Lift<span className="text-primary">Loop</span>
        </span>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="size-6 rounded-full" />
        </div>
      </header>

      <section className="flex flex-col gap-3.5 rounded-[18px] border border-border bg-card px-5 pb-5 pt-5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-4 w-4/5" />
        <ButtonSkeleton />
      </section>

      <div className="flex items-center gap-2.5">
        <div className="flex gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="size-3.5 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-3.5 w-24" />
      </div>

      <CardSkeleton lines={2} />
      <CardSkeleton lines={2} />
    </main>
  )
}
