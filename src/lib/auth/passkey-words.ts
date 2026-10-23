/**
 * Phase 65 / ADR-0027 — plain sentences for passkey failures. Plain module, no directive:
 * the Profile section and the login button both import it. Codes are Supabase's AuthError
 * codes and the WebAuthnError codes from @supabase/auth-js; anything else gets the default.
 */
export function passkeyErrorWords(err: unknown, when: 'add' | 'sign-in'): string {
  const e = (err ?? {}) as { code?: string; name?: string; message?: string; cause?: { name?: string } }
  const code = e.code ?? ''
  const name = e.cause?.name ?? e.name ?? ''
  if (code === 'ERROR_CEREMONY_ABORTED' || name === 'NotAllowedError' || name === 'AbortError') {
    return when === 'add' ? 'Cancelled. Nothing was added.' : 'Cancelled. Try again, or use your password.'
  }
  if (code === 'ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED' || name === 'InvalidStateError') {
    return 'This device already has a passkey for your account.'
  }
  if (code === 'too_many_passkeys') return 'You have as many passkeys as allowed. Remove one first.'
  if (code === 'passkey_disabled') return 'Passkeys are switched off right now. Use your password.'
  if (code === 'webauthn_challenge_expired') return 'That took too long. Try again.'
  return when === 'add'
    ? "The passkey wasn't added. Try again."
    : "That passkey didn't sign you in. Use your password, or try another passkey."
}

/** WebAuthn is a browser API; call this after mount, never during the first render. */
export function browserHasPasskeys(): boolean {
  return typeof window !== 'undefined' && typeof window.PublicKeyCredential === 'function'
}
