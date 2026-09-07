// Shorthand parser / serializer (spec §3, §7.1). This is the notes-import format, the coach-export
// format and the "type it instead" fallback, so round-trip exactness is a hard requirement:
// serializeBlocks(parseNotes(text).blocks) === normalize(text) for every canonical input.
import type { ExerciseCfg } from './types'

export interface ParsedSet {
  reps: number | null
  toFailure: boolean
}
export interface ParsedSegment {
  load: number
  sets: ParsedSet[]
}
export interface ParsedSession {
  segments: ParsedSegment[]
  lineNumber: number
}
export interface ParsedExerciseBlock {
  /** Header name as written, whitespace-collapsed. */
  rawName: string
  /** Resolved by name/alias; null when unresolved. */
  exerciseId: string | null
  headerKind: 'range' | 'failure'
  lo: number | null
  hi: number | null
  sets: number
  /** Exactly what the header carried. */
  unilateralMarker: 'arm' | 'leg' | null
  /** Chronological, last = most recent. */
  sessions: ParsedSession[]
  lineNumber: number
}
export interface ParseError {
  lineNumber: number
  message: string
}

export type ExerciseNameRef = Pick<ExerciseCfg, 'id' | 'name' | 'aliases'>

// Right-anchored so exercise names may contain digits and hyphens ("Low-Incline DB Press (15-30°)").
export const HEADER_RE = /^(.+?)\s+(\d+(?:-\d+)?|failure)(?:\/(arm|leg))?\s+x\s+(\d+)$/i
const LOAD_RE = /^-?\d+(?:,\d+)?$/
const REPS_RE = /^\d+$/

export function collapseWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/** Whitespace-only normalisation (spec §3.2): trims lines, collapses runs, single blank lines. */
export function normalize(text: string): string {
  const lines = text.split(/\r?\n/).map(collapseWs)
  const out: string[] = []
  for (const l of lines) {
    if (l === '' && (out.length === 0 || out[out.length - 1] === '')) continue
    out.push(l)
  }
  while (out.length && out[out.length - 1] === '') out.pop()
  return out.join('\n')
}

export function isCommentLine(line: string): boolean {
  const t = line.trimStart()
  return t.startsWith('#') || t.startsWith('(') || t.startsWith('Note:')
}

const keyOf = (s: string): string => collapseWs(s).toLowerCase()

export function resolveExerciseName(name: string, exercises: ExerciseNameRef[]): string | null {
  const k = keyOf(name)
  const exact = exercises.find((e) => keyOf(e.name) === k)
  if (exact) return exact.id
  const alias = exercises.find((e) => e.aliases.some((a) => keyOf(a) === k))
  return alias ? alias.id : null
}

function parseLoadToken(tok: string): number | null {
  if (tok === '' || tok.toLowerCase() === 'bw') return 0
  if (!LOAD_RE.test(tok)) return null
  return Number(tok.replace(',', '.'))
}

/** One session line: "25.12.12 27.10" → two segments. */
export function parseExerciseLine(line: string): { segments: ParsedSegment[]; errors: ParseError[] } {
  const errors: ParseError[] = []
  const segments: ParsedSegment[] = []
  const chunks = collapseWs(line).split(' ')
  for (const chunk of chunks) {
    if (chunk === '') continue
    const toks = chunk.split('.')
    const load = parseLoadToken(toks[0])
    if (load === null) {
      errors.push({ lineNumber: 0, message: `Bad load "${toks[0]}" in "${chunk}"` })
      continue
    }
    if (toks.length < 2) {
      errors.push({ lineNumber: 0, message: `No sets in "${chunk}"` })
      continue
    }
    const sets: ParsedSet[] = []
    let bad = false
    for (const t of toks.slice(1)) {
      if (t.toLowerCase() === 'f') sets.push({ reps: null, toFailure: true })
      else if (REPS_RE.test(t)) sets.push({ reps: Number(t), toFailure: false })
      else {
        errors.push({ lineNumber: 0, message: `Bad reps "${t}" in "${chunk}"` })
        bad = true
        break
      }
    }
    if (!bad) segments.push({ load, sets })
  }
  return { segments, errors }
}

