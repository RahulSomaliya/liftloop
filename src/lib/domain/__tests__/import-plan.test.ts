import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractSessionsSection, groupByDate, planImport } from '../import-plan'

const example = readFileSync(join(__dirname, 'fixtures', 'notes-example.txt'), 'utf8')
const report = readFileSync(join(__dirname, 'fixtures', 'report-expected.md'), 'utf8')

const exercises = [
  { id: 'rdl', name: 'Barbell RDL', aliases: ['RDL'] },
  { id: 'mcp', name: 'Machine Chest Press', aliases: [] },
  { id: 'row', name: 'Machine Chest-Supported Row', aliases: [] },
  { id: 'llc', name: 'Lying Leg Curl', aliases: [] },
  { id: 'crf', name: 'Cable Reverse Fly', aliases: ['Reverse pec deck'] },
  { id: 'ext', name: 'Sidelying DB External Rotation', aliases: ['External Rotation (L arm first)'] },
  { id: 'bwc', name: 'Standing BW Calf Raise', aliases: ['Standing bw Calf Raise'] },
]

describe('planImport (§5.3)', () => {
  it('keeps the last two lines per block, dated D and D−7', () => {
    const plan = planImport(example, exercises, '2026-09-06')
    expect(plan.errors).toEqual([])
    expect(plan.fromReport).toBe(false)
    expect(plan.blocks).toHaveLength(7)
    const rdl = plan.blocks[0]
    expect(rdl.lines.map((l) => [l.date, l.keep])).toEqual([
      ['2026-08-30', true],
      ['2026-09-06', true],
    ])
    expect(plan.blocks[6].lines).toHaveLength(1)
    expect(plan.blocks[6].lines[0].date).toBe('2026-09-06')
  })
  it('keeps only the last two of three lines', () => {
    const plan = planImport('Machine Chest Press 8-12 x 3\n20.12.12.12\n25.12.12.12\n27.12.9.8', exercises, '2026-09-06')
    expect(plan.blocks[0].lines.map((l) => [l.date, l.keep])).toEqual([
      ['2026-08-23', false],
      ['2026-08-30', true],
      ['2026-09-06', true],
    ])
  })
  it('groups by date with one session per date', () => {
    const groups = groupByDate(planImport(example, exercises, '2026-09-06').blocks)
    expect(groups.map((g) => [g.date, g.entries.length])).toEqual([
      ['2026-08-30', 6],
      ['2026-09-06', 7],
    ])
    expect(groups[1].entries[0]).toMatchObject({ exerciseId: 'rdl', lo: 8, hi: 10, sets: 3 })
  })
  it('unresolved names are kept in the plan but skipped by groupByDate', () => {
    const plan = planImport('Mystery 8-12 x 2\n20.12.12', exercises, '2026-09-06')
    expect(plan.blocks[0].exerciseId).toBeNull()
    expect(groupByDate(plan.blocks)).toEqual([])
  })
})

describe('report re-import', () => {
  it('uses only the Sessions section and dates blocks from ### headers', () => {
    const { text, fromReport } = extractSessionsSection(report)
    expect(fromReport).toBe(true)
    expect(text).not.toContain('## Summary')
    expect(text).not.toContain('## Exercise progression')
    const reportExercises = [
      { id: 'mcp', name: 'Machine Chest Press', aliases: [] },
      { id: 'lm', name: 'Half-Kneeling Landmine Press', aliases: [] },
      { id: 'pf', name: 'Pec Fly Machine', aliases: [] },
      { id: 'pu', name: 'Pull-Ups (overhand, shoulder-width)', aliases: [] },
      { id: 'row', name: 'Machine Chest-Supported Row', aliases: [] },
      { id: 'lp', name: 'Leg Press', aliases: [] },
      { id: 'llc', name: 'Lying Leg Curl', aliases: [] },
      { id: 'tri', name: 'Single-Arm Cable Overhead Triceps (rope)', aliases: [] },
      { id: 'pd', name: 'Cable Tricep Pushdown (rope)', aliases: [] },
    ]
    const plan = planImport(report, reportExercises, '2026-09-30')
    expect(plan.errors).toEqual([])
    expect(plan.blocks).toHaveLength(18)
    expect(plan.blocks[0]).toMatchObject({ rawName: 'Machine Chest Press', templateName: 'Push A' })
    expect(plan.blocks[0].lines[0]).toMatchObject({ date: '2026-09-07', keep: true })
    const short = plan.blocks.find((b) => b.lines[0].date === '2026-09-11')
    expect(short?.templateName).toBe('Push B')
    const groups = groupByDate(plan.blocks)
    expect(groups.map((g) => g.date)).toEqual(['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-11', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-18'])
    expect(groups[0].templateName).toBe('Push A')
  })
})
