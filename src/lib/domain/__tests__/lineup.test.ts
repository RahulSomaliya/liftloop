import { describe, expect, it } from 'vitest'
import { nextIncomplete, postponeAt } from '../lineup'

describe('postponeAt (§6.3 v1.2)', () => {
  it('moves the item one place later: 1·2·3·4·5 → 1·2·4·3·5', () => {
    expect(postponeAt([1, 2, 3, 4, 5], 2)).toEqual([1, 2, 4, 3, 5])
  })
  it('postponing again pushes it one more place', () => {
    expect(postponeAt(postponeAt([1, 2, 3, 4, 5], 2), 3)).toEqual([1, 2, 4, 5, 3])
  })
  it('leaves the last item and bad indexes alone, never mutating the input', () => {
    const list = [1, 2, 3]
    expect(postponeAt(list, 2)).toEqual([1, 2, 3])
    expect(postponeAt(list, -1)).toEqual([1, 2, 3])
    expect(postponeAt(list, 7)).toEqual([1, 2, 3])
    expect(list).toEqual([1, 2, 3])
  })
})

describe('nextIncomplete', () => {
  it('finds the next unfinished item after the current one', () => {
    expect(nextIncomplete([true, false, false, false], 1)).toBe(2)
  })
  it('wraps to an earlier unfinished item (a postponed one left behind)', () => {
    expect(nextIncomplete([true, false, true, true], 3)).toBe(1)
  })
  it('returns -1 when everything is done', () => {
    expect(nextIncomplete([true, true], 0)).toBe(-1)
    expect(nextIncomplete([], 0)).toBe(-1)
  })
})
