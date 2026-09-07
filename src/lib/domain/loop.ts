// Loop pointer (spec §2.1, §7.2).
import type { SessionType } from './types'

export function advanceLoop(templateCount: number, finishedIndex: number): number {
  if (templateCount <= 0) throw new Error('advanceLoop: no templates')
  return (finishedIndex + 1) % templateCount
}

/** Walk days never advance; a non-next template started with "don't advance" doesn't either. */
export function sessionAdvances(type: SessionType, advancedLoop: boolean): boolean {
  return type !== 'walk' && advancedLoop
}
