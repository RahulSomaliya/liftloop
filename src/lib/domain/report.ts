// Coach report generator (spec §8). Pure: the caller loads every row the range needs (sessions in
// range, body metrics from `from − 6`, export log rows before this export) and passes `today`.
// Output is dense markdown that pastes into a chat; the Sessions section is §3 shorthand and
// re-imports through parseNotes with zero errors.
import { round1, weightAvg7 } from './body'
import { elbowFlag, shoulderFlag } from './flags'
import { formatLoad, fmtNum } from './load-format'
import { getPhase, weekPhase } from './phase'
import { bestSet } from './prs'
import { serializeHeader, serializeSessionLine } from './shorthand'
import type { ParsedSegment } from './shorthand'
import { addDaysIST, daysBetween, istDate, programWeek, weekdayShort } from './time'
import type { ExerciseCfg, LoggedSet, MuscleGroup, ProgramCfg, SessionSource, SessionType, TemplateKind, Verdict } from './types'
import { formatSets, MUSCLE_LABEL, MUSCLE_ORDER, MUSCLE_TARGETS, weeklySets } from './weekly-sets'

export interface ReportSetLog extends LoggedSet {
  isPr: boolean
}

export interface ReportExercise {
  orderIndex: number
  exercise: ExerciseCfg
  swappedFrom: ExerciseCfg | null
  sets: number
  lo: number | null
  hi: number | null
  verdict: Verdict | null
  note: string | null
  setLogs: ReportSetLog[]
}

export interface ReportSession {
  id: string
  date: string
  startedAt: string
  templateName: string | null
  type: SessionType
  source: SessionSource
  durationMin: number | null
  sleepGood: boolean | null
  shoulderPain: number | null
  elbowPain: number | null
  note: string | null
  exercises: ReportExercise[]
}

export interface ReportBodyMetric {
  date: string
  weightKg: number | null
  waistCm: number | null
  sleepGood: boolean | null
  proteinHit: boolean | null
  cardioType: string | null
  cardioMin: number | null
}

export interface ReportInput {
  from: string
  to: string
  today: string
  ownerName: string | null
  program: ProgramCfg & { templates: { name: string; kind: TemplateKind }[] }
  /** Live sessions in range (any type/source), finished ones only for logged. */
  sessions: ReportSession[]
  /** Rows from `from − 6` to `to`. */
  bodyMetrics: ReportBodyMetric[]
  /** All export_log rows created before this export. */
  exportLog: { createdAt: string }[]
}

const EXPORT_FLAG_DAYS = 21
const MIN_SESSIONS_PER_WEEK = 3

const dec1 = (n: number): string => fmtNum(round1(n))
const signed1 = (n: number): string => {
  const r = round1(n)
  return r > 0 ? `+${fmtNum(r)}` : r < 0 ? fmtNum(r) : '0.0'
}

function segmentsOf(sets: LoggedSet[]): ParsedSegment[] {
  const ordered = [...sets].sort((a, b) => a.setIndex - b.setIndex)
  const segs: ParsedSegment[] = []
  for (const s of ordered) {
    const load = s.load ?? 0
    const last = segs[segs.length - 1]
    const set = { reps: s.reps, toFailure: s.toFailure || s.reps === null }
    if (last && last.load === load) last.sets.push(set)
    else segs.push({ load, sets: [set] })
  }
  return segs
}

/** "27 kg × 12/12/11" (mixed loads joined with " + "). */
function setsSummary(ex: ExerciseCfg, sets: LoggedSet[]): string {
  return segmentsOf(sets)
    .map((seg) => `${formatLoad(ex, seg.load)} × ${seg.sets.map((s) => (s.reps === null ? 'f' : String(s.reps))).join('/')}`)
    .join(' + ')
}

