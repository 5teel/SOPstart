/**
 * Phase 67 / ADR-0029 -- in-person sign-in codes. Pure module (Node crypto, no I/O) so a spec can
 * check it directly. Same alphabet, shape and HMAC as the Phase 66 recovery codes; only the hash
 * is stored (signin_codes), and the check itself runs in the database (signin_code_try) so the
 * attempt count cannot race. The who-may-issue rule (D-01) is mayIssueSigninCode in authority.ts
 * (client-safe, no crypto), read by the People sheet and the server action alike.
 */
import { hashCode, newCode, normaliseCode } from '@/lib/auth/recovery-codes'

export const SIGNIN_CODE_MINUTES = 30
export const SIGNIN_CODE_MAX_ATTEMPTS = 5
/** The one sentence the login screen gives for every failure (D-03). */
export const SIGNIN_CODE_REFUSAL = "That code didn't work. Ask your supervisor for a new one."

/** A fresh code, shown in capitals so it reads aloud cleanly: "K7MP-Q4XZ". */
export function newSigninCode(): string {
  return newCode().toUpperCase()
}

/** What the person typed, in the stored form; null when it can't be a code. */
export function normaliseSigninCode(input: string): string | null {
  return typeof input === 'string' ? normaliseCode(input) : null
}

/** Domain-separated from the recovery codes, which share the pepper. */
export function hashSigninCode(normalised: string, pepper: string): string {
  return hashCode(`signin:${normalised}`, pepper)
}

export function signinCodeExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SIGNIN_CODE_MINUTES * 60_000)
}
