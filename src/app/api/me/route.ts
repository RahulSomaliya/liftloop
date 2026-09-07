import { NextResponse } from 'next/server'

/** Auth ping: the proxy answers 401 JSON when the cookie is missing or invalid. */
export function GET(): NextResponse {
  return NextResponse.json({ ok: true })
}
