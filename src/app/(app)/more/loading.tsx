import { CardSkeleton, PageSkeleton } from '@/components/page-skeleton'

// Covers the More sub-pages (export, import, backup, program, settings, about).
export default function MoreLoading() {
  return (
    <PageSkeleton back titleWidth="w-28">
      <CardSkeleton lines={4} label={false} />
      <CardSkeleton lines={3} label={false} />
    </PageSkeleton>
  )
}
