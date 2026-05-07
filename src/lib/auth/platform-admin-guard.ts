import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Server-side guard: redirects to /dashboard if current user is not a platform
 * super-admin. Call at the top of every page.tsx in /admin/global-blocks/*.
 * Returns the authenticated user object on success.
 *
 * Defence in depth: this guard prevents the page from rendering for non-admin
 * users, but the underlying RLS policies from 00022 (renamed in 00026)
 * — `blocks_platform_admin_global_write`, `blocks_platform_admin_global_update`,
 * `block_versions_platform_admin_global_insert`, and
 * `block_suggestions_update_platform_only` — also gate the actual writes.
 * Bypassing this guard would still get blocked at the DB layer.
 */
export async function requirePlatformAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Call the SECURITY DEFINER helper from migration 00022 (renamed in 00026).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('is_platform_admin')
  if (error || data !== true) redirect('/dashboard')
  return user
}
