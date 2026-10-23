/**
 * Phase 66 / ADR-0028 -- the ONE classifier for "is this an elevated person, and has the
 * session proved the second step?". Plain module (no directive): the proxy, getSessionContext,
 * server actions and pages all import it.
 *
 * Admins and safety managers need an aal2 session for any admin screen or write. Before the
 * second step getSessionContext() reports them as a worker, so every role check in the app
 * fails closed without knowing about aal; RLS checks the same thing through public.is_elevated().
 */
export const ELEVATED_ROLES = ['admin', 'safety_manager'] as const

export function isElevatedRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'safety_manager'
}

/** An elevated member whose session is not aal2 yet. */
export function needsSecondStep(role: string | null | undefined, aal: unknown): boolean {
  return isElevatedRole(role) && aal !== 'aal2'
}

/** Where an elevated member proves the second step; `next` is re-validated by the page. */
export function verifyHref(next: string | null | undefined): string {
  return next ? `/verify?next=${encodeURIComponent(next)}` : '/verify'
}
