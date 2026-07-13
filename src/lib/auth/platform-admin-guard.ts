import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'

/**
 * Server-side guard: redirects to /dashboard if current user is not a platform
 * super-admin (Potenco internal only).
 *
 * Phase 25: The /admin/global-blocks and /admin/global-blocks/suggestions routes
 * were deleted in plan 25-05 (global block curation model retired). This guard
 * is retained because is_platform_admin() is still referenced by other RLS policies
 * (e.g. ai_review_results in migration 00032 — see Phase 25-01 decision).
 *
 * Defence in depth: this guard prevents platform-admin pages from rendering for
 * non-admin users; the underlying RLS policies (renamed in 00026) still gate
 * the actual writes. Bypassing this guard would still be blocked at the DB layer.
 */
export async function requirePlatformAdmin() {
  const { supabase, userId } = await getSessionContext()
  if (!userId) redirect('/login')

  // Call the SECURITY DEFINER helper from migration 00022 (renamed in 00026).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('is_platform_admin')
  if (error || data !== true) redirect('/dashboard')
  return { id: userId }
}
