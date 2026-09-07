import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// Building blocks for the per-route `loading.tsx` files. Each one mirrors the real page's chrome
// (same paddings, header height, card radius) so the swap from skeleton to content does not jump.
// Titles that are fixed for the route are rendered as real text; anything data-dependent is a bar.

export function PageSkeleton({ back = false, title, titleWidth = 'w-24', right = false, gap = 'gap-4', children }: { back?: boolean; title?: string; titleWidth?: string; right?: boolean; gap?: string; children: React.ReactNode }) {
  return (
    <main aria-busy="true" className={cn('flex flex-col px-5 pt-2', gap)}>
      <span className="sr-only">Loading…</span>
      <header className="flex h-14 items-center gap-2">
        {back && <Skeleton className="size-6 rounded-full" />}
        {title ? <h1 className={cn('font-bold', back ? 'text-[17px]' : 'text-[20px] tracking-[-0.02em]')}>{title}</h1> : <Skeleton className={cn('h-5', titleWidth)} />}
        {right && <Skeleton className="ml-auto h-4 w-14" />}
      </header>
      {children}
    </main>
  )
}

const LINE_WIDTHS = ['w-3/5', 'w-4/5', 'w-2/5', 'w-3/4', 'w-1/2']

export function CardSkeleton({ lines = 3, label = true, className }: { lines?: number; label?: boolean; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-3 rounded-2xl border border-border bg-card p-4', className)}>
      {label && <Skeleton className="h-3 w-28" />}
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-4', LINE_WIDTHS[i % LINE_WIDTHS.length])} />
      ))}
    </section>
  )
}

/** `lines` 2 = title + meta rows (History list); 1 = single-line grid rows (Body entries). */
export function RowsSkeleton({ rows = 6, height = 'h-14', lines = 2, dot = false, className }: { rows?: number; height?: string; lines?: 1 | 2; dot?: boolean; className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={cn('flex items-center gap-3 border-b border-border px-1', height)}>
          {dot && <Skeleton className="size-2.5 rounded-full" />}
          <Skeleton className="h-3.5 w-12" />
          {lines === 1 ? (
            <>
              <Skeleton className="h-4 w-10" />
              <Skeleton className="h-3.5 w-10" />
              <Skeleton className="h-3.5 w-14" />
            </>
          ) : (
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className={cn('h-4', i % 2 ? 'w-1/2' : 'w-2/5')} />
              <Skeleton className="h-3 w-1/3" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function ButtonSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn('h-14 w-full rounded-2xl', className)} />
}
