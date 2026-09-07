import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  HEADER_RE,
  isCommentLine,
  normalize,
  parseExerciseLine,
  parseNotes,
  resolveExerciseName,
  serializeBlocks,
  serializeHeader,
  serializeSessionLine,
} from '../shorthand'

const example = readFileSync(join(__dirname, 'fixtures', 'notes-example.txt'), 'utf8')

const exercises = [
  { id: 'rdl', name: 'Barbell RDL', aliases: ['RDL'] },
  { id: 'mcp', name: 'Machine Chest Press', aliases: [] },
  { id: 'row', name: 'Machine Chest-Supported Row', aliases: ['Chest-supported Row'] },
  { id: 'llc', name: 'Lying Leg Curl', aliases: [] },
  { id: 'crf', name: 'Cable Reverse Fly', aliases: ['Reverse pec deck'] },
  { id: 'ext', name: 'Sidelying DB External Rotation', aliases: ['External Rotation (L arm first)'] },
  { id: 'bwc', name: 'Standing BW Calf Raise', aliases: ['Standing bw Calf Raise'] },
  { id: 'ldb', name: 'Low-Incline DB Press (15-30°)', aliases: [] },
  { id: 'sllp', name: 'Single-Leg Leg Press', aliases: [] },
]

describe('parseNotes on the §3 example', () => {
  const { blocks, errors } = parseNotes(example, exercises)
  it('yields 7 resolved blocks and no errors', () => {
    expect(errors).toEqual([])
    expect(blocks).toHaveLength(7)
    expect(blocks.map((b) => b.exerciseId)).toEqual(['rdl', 'mcp', 'row', 'llc', 'crf', 'ext', 'bwc'])
    expect(blocks.every((b) => b.sessions.length === 2 || b.rawName === 'Standing bw Calf Raise')).toBe(true)
  })
  it('parses header forms', () => {
    expect(blocks[0]).toMatchObject({ rawName: 'Barbell RDL', headerKind: 'range', lo: 8, hi: 10, sets: 3, unilateralMarker: null })
    expect(blocks[5]).toMatchObject({ rawName: 'External Rotation (L arm first)', lo: 15, hi: 15, sets: 2 })
    expect(blocks[6]).toMatchObject({ rawName: 'Standing bw Calf Raise', headerKind: 'failure', lo: null, hi: null, sets: 2 })
  })
  it('parses session lines', () => {
    expect(blocks[1].sessions[1].segments).toEqual([{ load: 27, sets: [{ reps: 12, toFailure: false }, { reps: 9, toFailure: false }, { reps: 8, toFailure: false }] }])
    expect(blocks[6].sessions[0].segments).toEqual([{ load: 0, sets: [{ reps: null, toFailure: true }, { reps: null, toFailure: true }] }])
  })
  it('round-trips exactly', () => {
    expect(serializeBlocks(blocks)).toBe(normalize(example))
  })
})

describe('session line grammar', () => {
  it('handles segments, comma decimals, bw, negative and failure', () => {
    expect(parseExerciseLine('27.12.9.8').segments).toEqual([{ load: 27, sets: [{ reps: 12, toFailure: false }, { reps: 9, toFailure: false }, { reps: 8, toFailure: false }] }])
    expect(parseExerciseLine('25.12.12 27.10').segments).toHaveLength(2)
    expect(parseExerciseLine('12,5.10.10').segments[0].load).toBe(12.5)
    expect(parseExerciseLine('.f.f').segments[0]).toEqual({ load: 0, sets: [{ reps: null, toFailure: true }, { reps: null, toFailure: true }] })
    expect(parseExerciseLine('bw.8.8').segments[0].load).toBe(0)
    expect(parseExerciseLine('-20.6.6').segments[0].load).toBe(-20)
    expect(parseExerciseLine('27.12.x').errors).toHaveLength(1)
    expect(parseExerciseLine('abc.12').errors).toHaveLength(1)
  })
})

describe('canonicalisation', () => {
  const ex = [{ id: 'x', name: 'Foo', aliases: [] }]
  const canon = (text: string) => serializeBlocks(parseNotes(text, ex).blocks)
  it('rewrites accepted non-canonical input', () => {
    expect(canon('Foo 8-12 x 2\nbw.8.8')).toBe('Foo 8-12 x 2\n0.8.8')
    expect(canon('Foo failure x 2\n0.f.f')).toBe('Foo failure x 2\n.f.f')
    expect(canon('Foo 15-15 x 2\n20.15.15')).toBe('Foo 15 x 2\n20.15.15')
    expect(canon('Foo 8-12 x 3\n25.12 25.12 27.10')).toBe('Foo 8-12 x 3\n25.12.12 27.10')
    expect(canon('Foo 8-12 x 2\n12,50.10.10')).toBe('Foo 8-12 x 2\n12,5.10.10')
    expect(canon('Foo   8-12   x   2\n\n\n27.12.12\n')).toBe('Foo 8-12 x 2\n27.12.12')
  })
  it('normalize is whitespace-only', () => {
    expect(normalize('  a  b \r\n\n\n c \n\n')).toBe('a b\n\nc')
  })
})

