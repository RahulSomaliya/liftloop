/** 30-day weight line (solid) with the 7-day average (dashed). Server component, inline SVG. */
export function WeightSparkline({ series, width = 318, height = 64 }: { series: { date: string; weightKg: number; avg7: number }[]; width?: number; height?: number }) {
  if (series.length < 2) {
    return <p className="text-[13px] text-muted-foreground/70">Log a few days of weight to see the trend.</p>
  }
  const values = series.flatMap((p) => [p.weightKg, p.avg7])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(0.5, max - min)
  const x = (i: number) => (i / (series.length - 1)) * (width - 4) + 2
  const y = (v: number) => height - 4 - ((v - min) / span) * (height - 8)
  const line = (key: 'weightKg' | 'avg7') => series.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ')
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Weight trend from ${series[0].date} to ${series[series.length - 1].date}`} className="block">
      <polyline points={line('avg7')} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4" className="text-muted-foreground/60" />
      <polyline points={line('weightKg')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="text-primary" />
    </svg>
  )
}
