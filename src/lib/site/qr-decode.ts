/**
 * Phase 53 -- plate URL builder and "is this our plate" scanned-URL
 * validator (T-53-02).
 *
 * Plain module, no directive -- a server page, a client sheet and specs
 * all import it. Callers always rebuild the navigation target from the
 * returned code, never from scanned text.
 */
import { MACHINE_CODE_PATTERN } from '@/lib/site/scene'

export function normaliseMachineCode(raw: string): string | null {
  const code = raw.trim().toUpperCase()
  return MACHINE_CODE_PATTERN.test(code) ? code : null
}

export function plateUrl(origin: string, code: string): string {
  const normalised = normaliseMachineCode(code)
  if (!normalised) throw new Error(`Invalid machine code: ${code}`)
  return origin.replace(/\/+$/, '') + '/m/' + normalised
}

export function extractMachineCode(scanned: string, origin: string): string | null {
  let url: URL
  let base: URL
  try {
    // No base argument: relative and bare strings fail to parse, as intended.
    url = new URL(scanned.trim())
    base = new URL(origin)
  } catch {
    return null
  }
  if (url.origin !== base.origin) return null
  const match = url.pathname.match(/^\/m\/([^/]+)\/?$/)
  if (!match) return null
  return normaliseMachineCode(match[1])
}

export function isOurPlateUrl(scanned: string, origin: string): boolean {
  return extractMachineCode(scanned, origin) !== null
}
