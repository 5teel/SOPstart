import crypto from 'node:crypto'

/**
 * Phase 60 (A-08) -- bearer check shared by the cron routes. Plain module, no
 * directive. The secret is CRON_SECRET; unset fails closed.
 */
export function isCronAuthorized(request: { headers: Headers }): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false // fail closed — no secret configured, reject everything

  const header = request.headers.get('authorization') ?? ''
  const provided = header.replace(/^Bearer\s+/i, '').trim()
  const providedBuf = Buffer.from(provided)
  const secretBuf = Buffer.from(secret)
  // timingSafeEqual throws on length mismatch — compare lengths first,
  // still constant-time for the (common) equal-length case.
  if (providedBuf.length !== secretBuf.length) return false
  return crypto.timingSafeEqual(providedBuf, secretBuf)
}
