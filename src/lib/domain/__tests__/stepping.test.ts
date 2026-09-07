import { describe, expect, it } from 'vitest'
import { fmtNum, formatLoad } from '../load-format'
import { ladderNext, ladderPrev, ladderRoundDown } from '../rack'
import { easyLoad, roundToStep, step, stepDown } from '../stepping'
import { assist, bw, db, gym, landmineLb, perSideLegPress, perSideRdl, stackKg } from './fixtures'

const rack = gym.dumbbellRackLb

describe('rack ladder (§4.2)', () => {
  it('next', () => {
    expect(ladderNext(62, rack)).toBe(65)
    expect(ladderNext(60, rack)).toBe(65)
    expect(ladderNext(65, rack)).toBe(70)
    expect(ladderNext(0, rack)).toBe(2.5)
    expect(ladderNext(50, rack)).toBe(60)
    expect(ladderNext(63, rack)).toBe(65)
  })
  it('prev', () => {
    expect(ladderPrev(62, rack)).toBe(60)
    expect(ladderPrev(70, rack)).toBe(65)
    expect(ladderPrev(65, rack)).toBe(60)
    expect(ladderPrev(2.5, rack)).toBeNull()
    expect(ladderPrev(1, rack)).toBeNull()
    expect(ladderPrev(60, rack)).toBe(50)
  })
  it('roundDown', () => {
    expect(ladderRoundDown(56, rack)).toBe(50)
    expect(ladderRoundDown(2, rack)).toBeNull()
    expect(ladderRoundDown(72, rack)).toBe(70)
    expect(ladderRoundDown(60, rack)).toBe(60)
    expect(ladderRoundDown(2.5, rack)).toBe(2.5)
  })
})

describe('formatLoad (§4.3)', () => {
  it('formats every load type', () => {
    expect(formatLoad(bw, 0)).toBe('BW')
    expect(formatLoad(bw, 10)).toBe('BW +10 lb')
    expect(formatLoad(bw, 2.5)).toBe('BW +2.5 lb')
    expect(formatLoad(bw, -20)).toBe('−20 lb')
    expect(formatLoad(assist, 20)).toBe('20 kg assist')
    expect(formatLoad(assist, 0)).toBe('0 kg assist')
    expect(formatLoad(perSideLegPress, 180)).toBe('180 lb/side')
    expect(formatLoad(stackKg, 27)).toBe('27 kg')
    expect(formatLoad(db, 12.5)).toBe('12.5 lb')
    expect(formatLoad(landmineLb, 10)).toBe('10 lb')
    expect(formatLoad(stackKg, null)).toBe('')
  })
  it('fmtNum drops trailing zeros', () => {
    expect(fmtNum(27)).toBe('27')
    expect(fmtNum(12.5)).toBe('12.5')
    expect(fmtNum(27.5)).toBe('27.5')
    expect(fmtNum(-15)).toBe('−15')
  })
})

describe('step (§7.4)', () => {
  it('steps up by rule', () => {
    expect(step(stackKg, 27, gym)).toBe(32)
    expect(step(perSideRdl, 25, gym)).toBe(27.5)
    expect(step(perSideLegPress, 180, gym)).toBe(190)
    expect(step(db, 60, gym)).toBe(65)
    expect(step(db, 12.5, gym)).toBe(15)
    expect(step(bw, 0, gym)).toBe(2.5)
    expect(step(bw, -20, gym)).toBe(-15)
    expect(step(bw, -3, gym)).toBe(0)
    expect(step(assist, 15, gym)).toBe(10)
    expect(step(assist, 5, gym)).toBe(0)
    expect(step(assist, 0, gym)).toBe(0)
  })
  it('steps down for the weight chip', () => {
    expect(stepDown(stackKg, 27, gym)).toBe(22)
    expect(stepDown(stackKg, 3, gym)).toBe(0)
    expect(stepDown(db, 62, gym)).toBe(60)
    expect(stepDown(db, 2.5, gym)).toBeNull()
    expect(stepDown(bw, 2.5, gym)).toBe(0)
    expect(stepDown(bw, 0, gym)).toBe(-5)
    expect(stepDown(assist, 10, gym)).toBe(15)
  })
})

describe('easyLoad (§7.4 easy)', () => {
  it('rounds to the exercise step in its own unit', () => {
    expect(easyLoad(stackKg, 27, gym)).toBe(20) // 21.6 → nearest 5
    expect(easyLoad(stackKg, 35, gym)).toBe(30) // 28 → 30
    expect(easyLoad(landmineLb, 10, gym)).toBe(10) // 8 → 10 (lb, step 5)
    expect(easyLoad(perSideLegPress, 180, gym)).toBe(140) // 144 → nearest 10
    expect(easyLoad(perSideRdl, 50, gym)).toBe(40) // 40 → 40
    expect(easyLoad(db, 70, gym)).toBe(50) // 56 → roundDown → 50
    expect(easyLoad(db, 2.5, gym)).toBe(2.5) // 2 → null → rack minimum
    expect(easyLoad(bw, 0, gym)).toBe(0)
    expect(easyLoad(bw, -20, gym)).toBe(-20)
    expect(easyLoad(bw, 10, gym)).toBe(7) // 8 → roundDown → 7
    expect(easyLoad(assist, 15, gym)).toBe(20) // 18 → up to 5
    expect(easyLoad(assist, 0, gym)).toBe(0)
  })
  it('roundToStep rounds half up', () => {
    expect(roundToStep(21.6, 5)).toBe(20)
    expect(roundToStep(22.5, 5)).toBe(25)
    expect(roundToStep(27.5, 2.5)).toBe(27.5)
  })
})
