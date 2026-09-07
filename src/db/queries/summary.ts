import { eq } from 'drizzle-orm'
import type { Db, Tx } from '@/db/client'
import { session } from '@/db/schema'
import { formatLoad } from '@/lib/domain/load-format'
import { nextWeekPhaseName } from '@/lib/domain/phase'
import { serializeHeader, serializeSessionLine, type ParsedSegment } from '@/lib/domain/shorthand'
import type { LoggedSet } from '@/lib/domain/types'
import { collapsedLine } from '@/lib/domain/verdict'
import { loadProgram } from './home'
import { getSessionView } from './session'

export interface SessionSummary {
  sessionId: string
  templateName: string | null
  durationMin: number
  setCount: number
  beatCount: number
  prs: string[]
  exercises: { name: string; collapsed: string | null }[]
  shorthand: string
  nextTemplateName: string
}

function toSegments(sets: { setIndex: number; load: number | null; reps: number | null; toFailure: boolean }[]): ParsedSegment[] {
  const segs: ParsedSegment[] = []
  for (const s of [...sets].sort((a, b) => a.setIndex - b.setIndex)) {
    const load = s.load ?? 0
    const last = segs[segs.length - 1]
    const set = { reps: s.reps, toFailure: s.toFailure || s.reps === null }
    if (last && last.load === load) last.sets.push(set)
    else segs.push({ load, sets: [set] })
  }
  return segs
}

/** The post-session summary (spec §6.3); also rendered when a finished session's URL is reopened. */
export async function buildSummary(db: Db | Tx, sessionId: string): Promise<SessionSummary | null> {
  const prog = await loadProgram(db)
  const [s] = await db.select({ date: session.date, durationMin: session.durationMin }).from(session).where(eq(session.id, sessionId)).limit(1)
  if (!s) return null
  const view = await getSessionView(db, sessionId, nextWeekPhaseName(s.date, prog))
  if (!view) return null
  const blocks: string[] = []
  const prs: string[] = []
  let setCount = 0
  let beatCount = 0
  const exercises = view.exercises.map((e) => {
    const live = e.setLogs
    setCount += live.length
    if (e.verdict === 'beat') beatCount += 1
    for (const x of live) if (x.isPr && x.reps !== null) prs.push(`${e.exercise.name} ${formatLoad(e.exercise, x.load)} × ${x.reps}`)
    if (live.length > 0) {
      blocks.push(`${serializeHeader({ name: e.exercise.name, lo: e.lo, hi: e.hi, sets: e.sets, marker: e.exercise.unilateral })}\n${serializeSessionLine(toSegments(live))}`)
    }
    const logged: LoggedSet[] = live.map((x) => ({ setIndex: x.setIndex, load: x.load, reps: x.reps, toFailure: x.toFailure }))
    const collapsed = e.verdict && e.nextNote ? collapsedLine(e.exercise, logged, { verdict: e.verdict, nextNote: e.nextNote }) : null
    return { name: e.exercise.name, collapsed }
  })
  return {
    sessionId,
    templateName: view.templateName,
    durationMin: s.durationMin ?? 0,
    setCount,
    beatCount,
    prs,
    exercises,
    shorthand: blocks.join('\n\n'),
    nextTemplateName: prog.templates[prog.nextIndex]?.name ?? '—',
  }
}