export function generateCoachReport(input: ReportInput): string {
  const { from, to, today, program } = input
  const sessions = [...input.sessions].sort((a, b) => (a.date === b.date ? a.startedAt.localeCompare(b.startedAt) : a.date.localeCompare(b.date)))
  const countable = sessions.filter((s) => s.source === 'logged' && s.type !== 'walk')
  const walks = sessions.filter((s) => s.type === 'walk')
  const days = daysBetween(from, to) + 1
  const out: string[] = []

  // ---------- weeks ----------
  const w1 = programWeek(from, program.startDate)
  const w2 = programWeek(to, program.startDate)
  const weeks = Array.from({ length: w2 - w1 + 1 }, (_, i) => {
    const w = w1 + i
    const wp = weekPhase(w, program)
    const partial = wp.weekStart < from || wp.weekEnd > to
    const manual = Array.from({ length: 7 }, (_, d) => getPhase(addDaysIST(wp.weekStart, d), program)).some((p) => p.source === 'manual')
    const inWeek = (date: string): boolean => date >= wp.weekStart && date <= wp.weekEnd
    return { w, wp, partial, manual, label: `W${w}${partial ? '*' : ''}`, inWeek }
  })

  // ---------- Summary ----------
  const segments: string[] = []
  for (const wk of weeks) {
    const name = wk.manual ? `${wk.wp.name} (manual` : wk.wp.name
    const last = segments[segments.length - 1]
    const key = `${name}`
    if (last && last.startsWith(key + ' ')) {
      // extend the previous segment's week range
      const m = /W(\d+)(?:–W(\d+))?\)$/.exec(last)
      const start = m ? m[1] : String(wk.w)
      segments[segments.length - 1] = wk.manual ? `${name}, W${start}–W${wk.w})` : `${name} (W${start}–W${wk.w})`
    } else {
      segments.push(wk.manual ? `${name}, W${wk.w})` : `${name} (W${wk.w})`)
    }
  }
  const targets = weeks.map((wk) => wk.wp.targetDays)
  const targetText = [...new Set(targets)].join('→')
  const y = targets.reduce((a, b) => a + b, 0)
  const perWeek = weeks.map((wk) => `${wk.label}: ${countable.filter((s) => wk.inWeek(s.date)).length}`).join(', ')
  const shortCount = countable.filter((s) => s.type === 'short').length
  out.push(`# LiftLoop report — ${from} → ${to}${input.ownerName ? ` (${input.ownerName})` : ''}`)
  out.push('')
  out.push('## Summary')
  out.push(`- Phase: ${segments.join(' → ')}. Target ${targetText} days/week. Sessions: ${countable.length}/${y} (${perWeek}). Short sessions: ${shortCount}. Walk days: ${walks.length}.`)
  out.push(`- Loop next: ${program.templates[program.nextIndex]?.name ?? '—'}`)
  out.push('- Units: stacks kg, free weights lb, body weight kg')

  const inRange = (d: string): boolean => d >= from && d <= to
  const metricsInRange = input.bodyMetrics.filter((m) => inRange(m.date))
  const goodNights = metricsInRange.filter((m) => m.sleepGood === true).length
  const recorded = new Set(metricsInRange.filter((m) => m.sleepGood !== null).map((m) => m.date)).size
  const unrecorded = days - recorded
  out.push(`- Sleep: good nights ${goodNights}/${days}${unrecorded > 0 ? ` (${unrecorded} unrecorded)` : ''}`)

  const painLine = (label: string, pick: (s: ReportSession) => number | null): string => {
    const vals = countable.map((s) => ({ s, v: pick(s) })).filter((x): x is { s: ReportSession; v: number } => x.v !== null)
    if (vals.length === 0) return `- ${label} (0–10): —`
    const avg = vals.reduce((a, x) => a + x.v, 0) / vals.length
    const max = Math.max(...vals.map((x) => x.v))
    const first = vals.find((x) => x.v === max)!
    const suffix = max > 0 ? ` (${first.s.date}, ${first.s.templateName ?? 'Imported'})` : ''
    return `- ${label} (0–10): avg ${dec1(avg)}, max ${fmtNum(max)}${suffix}`
  }
  out.push(painLine('Shoulder', (s) => s.shoulderPain))
  out.push(painLine('Elbow', (s) => s.elbowPain))

  const weighed = metricsInRange.filter((m) => m.weightKg !== null).sort((a, b) => a.date.localeCompare(b.date))
  if (weighed.length === 0) out.push('- Body weight: —')
  else {
    const a1 = weightAvg7(weighed[0].date, input.bodyMetrics) as number
    const a2 = weightAvg7(weighed[weighed.length - 1].date, input.bodyMetrics) as number
    const waist = [...metricsInRange].filter((m) => m.waistCm !== null).sort((a, b) => b.date.localeCompare(a.date))[0]
    const waistText = waist ? ` Waist: ${round1(waist.waistCm as number).toFixed(1)} cm (${waist.date})` : ''
    out.push(`- Body weight: 7-day avg ${round1(a1).toFixed(1)} → ${round1(a2).toFixed(1)} kg (${signed1(a2 - a1)}).${waistText}`)
  }
  out.push(`- Protein ≥140 g: ${metricsInRange.filter((m) => m.proteinHit === true).length}/${days} days`)

  const verdictCounts: Record<Verdict, number> = { beat: 0, matched: 0, under: 0, done: 0 }
  for (const s of countable) for (const e of s.exercises) if (e.verdict) verdictCounts[e.verdict] += 1
  const verdictParts = (['beat', 'matched', 'under', 'done'] as Verdict[]).filter((v) => verdictCounts[v] > 0).map((v) => `${v === 'done' ? 'easy' : v} ${verdictCounts[v]}`)
  out.push(`- Verdicts: ${verdictParts.length ? verdictParts.join(' · ') : 'none'}`)

  const prs: string[] = []
  for (const s of sessions) for (const e of s.exercises) for (const l of [...e.setLogs].sort((a, b) => a.setIndex - b.setIndex)) if (l.isPr && l.reps !== null) prs.push(`${e.exercise.name} ${formatLoad(e.exercise, l.load)} × ${l.reps} (${s.date})`)
  out.push(`- PRs: ${prs.length ? prs.join(', ') : 'none'}`)

  const flags: string[] = []
  const newestFirst = [...countable].reverse()
  if (shoulderFlag(newestFirst)) flags.push('shoulder > 2 on 3 sessions in a row')
  if (elbowFlag(newestFirst)) flags.push('elbow sore')
  for (const wk of weeks) {
    if (wk.partial || wk.wp.weekEnd >= today) continue
    if (countable.filter((s) => wk.inWeek(s.date)).length < MIN_SESSIONS_PER_WEEK) flags.push(`< ${MIN_SESSIONS_PER_WEEK} sessions in week ${wk.w}`)
  }
  const lastExport = input.exportLog.map((e) => istDate(new Date(e.createdAt))).sort().pop() ?? null
  const sinceExport = lastExport ? daysBetween(lastExport, to) : daysBetween(program.startDate, to)
  if (sinceExport >= EXPORT_FLAG_DAYS) flags.push(`no export for ${EXPORT_FLAG_DAYS}+ days`)
  out.push(`- Flags: ${flags.length ? flags.join(', ') : 'none'}`)

  // ---------- Sessions ----------
  out.push('')
  out.push('## Sessions')
  for (const s of sessions) {
    const head: string[] = [`${s.date} ${weekdayShort(s.date)}`]
    if (s.type === 'walk') head.push('Walk')
    else if (s.source === 'imported') head.push('Imported')
    else head.push(`${s.templateName ?? '—'}${s.type === 'short' ? ' (short)' : ''}`)
    if (s.durationMin !== null) head.push(`${s.durationMin} min`)
    if (s.source === 'logged' && s.type !== 'walk') {
      if (s.sleepGood !== null) head.push(`sleep: ${s.sleepGood ? 'good' : 'bad'}`)
      if (s.shoulderPain !== null) head.push(`shoulder: ${s.shoulderPain}`)
      if (s.elbowPain !== null) head.push(`elbow: ${s.elbowPain}`)
    }
    out.push(`### ${head.join(' — ')}`)
    if (s.type === 'walk') {
      out.push('(cardio only, loop not advanced)')
      if (s.note) out.push(`Note: ${s.note}`)
      out.push('')
      continue
    }
    const blocks: string[] = []
    for (const e of [...s.exercises].sort((a, b) => a.orderIndex - b.orderIndex)) {
      if (e.setLogs.length === 0) continue
      const lines = [serializeHeader({ name: e.exercise.name, lo: e.lo, hi: e.hi, sets: e.sets, marker: e.exercise.unilateral })]
      if (e.swappedFrom) lines.push(`(swapped from ${e.swappedFrom.name})`)
      lines.push(serializeSessionLine(segmentsOf(e.setLogs)))
      blocks.push(lines.join('\n'))
    }
    out.push(blocks.join('\n\n'))
    if (s.note) {
      out.push('')
      out.push(`Note: ${s.note}`)
    }
    out.push('')
  }

  // ---------- Exercise progression ----------
  out.push('## Exercise progression (first → last in range, best, verdicts)')
  out.push('| Exercise | Sessions | First | Last | Best set | Verdicts |')
  out.push('|---|---|---|---|---|---|')
  const byExercise = new Map<string, { ex: ExerciseCfg; rows: { session: ReportSession; e: ReportExercise }[] }>()
  for (const s of countable) {
    for (const e of [...s.exercises].sort((a, b) => a.orderIndex - b.orderIndex)) {
      if (e.setLogs.length === 0) continue
      const entry = byExercise.get(e.exercise.id) ?? { ex: e.exercise, rows: [] }
      entry.rows.push({ session: s, e })
      byExercise.set(e.exercise.id, entry)
    }
  }
  for (const { ex, rows } of byExercise.values()) {
    const first = rows[0]
    const last = rows[rows.length - 1]
    const best = bestSet(rows.flatMap((r) => r.e.setLogs), ex)
    const verdicts = rows.map((r) => (r.e.verdict === null ? '—' : r.e.verdict === 'done' ? 'easy' : r.e.verdict)).join(', ')
    out.push(`| ${ex.name} | ${rows.length} | ${setsSummary(ex, first.e.setLogs)} | ${setsSummary(ex, last.e.setLogs)} | ${best ? `${formatLoad(ex, best.load)} × ${best.reps}` : '—'} | ${verdicts} |`)
  }

  // ---------- Weekly hard sets ----------
  out.push('')
  out.push('## Weekly hard sets per muscle')
  out.push(`| Muscle | ${weeks.map((wk) => wk.label).join(' | ')} | Target |`)
  out.push(`|---|${weeks.map(() => '---').join('|')}|---|`)
  const weekTotals = weeks.map((wk) =>
    weeklySets(countable.filter((s) => wk.inWeek(s.date)).flatMap((s) => s.exercises.map((e) => ({ exercise: e.exercise, setCount: e.setLogs.length })))),
  )
  for (const m of MUSCLE_ORDER as MuscleGroup[]) {
    const t = MUSCLE_TARGETS[m]
    out.push(`| ${MUSCLE_LABEL[m]} | ${weekTotals.map((wt) => formatSets(wt[m])).join(' | ')} | ${t ? `${t.lo}–${t.hi}` : '—'} |`)
  }

  // ---------- Body ----------
  out.push('')
  out.push('## Body')
  out.push('| Date | Weight kg | 7d avg | Waist cm | Sleep | Cardio | Protein |')
  out.push('|---|---|---|---|---|---|---|')
  for (const m of [...metricsInRange].sort((a, b) => a.date.localeCompare(b.date))) {
    const any = m.weightKg !== null || m.waistCm !== null || m.sleepGood !== null || m.proteinHit !== null || m.cardioType !== null || m.cardioMin !== null
    if (!any) continue
    const avg = m.weightKg !== null ? weightAvg7(m.date, input.bodyMetrics) : null
    const cardio = m.cardioType || m.cardioMin !== null ? [m.cardioType, m.cardioMin !== null ? `${m.cardioMin} min` : null].filter(Boolean).join(' · ') : ''
    out.push(`| ${m.date} | ${m.weightKg !== null ? round1(m.weightKg).toFixed(1) : ''} | ${avg !== null ? round1(avg).toFixed(1) : ''} | ${m.waistCm !== null ? round1(m.waistCm).toFixed(1) : ''} | ${m.sleepGood === null ? '' : m.sleepGood ? 'good' : 'bad'} | ${cardio} | ${m.proteinHit === null ? '' : m.proteinHit ? 'yes' : 'no'} |`)
  }

  // ---------- Notes ----------
  out.push('')
  out.push('## Notes')
  const notes: string[] = []
  for (const s of sessions) for (const e of [...s.exercises].sort((a, b) => a.orderIndex - b.orderIndex)) if (e.note) notes.push(`- ${s.date} ${s.templateName ?? 'Imported'} · ${e.exercise.name}: ${e.note}`)
  out.push(notes.length ? notes.join('\n') : '- none')
  out.push('')
  return out.join('\n')
}
