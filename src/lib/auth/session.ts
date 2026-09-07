// Auth cookie (spec §10.2): an HS256 JWT in an httpOnly cookie, valid 90 days. Rotating
// SESSION_SECRET logs out everywhere; changing APP_PASSCODE does not revoke issued cookies.
import { jwtVerify, SignJWT } from 'jose'

export const COOKIE_NAME = 'll_session'
export const SESSION_DAYS = 90
const SUBJECT = 'owner'

const key = (secret: string): Uint8Array => new TextEncoder().encode(secret)

export async function signSession(secret: string, now: Date = new Date()): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000)
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(SUBJECT)
    .setIssuedAt(iat)
    .setExpirationTime(iat + SESSION_DAYS * 24 * 60 * 60)
    .sign(key(secret))
}

export async function verifySession(token: string | undefined, secret: string, now: Date = new Date()): Promise<boolean> {
  if (!token) return false
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ['HS256'], subject: SUBJECT, currentDate: now })
    return payload.sub === SUBJECT
  } catch {
    return false
  }
}

export function cookieOptions(isProd: boolean): {
  httpOnly: true
  secure: boolean
  sameSite: 'lax'
  path: '/'
  maxAge: number
} {
  return { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: SESSION_DAYS * 24 * 60 * 60 }
}
