import { PageSkeleton, RowsSkeleton } from '@/components/page-skeleton'
import { Skeleton } from '@/components/ui/skeleton'

export default function SessionDetailLoading() {
  return (
    <PageSkeleton back titleWidth="w-20" right>
      <div className="flex flex-wrap gap-2">
        {['w-20', 'w-14', 'w-24'].map((w) => (
          <Skeleton key={w} className={`h-7 rounded-full ${w}`} />
        ))}
      </div>
      <Skeleton className="h-28 w-full rounded-2xl" />
      <RowsSkeleton rows={5} height="h-12" />
    </PageSkeleton>
  )
}
