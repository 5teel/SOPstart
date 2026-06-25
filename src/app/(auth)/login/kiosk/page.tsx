/**
 * /login/kiosk — Roster name-select kiosk login (D-11)
 *
 * This page is under (auth)/ so it renders WITHOUT a worker session.
 * The per-org kiosk account (role='worker') must be signed in on the shared
 * device by an admin as a one-time setup (RESEARCH Option A). Workers then
 * pick their name from the roster — no password required.
 *
 * IMPORTANT: kiosk account setup is a one-time manual admin action per org:
 *   1. Create auth.users entry: kiosk+{org_id}@internal (no email verification needed)
 *   2. Add to organisation_members with role='worker' for the org
 *   3. Sign the shared device into this account and leave it authenticated
 * Auto-provisioning of kiosk accounts is deferred (RESEARCH Open Question #1).
 *
 * Security: if an admin or safety_manager is already authenticated on this device,
 * they are redirected away — the kiosk route must not be an escalation surface.
 * The kiosk account is permanently role='worker' (T-23-06-02).
 */
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import RosterSelector from '@/components/auth/RosterSelector'
import { parseJwtPayload } from '@/lib/supabase/jwt'

export const metadata: Metadata = {
  title: 'Select Your Name — SafeStart',
}

export default async function KioskLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>
}) {
  const params = await searchParams
  const orgCode = params.org ?? ''

  // Redirect admin/safety_manager away — kiosk route must not be an escalation surface
  // (T-23-06-02: kiosk account is permanently role='worker'; other authed roles must not
  // be able to impersonate workers via the roster route)
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    const jwtClaims = parseJwtPayload(session.access_token)
    const role: string | undefined = jwtClaims['user_role'] as string | undefined
    if (role && ['admin', 'safety_manager', 'supervisor'].includes(role)) {
      redirect('/dashboard')
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--ink-900)] mb-2 text-center">
        Select your name to continue
      </h2>
      <p className="text-sm text-[var(--ink-500)] text-center mb-6">
        Tap your name to start a walkthrough
      </p>
      <RosterSelector orgCode={orgCode} />
    </div>
  )
}
