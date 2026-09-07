import { PageSkeleton, RowsSkeleton } from '@/components/page-skeleton'
import { Skeleton } from '@/components/ui/skeleton'

export default function ProgressLoading() {
  return (
    <PageSkeleton back title="Progress">
      <Skeleton className="h-44 w-full rounded-2xl" />
      <Skeleton className="h-52 w-full rounded-2xl" />
      <RowsSkeleton rows={6} height="h-12" />
    </PageSkeleton>
  )
}
