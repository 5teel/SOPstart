import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { ProtectedProviders, type AppRole } from '@/components/providers/ProtectedProviders'
import { HomeShell } from '@/components/home/HomeShell'
import { ensureReviewDueNotifications } from '@/lib/notifications/ensure-review-due'
import { formatHome, legacyToHome, parseHome } from '@/lib/shell/home-state'

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
  if (organisationId) {
    const [{ data: org }] = await Promise.all([
      supabase.from('organisations').select('name').eq('id', organisationId).maybeSingle(),
      ensureReviewDueNotifications(organisationId, userId),
    ])
    if (org?.name) siteName = org.name
  }

  const query = new URLSearchParams()
  for (const k of ['s', 'sop', 'area', 'tab', 'pin', 'view']) {
    const v = str(q[k])
    if (v !== null) query.set(k, v)
  }

  return (
    <ProtectedProviders role={role as AppRole}>
      <HomeShell siteName={siteName} userEmail={userEmail} userId={userId} role={role} initial={parseHome(query)} />
    </ProtectedProviders>
  )
}
