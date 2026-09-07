import { CardSkeleton, PageSkeleton } from '@/components/page-skeleton'
import { Skeleton } from '@/components/ui/skeleton'

// Covers /exercise/new, /exercise/[id] and /exercise/[id]/edit.
export default function ExerciseLoading() {
  return (
    <PageSkeleton back titleWidth="w-36" right>
      <Skeleton className="h-48 w-full rounded-2xl" />
      <CardSkeleton lines={5} label={false} />
    </PageSkeleton>
  )
}
