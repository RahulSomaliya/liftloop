'use client'

import { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ExercisePoint } from '@/db/queries/progress'

function tokens() {
  const css = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
  return {
    primary: read('--primary', '#f2b134'),
    success: read('--success', '#5fd38a'),
    muted: read('--muted-foreground', '#a3a3a3'),
    border: read('--border', 'rgba(255,255,255,0.1)'),
    card: read('--card', '#171717'),
    fg: read('--foreground', '#fafafa'),
  }
}

/** Load + e1RM lines and volume bars per session (spec §5.2). Rendered client-only (see exercise page). */
export function ExerciseChart({ points, unit, assist }: { points: ExercisePoint[]; unit: string; assist: boolean }) {
  const [c] = useState(tokens)
  if (points.length < 2) return <p className="text-[13px] text-muted-foreground/70">Two or more sessions are needed for a chart.</p>
  const data = points.map((p) => ({ ...p, day: p.date.slice(5) }))
  const hasE1rm = data.some((d) => d.e1rm !== null)
  return (
    <div className="h-56 w-full" role="img" aria-label={`${assist ? 'Assist' : 'Load'} over ${points.length} sessions`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke={c.border} vertical={false} />
          <XAxis dataKey="day" tick={{ fill: c.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="load" tick={{ fill: c.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
          <YAxis yAxisId="vol" orientation="right" hide />
          <Tooltip
            contentStyle={{ background: c.card, border: `1px solid ${c.border}`, borderRadius: 12, color: c.fg, fontSize: 12 }}
            labelStyle={{ color: c.muted }}
            formatter={(value, name) => [typeof value === 'number' ? value : String(value ?? ''), name === 'bestLoad' ? `${assist ? 'assist' : 'load'} (${unit})` : name === 'e1rm' ? 'e1RM' : 'volume']}
          />
          <Bar yAxisId="vol" dataKey="volume" fill={c.muted} fillOpacity={0.18} radius={[3, 3, 0, 0]} />
          <Line yAxisId="load" type="monotone" dataKey="bestLoad" stroke={c.primary} strokeWidth={2} dot={{ r: 3, fill: c.primary, strokeWidth: 0 }} isAnimationActive={false} />
          {hasE1rm && <Line yAxisId="load" type="monotone" dataKey="e1rm" stroke={c.success} strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex gap-3 pt-1 text-[11px] text-muted-foreground/70">
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-3 rounded" style={{ background: c.primary }} /> {assist ? 'assist' : 'load'} ({unit})
        </span>
        {hasE1rm && (
          <span className="flex items-center gap-1">
            <span className="h-0.5 w-3 rounded border-t border-dashed" style={{ borderColor: c.success }} /> e1RM
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="h-2 w-3 rounded-sm" style={{ background: c.muted, opacity: 0.3 }} /> volume
        </span>
      </div>
    </div>
  )
}
