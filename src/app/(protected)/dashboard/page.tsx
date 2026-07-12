import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { roleHome } from '@/lib/auth/role-home'

/**
 * /dashboard — redirect-only shim (UX-01, orchestrator decision #5).
 *
 * The route survives ONLY so legacy guards, bookmarks, and stale PWA caches
 * that still target /dashboard forward to the caller's real role home.
 * No UI renders here — the old admin tile grid and inline pending UI were
 * removed in Phase 30 (the pending holding screen now lives at /pending).
 */
export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('organisation_members')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  redirect(roleHome(member?.role))
}
