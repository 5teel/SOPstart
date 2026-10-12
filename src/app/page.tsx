import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { ProtectedProviders, type AppRole } from '@/components/providers/ProtectedProviders'
import { HomeShell } from '@/components/home/HomeShell'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureReviewDueNotifications } from '@/lib/notifications/ensure-review-due'
import { formatHome, legacyToHome, parseHome } from '@/lib/shell/home-state'
import { PACKINGS, type Packing } from '@/lib/library/iso-layout'

/**
 * `/` sends a visitor to the promo reel at /welcome (its own route, so the
 * reel never weighs on this page's bundle) and is the SOP-first home for a
 * signed-in member.
 * The branch is decided here, on the server, from the session -- never by a
 * client redirect (CLAUDE.md 2026-09-29). An old `?place=` address is redirected
 * here too, to a fixed template over whitelisted tokens (T-63-30).
 */
type Q = string | string[] | undefined
const str = (v: Q) => (typeof v === 'string' ? v : null)

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, Q>>
}) {
  const { supabase, userId, userEmail, role, organisationId } = await getSessionContext()

  if (!userId) redirect('/welcome')
  if (!role) redirect('/pending')

  const q = await searchParams
  const place = str(q.place)
  if (place !== null) redirect(formatHome(legacyToHome(place, str(q.tab), str(q.sop))))

  // ADR-0002: due reviews are written on the read that needs them -- the caller's
  // own rows only, idempotent, never throws -- before the bell reads them.
  let siteName = 'Your site'
  let packing: Packing = 'balanced'
  let sites: { id: string; name: string }[] = []
  if (organisationId) {
    const [{ data: org }, { data: mine }] = await Promise.all([
      // '*' carries site_map_packing (00077), which database.types.ts predates.
      supabase.from('organisations').select('*').eq('id', organisationId).maybeSingle(),
      // The caller's own memberships across sites, for the site picker (2026-10-11).
      createAdminClient().from('organisation_members').select('organisations ( id, name )').eq('user_id', userId),
      ensureReviewDueNotifications(organisationId, userId),
    ])
    if (org?.name) siteName = org.name
    const p = (org as { site_map_packing?: string } | null)?.site_map_packing
    if (PACKINGS.includes(p as Packing)) packing = p as Packing
    sites = (mine ?? [])
      .map((m) => m.organisations as unknown as { id: string; name: string } | null)
      .filter((o): o is { id: string; name: string } => !!o)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  const query = new URLSearchParams()
  for (const k of ['s', 'sop', 'area', 'tab', 'pin', 'view']) {
    const v = str(q[k])
    if (v !== null) query.set(k, v)
  }

  return (
    <ProtectedProviders role={role as AppRole}>
      <HomeShell siteName={siteName} siteId={organisationId} sites={sites} userEmail={userEmail} userId={userId} role={role} initial={parseHome(query)} packing={packing} />
    </ProtectedProviders>
  )
}
