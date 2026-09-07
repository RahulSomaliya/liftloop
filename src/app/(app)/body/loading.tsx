import { CardSkeleton, PageSkeleton, RowsSkeleton } from '@/components/page-skeleton'
import { Skeleton } from '@/components/ui/skeleton'

export default function BodyLoading() {
  return (
    <PageSkeleton title="Body" right>
      <CardSkeleton lines={4} />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <RowsSkeleton rows={7} height="h-10" lines={1} />
    </PageSkeleton>
  )
}
