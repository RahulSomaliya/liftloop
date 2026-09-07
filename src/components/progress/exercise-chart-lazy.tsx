'use client'

import dynamic from 'next/dynamic'

// Client-only: the chart reads theme tokens from the DOM and Recharts measures its container.
export const ExerciseChartLazy = dynamic(() => import('./exercise-chart').then((m) => m.ExerciseChart), {
  ssr: false,
  loading: () => <div className="h-56 w-full animate-pulse rounded-xl bg-secondary/60" aria-hidden />,
})
