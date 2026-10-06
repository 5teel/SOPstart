import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { ProtectedProviders, type AppRole } from '@/components/providers/ProtectedProviders'
import { OneScreen } from '@/components/shell/OneScreen'

/**
 * `/` sends a visitor to the promo reel at /welcome (its own route, so the
 * reel never weighs on this page's bundle) and is the one screen for a
 * signed-in member.
 * The branch is decided here, on the server, from the session -- never by a
 * client redirect (CLAUDE.md 2026-09-29).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ place?: string | string[]; tab?: string | string[]; sop?: string | string[] }>
}) {
  const { supabase, userId, userEmail, role, organisationId } = await getSessionContext()

  if (!userId) redirect('/welcome')
  if (!role) redirect('/pending')

  let siteName = 'Your site'
  if (organisationId) {
    const { data: org } = await supabase.from('organisations').select('name').eq('id', organisationId).maybeSingle()
    if (org?.name) siteName = org.name
  }

  const { place, tab, sop } = await searchParams

  return (
    <ProtectedProviders role={role as AppRole}>
      <OneScreen
        siteName={siteName}
        userEmail={userEmail}
        initialPlace={typeof place === 'string' ? place : null}
        initialTab={typeof tab === 'string' ? tab : null}
        initialSop={typeof sop === 'string' && UUID.test(sop) ? sop : null}
      />
    </ProtectedProviders>
  )
}
