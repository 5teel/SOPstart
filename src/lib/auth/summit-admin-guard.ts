import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Server-side guard: redirects to /dashboard if current user is not a Summit
 * super-admin. Call at the top of every page.tsx in /admin/global-blocks/*.
 * Returns the authenticated user object on success.
 *
 * Defence in depth: this guard prevents the page from rendering for non-summit
 * users, but the underlying RLS policies from 00022
 * (`blocks_summit_admin_global_write`, `blocks_summit_admin_global_update`,
 * `block_versions_summit_admin_global_insert`, and the
 * `block_suggestions_update_summit_only` policy) also gate the actual writes.
 * Bypassing this guard would still get blocked at the DB layer.
 */
export async function requireSummitAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Call the SECURITY DEFINER helper from migration 00022.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('is_summit_admin')
  if (error || data !== true) redirect('/dashboard')
  return user
}
