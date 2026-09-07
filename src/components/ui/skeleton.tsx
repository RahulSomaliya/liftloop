import { cn } from '@/lib/utils'

/** Placeholder block for route loading states. `bg-accent` reads on both `bg-background` and `bg-card`. */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-accent motion-reduce:animate-none', className)} {...props} />
}
