import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { JOURNEYS } from '@/lib/journeys/journeys'
import { listAppRoutes } from '@/lib/journeys/routes'
import { PathwaysClient } from './PathwaysClient'

export const metadata: Metadata = {
  title: 'User Pathways',
}

export default async function PathwaysPage() {
  const { userId } = await getSessionContext()
  if (!userId) redirect('/login')

  const routes = listAppRoutes()

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 lg:px-8 lg:py-10">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="pill">UX · PATHWAYS</span>
        </div>
        <h1 className="mono text-2xl font-semibold text-[var(--ink-900)]">User Pathways</h1>
        <p className="text-sm text-[var(--ink-500)] mt-2 max-w-2xl">
          Every workflow a person can take through SafeStart, as it works today. Use it to
          sanity-check the real flows against what people actually need. This map is generated
          from a single source of truth, and the screen list is read live from the app — so it
          stays current as the product changes.
        </p>
      </div>
      <PathwaysClient journeys={JOURNEYS} routes={routes} />
    </div>
  )
}
