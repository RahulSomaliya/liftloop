// Shoulder / elbow rules (spec §2.3.2, §7.8). Input: newest-first live finished non-walk logged
// sessions. The flag needs three sessions in a row; two sessions can never trigger it.
const THRESHOLD = 2

function threeInARow(values: (number | null)[]): boolean {
  if (values.length < 3) return false
  return values.slice(0, 3).every((v) => v !== null && v > THRESHOLD)
}

export function shoulderFlag(sessions: { shoulderPain: number | null }[]): boolean {
  return threeInARow(sessions.map((s) => s.shoulderPain))
}

export function elbowFlag(sessions: { elbowPain: number | null }[]): boolean {
  return threeInARow(sessions.map((s) => s.elbowPain))
}

export const SHOULDER_BANNER = 'Shoulder > 2 three sessions in a row — tell your coach.'
