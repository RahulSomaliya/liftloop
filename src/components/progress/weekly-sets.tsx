import type { WeekSets } from '@/db/queries/progress'
import type { MuscleGroup } from '@/lib/domain/types'
import { formatSets, MUSCLE_LABEL, MUSCLE_ORDER, MUSCLE_TARGETS } from '@/lib/domain/weekly-sets'
import { cn } from '@/lib/utils'

/** This week's hard sets per muscle against the target band (spec §7.7), plus recent weeks. Server component. */
export function WeeklySets({ weeks }: { weeks: WeekSets[] }) {
  const current = weeks[weeks.length - 1]
  if (!current) return null
  const muscles = MUSCLE_ORDER.filter((m) => MUSCLE_TARGETS[m] !== null) as MuscleGroup[]
  const maxScale = Math.max(16, ...muscles.map((m) => Math.max(current.totals[m], MUSCLE_TARGETS[m]?.hi ?? 0)))
  const recent = weeks.slice(-6)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {muscles.map((m) => {
          const t = MUSCLE_TARGETS[m]!
          const v = current.totals[m]
          const state = v >= t.lo && v <= t.hi ? 'ok' : v > t.hi ? 'over' : 'under'
          return (
            <div key={m} className="flex items-center gap-3 text-[13px]">
              <span className="w-24 shrink-0 text-muted-foreground">{MUSCLE_LABEL[m]}</span>
              <div className="relative h-4 flex-1 overflow-hidden rounded bg-secondary" role="img" aria-label={`${MUSCLE_LABEL[m]}: ${formatSets(v)} sets, target ${t.lo}–${t.hi}`}>
                <span className="absolute inset-y-0 rounded bg-primary/15" style={{ left: `${(t.lo / maxScale) * 100}%`, width: `${((t.hi - t.lo) / maxScale) * 100}%` }} />
                <span className={cn('absolute inset-y-1 left-0 rounded', state === 'ok' ? 'bg-success' : state === 'over' ? 'bg-primary' : 'bg-muted-foreground/50')} style={{ width: `${Math.min(100, (v / maxScale) * 100)}%` }} />
              </div>
              <span className="w-14 shrink-0 text-right tabular-nums">
                {formatSets(v)} <span className="text-muted-foreground/60">/ {t.lo}–{t.hi}</span>
              </span>
            </div>
          )
        })}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] tabular-nums">
          <thead>
            <tr className="text-left text-muted-foreground/70">
              <th className="py-1 pr-2 font-medium">Muscle</th>
              {recent.map((w) => (
                <th key={w.week} className="py-1 pr-2 text-right font-medium">
                  {w.label}
                </th>
              ))}
              <th className="py-1 text-right font-medium">Target</th>
            </tr>
          </thead>
          <tbody>
            {muscles.map((m) => (
              <tr key={m} className="border-t border-border">
                <td className="py-1 pr-2 text-muted-foreground">{MUSCLE_LABEL[m]}</td>
                {recent.map((w) => (
                  <td key={w.week} className="py-1 pr-2 text-right">
                    {formatSets(w.totals[m])}
                  </td>
                ))}
                <td className="py-1 text-right text-muted-foreground/70">
                  {MUSCLE_TARGETS[m]!.lo}–{MUSCLE_TARGETS[m]!.hi}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
