import Link from 'next/link'
import { redirect } from 'next/navigation'
import { PRODUCT_NAME, PRODUCT_DESCRIPTION } from '@/lib/constants'
import { getSessionContext } from '@/lib/auth/session-context'
import { ProtectedProviders, type AppRole } from '@/components/providers/ProtectedProviders'
import { OneScreen } from '@/components/shell/OneScreen'

function Landing() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper p-8">
      <h1 className="text-4xl font-bold text-[var(--ink-900)] mb-4">{PRODUCT_NAME}</h1>
      <p className="text-[var(--ink-500)] text-lg mb-8">{PRODUCT_DESCRIPTION}</p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="bg-[var(--ink-900)] text-white font-semibold px-6 py-3 rounded-lg min-h-tap-row flex items-center hover:opacity-90 transition-opacity"
        >
          Log In
        </Link>
      </div>
    </main>
  )
}

/**
 * `/` is the landing for a visitor and the one screen for a signed-in member.
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

  if (!userId) return <Landing />
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