export function parseNotes(
  text: string,
  exercises: ExerciseNameRef[],
): { blocks: ParsedExerciseBlock[]; errors: ParseError[] } {
  const blocks: ParsedExerciseBlock[] = []
  const errors: ParseError[] = []
  let current: ParsedExerciseBlock | null = null
  const lines = text.split(/\r?\n/)
  lines.forEach((raw, i) => {
    const lineNumber = i + 1
    const line = collapseWs(raw)
    if (line === '' || isCommentLine(line)) return
    const h = HEADER_RE.exec(line)
    if (h) {
      const rawName = collapseWs(h[1])
      const spec = h[2].toLowerCase()
      let lo: number | null = null
      let hi: number | null = null
      let headerKind: ParsedExerciseBlock['headerKind'] = 'failure'
      if (spec !== 'failure') {
        headerKind = 'range'
        const [a, b] = spec.split('-')
        lo = Number(a)
        hi = b === undefined ? lo : Number(b)
      }
      current = {
        rawName,
        exerciseId: resolveExerciseName(rawName, exercises),
        headerKind,
        lo,
        hi,
        sets: Number(h[4]),
        unilateralMarker: h[3] ? (h[3].toLowerCase() as 'arm' | 'leg') : null,
        sessions: [],
        lineNumber,
      }
      blocks.push(current)
      return
    }
    if (!current) {
      errors.push({ lineNumber, message: `Expected an exercise header before "${line}"` })
      return
    }
    const parsed = parseExerciseLine(line)
    for (const e of parsed.errors) errors.push({ lineNumber, message: e.message })
    if (parsed.errors.length === 0 && parsed.segments.length > 0) {
      current.sessions.push({ segments: parsed.segments, lineNumber })
    }
  })
  return { blocks, errors }
}

// ---------- serialization (canonical form, §3.2) ----------

function fmtLoad(load: number): string {
  const s = Number.isInteger(load) ? String(load) : String(Math.round(load * 1000) / 1000)
  return s.replace('.', ',')
}

export function serializeHeader(h: {
  name: string
  lo: number | null
  hi: number | null
  sets: number
  marker: 'arm' | 'leg' | null
}): string {
  const spec =
    h.lo === null || h.hi === null ? 'failure' : h.lo === h.hi ? String(h.lo) : `${h.lo}-${h.hi}`
  const marker = h.marker && spec !== 'failure' ? `/${h.marker}` : ''
  return `${collapseWs(h.name)} ${spec}${marker} x ${h.sets}`
}

/** Merges consecutive segments at the same load, then writes "load.reps.reps seg2…". */
export function serializeSessionLine(segments: ParsedSegment[]): string {
  const merged: ParsedSegment[] = []
  for (const s of segments) {
    const last = merged[merged.length - 1]
    if (last && last.load === s.load) last.sets.push(...s.sets)
    else merged.push({ load: s.load, sets: [...s.sets] })
  }
  return merged
    .map((seg) => {
      const reps = seg.sets.map((st) => (st.reps === null ? 'f' : String(st.reps)))
      const allFailure = seg.sets.length > 0 && seg.sets.every((st) => st.reps === null)
      const load = seg.load === 0 && allFailure ? '' : fmtLoad(seg.load)
      return [load, ...reps].join('.')
    })
    .join(' ')
}

export function serializeBlocks(blocks: ParsedExerciseBlock[]): string {
  return blocks
    .map((b) => {
      const header = serializeHeader({
        name: b.rawName,
        lo: b.lo,
        hi: b.hi,
        sets: b.sets,
        marker: b.unilateralMarker,
      })
      const lines = b.sessions.map((s) => serializeSessionLine(s.segments))
      return [header, ...lines].join('\n')
    })
    .join('\n\n')
}
