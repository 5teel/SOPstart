/**
 * roleHome — the ONE place the role → home-screen mapping is decided (UX-01).
 *
 * Plain module (NOT 'use server') so middleware, server actions, and page
 * guards can all import it — a sync export in a 'use server' file breaks
 * `next build` (CLAUDE.md learning 2026-06-27).
 *
 * Mapping (Phase 30 CONTEXT, locked decision UX-01):
 *   worker → /sops · supervisor → /activity · safety_manager → /activity ·
 *   admin → /admin/sops · absent/unknown role → /pending (safe default, A1).
 */
export function roleHome(role: string | null | undefined): string {
  switch (role) {
    case 'worker':
      return '/sops'
    case 'supervisor':
    case 'safety_manager':
      return '/activity'
    case 'admin':
      return '/admin/sops'
    default:
      return '/pending'
  }
}