describe('comments and block boundaries', () => {
  const ex = [{ id: 'a', name: 'Foo', aliases: [] }, { id: 'b', name: 'Bar', aliases: [] }]
  it('skips comment lines', () => {
    expect(isCommentLine('### 2026-09-07 Mon — Push A')).toBe(true)
    expect(isCommentLine('(swapped from X)')).toBe(true)
    expect(isCommentLine('Note: felt easy')).toBe(true)
    expect(isCommentLine('27.12.12')).toBe(false)
    const text = '### 2026-09-07 Mon — Push A\nFoo 8-12 x 2\n(swapped from Bar)\n27.12.12\nNote: felt easy, as planned.\n\nBar 10-12 x 2\n25.10.10'
    const { blocks, errors } = parseNotes(text, ex)
    expect(errors).toEqual([])
    expect(blocks).toHaveLength(2)
    expect(blocks[0].sessions).toHaveLength(1)
  })
  it('a header line always starts a new block, blank line optional', () => {
    const { blocks, errors } = parseNotes('Foo 8-12 x 2\n27.12.12\nBar 10-12 x 2\n25.10.10', ex)
    expect(errors).toEqual([])
    expect(blocks.map((b) => b.rawName)).toEqual(['Foo', 'Bar'])
  })
  it('right-anchored headers with digits in the name and markers', () => {
    const { blocks } = parseNotes('Low-Incline DB Press (15-30°) 8-12 x 3\n30.10.10.10\nSingle-Leg Leg Press 10-12/leg x 2\n90.12.12', exercises)
    expect(blocks[0]).toMatchObject({ rawName: 'Low-Incline DB Press (15-30°)', lo: 8, hi: 12, sets: 3, exerciseId: 'ldb' })
    expect(blocks[1]).toMatchObject({ rawName: 'Single-Leg Leg Press', unilateralMarker: 'leg', exerciseId: 'sllp' })
    expect(HEADER_RE.test('Standing bw Calf Raise failure x 2')).toBe(true)
  })
  it('errors carry line numbers; unresolved names are not errors', () => {
    const { blocks, errors } = parseNotes('27.12.12\nMystery Lift 8-12 x 2\n27.12.12\n27.12.zz', ex)
    expect(errors).toEqual([
      { lineNumber: 1, message: 'Expected an exercise header before "27.12.12"' },
      { lineNumber: 4, message: 'Bad reps "zz" in "27.12.zz"' },
    ])
    expect(blocks[0].exerciseId).toBeNull()
    expect(blocks[0].sessions).toHaveLength(1)
  })
})

describe('serializers and name resolution', () => {
  it('serializeHeader forms', () => {
    expect(serializeHeader({ name: 'Foo', lo: 8, hi: 12, sets: 3, marker: null })).toBe('Foo 8-12 x 3')
    expect(serializeHeader({ name: 'Foo', lo: 15, hi: 15, sets: 2, marker: 'arm' })).toBe('Foo 15/arm x 2')
    expect(serializeHeader({ name: 'Foo', lo: null, hi: null, sets: 2, marker: null })).toBe('Foo failure x 2')
  })
  it('serializeSessionLine', () => {
    expect(serializeSessionLine([{ load: 27.5, sets: [{ reps: 8, toFailure: false }, { reps: null, toFailure: true }] }])).toBe('27,5.8.f')
    expect(serializeSessionLine([{ load: 0, sets: [{ reps: 8, toFailure: false }] }])).toBe('0.8')
    expect(serializeSessionLine([{ load: -20, sets: [{ reps: 6, toFailure: false }] }])).toBe('-20.6')
  })
  it('resolves exact then alias, case- and whitespace-insensitive', () => {
    expect(resolveExerciseName('barbell   rdl', exercises)).toBe('rdl')
    expect(resolveExerciseName('rdl', exercises)).toBe('rdl')
    expect(resolveExerciseName('REVERSE PEC DECK', exercises)).toBe('crf')
    expect(resolveExerciseName('Nothing', exercises)).toBeNull()
  })
})
