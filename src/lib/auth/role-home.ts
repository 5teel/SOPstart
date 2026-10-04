/**
 * roleHome — the ONE place the role → home-screen mapping is decided (UX-01).
 *
 * Plain module (NOT a server-action file) so middleware, server actions, and
 * page guards can all import it — a sync export in a server-action module
 * breaks `next build` (CLAUDE.md learning 2026-06-27).
 *
 * Mapping (Phase 57 D-10): every role lands on the one screen (/);
 * absent/unknown role -> /pending (safe default, A1).
 */
export function roleHome(role: string | null | undefined): string {
  switch (role) {
    case 'worker':
    case 'supervisor':
    case 'safety_manager':
    case 'admin':
      return '/'
    default:
      return '/pending'
  }
}
