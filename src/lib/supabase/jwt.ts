/**
 * parseJwtPayload — safe Base64URL → Base64 JWT payload decoder.
 *
 * Standard `atob` only handles Base64 (uses `+` and `/`), but JWT payloads are
 * Base64URL-encoded (uses `-` and `_`, no padding). Any claim whose encoded
 * representation happens to include `+` or `/` (uncommon but valid for UUIDs
 * and binary claim values) throws `InvalidCharacterError` with the raw atob call.
 *
 * This helper converts Base64URL → Base64 before calling atob, and wraps the
 * whole decode in try/catch so a malformed token always returns {} rather than
 * crashing the calling server action.
 *
 * Usage:
 *   import { parseJwtPayload } from '@/lib/supabase/jwt'
 *   const claims = parseJwtPayload(session.access_token)
 *   const orgId = claims['organisation_id'] ?? null
 */
export function parseJwtPayload(token: string): Record<string, unknown> {
  try {
    const segment = token.split('.')[1]
    if (!segment) return {}
    // Convert Base64URL → Base64: replace - with +, _ with /, add padding
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(
      segment.length + (4 - (segment.length % 4)) % 4,
      '=',
    )
    return JSON.parse(atob(base64)) as Record<string, unknown>
  } catch {
    return {}
  }
}
