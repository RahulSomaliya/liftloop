import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { generateCoachReport } from '../report'
import { parseNotes } from '../shorthand'
import { reportExercises, reportInput } from './fixtures/report-input'

const expected = readFileSync(join(__dirname, 'fixtures', 'report-expected.md'), 'utf8')

describe('generateCoachReport (§8 golden file)', () => {
  it('matches the reviewed golden output byte for byte', () => {
    expect(generateCoachReport(reportInput)).toBe(expected)
  })
  it('Sessions section re-imports through the §3 parser with zero errors', () => {
    const out = generateCoachReport(reportInput)
    const sessions = out.slice(out.indexOf('## Sessions'), out.indexOf('## Exercise progression'))
    const { blocks, errors } = parseNotes(sessions, reportExercises)
    expect(errors).toEqual([])
    expect(blocks).toHaveLength(18)
    expect(blocks.every((b) => b.exerciseId !== null)).toBe(true)
  })
  it('handles partial weeks, no owner, no data', () => {
    const out = generateCoachReport({ ...reportInput, from: '2026-09-10', to: '2026-09-23', today: '2026-09-24', ownerName: null, sessions: [], bodyMetrics: [], exportLog: [] })
    expect(out.startsWith('# LiftLoop report — 2026-09-10 → 2026-09-23\n')).toBe(true)
    expect(out).toContain('Phase: Ramp (W1–W2) → Build 1 (W3). Target 4→5 days/week. Sessions: 0/13 (W1*: 0, W2: 0, W3*: 0).')
    expect(out).toContain('- Sleep: good nights 0/14 (14 unrecorded)')
    expect(out).toContain('- Shoulder (0–10): —')
    expect(out).toContain('- Body weight: —')
    expect(out).toContain('- Verdicts: none')
    expect(out).toContain('- PRs: none')
    // W2 is complete and before today with 0 sessions; no export ever, but program start is only 16 days before `to`
    expect(out).toContain('- Flags: < 3 sessions in week 2')
    expect(out).toContain('| Muscle | W1* | W2 | W3* | Target |')
    expect(out).toContain('## Notes\n- none')
  })
  it('raises the shoulder flag on three consecutive sessions > 2', () => {
    const sessions = reportInput.sessions.map((s, i) => (i >= 6 ? { ...s, shoulderPain: 3 } : s))
    expect(generateCoachReport({ ...reportInput, sessions })).toContain('- Flags: shoulder > 2 on 3 sessions in a row, no export for 21+ days')
  })
})
