/**
 * Phase 66 / ADR-0028 D-05 -- one-time recovery codes. Pure module (Node crypto, no I/O) so a
 * spec can check format, normalisation and hashing. The codes are shown once; only an
 * HMAC-SHA256 with the server pepper (RECOVERY_PEPPER, a Fly secret) is stored.
 */
import { createHmac, randomInt } from 'node:crypto'

// Base32-sized alphabet without look-alikes (no 0/o, 1/i/l). 31 letters, 8 per code: ~39 bits.
export const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export const CODE_COUNT = 10
export const CODE_FORMAT = /^[a-hjkmnp-z2-9]{4}-[a-hjkmnp-z2-9]{4}$/

export function newCode(): string {
  let s = ''
  for (let i = 0; i < 8; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
  return `${s.slice(0, 4)}-${s.slice(4)}`
}

export function newCodes(n = CODE_COUNT): string[] {
  const set = new Set<string>()
  while (set.size < n) set.add(newCode())
  return [...set]
}

/** What a person types: any case, spaces or dashes. Null when it can't be a code. */
export function normaliseCode(input: string): string | null {
  const s = input.toLowerCase().replace(/[\s-]/g, '')
  if (s.length !== 8 || [...s].some((c) => !CODE_ALPHABET.includes(c))) return null
  return `${s.slice(0, 4)}-${s.slice(4)}`
}

export function hashCode(code: string, pepper: string): string {
  return createHmac('sha256', pepper).update(code).digest('hex')
}
