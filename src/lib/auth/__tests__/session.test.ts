import { describe, expect, it } from 'vitest'
import { cookieOptions, signSession, verifySession } from '../session'

const secret = 'test-secret-that-is-long-enough-for-hs256-1234'

describe('auth cookie (§10.2)', () => {
  it('signs and verifies', async () => {
    const token = await signSession(secret)
    expect(await verifySession(token, secret)).toBe(true)
  })
  it('rejects tampering, wrong secret and expiry', async () => {
    const token = await signSession(secret, new Date('2026-09-07T00:00:00Z'))
    expect(await verifySession(token + 'x', secret)).toBe(false)
    expect(await verifySession(token, secret + 'y')).toBe(false)
    expect(await verifySession(token, secret, new Date('2026-12-05T23:00:00Z'))).toBe(true)
    expect(await verifySession(token, secret, new Date('2026-12-07T00:00:01Z'))).toBe(false)
    expect(await verifySession(undefined, secret)).toBe(false)
  })
  it('cookie options', () => {
    expect(cookieOptions(true)).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 7776000 })
    expect(cookieOptions(false).secure).toBe(false)
  })
})
