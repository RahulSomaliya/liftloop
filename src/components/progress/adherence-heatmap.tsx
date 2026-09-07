import type { AdherenceDay } from '@/db/queries/progress'
import { cn } from '@/lib/utils'

const KIND_BG: Record<NonNullable<AdherenceDay['kind']>, string> = {
  push: 'bg-kind-push',
  pull: 'bg-kind-pull',
  legs: 'bg-kind-legs',
  walk: 'bg-kind-walk',
  imported: 'bg-kind-walk',
}

/** 12-week adherence grid (spec §5.2): one column per week, Mon→Sun top to bottom. Server component. */
export function AdherenceHeatmap({ days, weekTargets, today }: { days: AdherenceDay[]; weekTargets: { weekStart: string; target: number; done: number }[]; today: string }) {
  const weeks = weekTargets.map((w, i) => days.slice(i * 7, i * 7 + 7))
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 overflow-x-auto" role="img" aria-label={`Sessions per day for the last ${weeks.length} weeks`}>
        <div className="flex flex-col gap-1 pr-1 text-[10px] leading-none text-muted-foreground/60">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i} className="flex h-4 items-center">
              {d}
            </span>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={weekTargets[wi].weekStart} className="flex flex-col gap-1">
            {week.map((d) => (
              <span
                key={d.date}
                title={`${d.date}${d.kind ? ` · ${d.kind}` : ''}`}
                className={cn('size-4 rounded-[4px]', d.kind ? KIND_BG[d.kind] : 'bg-secondary', d.kind && !d.finished && 'opacity-40', d.date === today && 'ring-2 ring-primary ring-offset-1 ring-offset-background', d.date > today && 'opacity-30')}
              />
            ))}
            <span className={cn('mt-0.5 text-center text-[10px] tabular-nums', weekTargets[wi].target > 0 && weekTargets[wi].done >= weekTargets[wi].target ? 'text-success' : 'text-muted-foreground/60')}>
              {weekTargets[wi].target ? `${weekTargets[wi].done}/${weekTargets[wi].target}` : '·'}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground/70">
        {(['push', 'pull', 'legs', 'walk'] as const).map((k) => (
          <span key={k} className="flex items-center gap-1">
            <span className={cn('size-2.5 rounded-[3px]', KIND_BG[k])} /> {k}
          </span>
        ))}
      </div>
    </div>
  )
}
