// Notes-text import planning (spec §5.3): pure. Turns pasted shorthand (or a pasted coach report)
// into dated blocks the importer can preview and save.
import { addDaysIST } from './time'
import { parseNotes, type ExerciseNameRef, type ParseError, type ParsedSegment } from './shorthand'

export interface PlannedLine {
  date: string
  segments: ParsedSegment[]
  /** Only the last two lines of a block are kept (spec §5.3); older ones are shown greyed out. */
  keep: boolean
  lineNumber: number
}

export interface PlannedBlock {
  rawName: string
  exerciseId: string | null
  lo: number | null
  hi: number | null
  sets: number
  unilateralMarker: 'arm' | 'leg' | null
  /** Template name taken from a report "### date — Template" header, when present. */
  templateName: string | null
  lines: PlannedLine[]
  lineNumber: number
}

export interface ImportPlan {
  blocks: PlannedBlock[]
  errors: ParseError[]
  /** True when the paste was a coach report and only its Sessions section was used. */
  fromReport: boolean
}

const REPORT_HEADER_RE = /^###\s+(\d{4}-\d{2}-\d{2})\b(.*)$/

/** A pasted coach report is reduced to its "## Sessions" section (spec §5.3). */
export function extractSessionsSection(text: string): { text: string; fromReport: boolean } {
  const start = text.indexOf('## Sessions')
  if (start === -1) return { text, fromReport: false }
  const rest = text.slice(start + '## Sessions'.length)
  const next = rest.search(/\n## /)
  return { text: next === -1 ? rest : rest.slice(0, next), fromReport: true }
}

function templateFromHeader(tail: string): string | null {
  // "… — Push A (short) — 41 min — sleep: good" → "Push A"
  const parts = tail.split('—').map((p) => p.trim()).filter(Boolean)
  if (/^[A-Z][a-z]{2}$/.test(parts[0] ?? '')) parts.shift() // weekday
  const name = parts[0]?.replace(/\s*\(short\)\s*$/, '')
  if (!name || name === 'Walk' || name === 'Imported') return null
  return name
}

export function planImport(text: string, exercises: ExerciseNameRef[], assignedDate: string): ImportPlan {
  const { text: body, fromReport } = extractSessionsSection(text)
  const { blocks, errors } = parseNotes(body, exercises)

  // Report headers (comment lines to the parser) give each following block its date + template.
  const headers: { lineNumber: number; date: string; templateName: string | null }[] = []
  body.split(/\r?\n/).forEach((raw, i) => {
    const m = REPORT_HEADER_RE.exec(raw.trim())
    if (m) headers.push({ lineNumber: i + 1, date: m[1], templateName: templateFromHeader(m[2]) })
  })

  const planned: PlannedBlock[] = blocks.map((b) => {
    const header = [...headers].reverse().find((h) => h.lineNumber < b.lineNumber) ?? null
    const n = b.sessions.length
    const lines: PlannedLine[] = b.sessions.map((s, i) => {
      const fromEnd = n - 1 - i // 0 = most recent
      const keep = header ? true : fromEnd < 2
      const date = header ? header.date : addDaysIST(assignedDate, -7 * fromEnd)
      return { date, segments: s.segments, keep, lineNumber: s.lineNumber }
    })
    return {
      rawName: b.rawName,
      exerciseId: b.exerciseId,
      lo: b.lo,
      hi: b.hi,
      sets: b.sets,
      unilateralMarker: b.unilateralMarker,
      templateName: header?.templateName ?? null,
      lines,
      lineNumber: b.lineNumber,
    }
  })
  return { blocks: planned, errors, fromReport }
}

export interface ImportEntry {
  exerciseId: string
  lo: number | null
  hi: number | null
  sets: number
  segments: ParsedSegment[]
}

export interface ImportGroup {
  date: string
  templateName: string | null
  entries: ImportEntry[]
}

/** Groups kept, resolved lines into one import group per date (one imported session each). */
export function groupByDate(blocks: PlannedBlock[]): ImportGroup[] {
  const groups = new Map<string, ImportGroup>()
  for (const b of blocks) {
    if (!b.exerciseId) continue
    for (const l of b.lines) {
      if (!l.keep) continue
      const g = groups.get(l.date) ?? { date: l.date, templateName: b.templateName, entries: [] }
      if (!g.templateName && b.templateName) g.templateName = b.templateName
      g.entries.push({ exerciseId: b.exerciseId, lo: b.lo, hi: b.hi, sets: b.sets, segments: l.segments })
      groups.set(l.date, g)
    }
  }
  return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date))
}
