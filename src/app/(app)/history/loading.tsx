import { PageSkeleton, RowsSkeleton } from '@/components/page-skeleton'
import { Skeleton } from '@/components/ui/skeleton'

export default function HistoryLoading() {
  return (
    <PageSkeleton title="History" right gap="gap-0">
      <Skeleton className="mt-4 mb-2 h-3 w-28" />
      <RowsSkeleton rows={8} dot />
    </PageSkeleton>
  )
}
