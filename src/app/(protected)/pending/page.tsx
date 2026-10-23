import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { signOut } from '@/actions/auth'
import { getSessionContext } from '@/lib/auth/session-context'
import { pausedMemberships } from '@/lib/auth/paused'
import { ENQUIRIES_EMAIL } from '@/lib/contact'
import { CheckAgain } from './CheckAgain'

export const metadata: Metadata = {
  title: 'Account pending',
}

/**
 * /pending — holding screen for a signed-in account that cannot open a site yet (UX-01):
 * waiting for a platform admin's approval (ADR-0018), turned down, paused (suspended or left, ADR-0024),
 * or approved with no site.
 */
export default async function PendingPage() {
  const { supabase, userId, role } = await getSessionContext()
  if (!userId) redirect('/login')
  if (role) redirect('/')
  // RLS: the account reads only its own row.
  // user_approvals (00081) postdates database.types.ts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from('user_approvals').select('status').eq('user_id', userId).maybeSingle()
  const approval = (data as { status?: string } | null)?.status ?? 'pending'
  // A suspended or departed person (Phase 64) is an approved account with no active site.
  const paused = approval === 'approved' ? await pausedMemberships(userId) : []
  const names = [...new Set(paused.map((p) => p.organisationName))]
  const siteWords = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]
  const status = paused.length > 0 ? 'paused' : approval

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 lg:py-10">
      <div data-testid="pending" data-status={status} className="blueprint-frame max-w-md">
        {status === 'pending' && (
          <>
            <h1 className="text-xl font-semibold text-ink-900">Waiting for approval</h1>
            <p className="mt-2 text-reading text-ink-700">
              SOPstart checks every new account before it opens. You can sign in once it is approved.
            </p>
            <CheckAgain />
          </>
        )}
        {status === 'declined' && (
          <>
            <h1 className="text-xl font-semibold text-ink-900">Account not approved</h1>
            <p className="mt-2 text-reading text-ink-700">This account has not been approved for SOPstart.</p>
          </>
        )}
        {status === 'paused' && (
          <>
            <h1 className="text-xl font-semibold text-ink-900">Access paused</h1>
            <p className="mt-2 text-reading text-ink-700">Your access to {siteWords} has been paused. Talk to your supervisor.</p>
          </>
        )}
        {status === 'approved' && (
          <p className="text-reading text-ink-700">Your account is being set up. Ask your admin if you have access issues.</p>
        )}
        <p className="mt-4 text-ui text-ink-500">
          Questions?{' '}
          <a href={`mailto:${ENQUIRIES_EMAIL}`} className="font-semibold text-ink-900 underline">
            {ENQUIRIES_EMAIL}
          </a>
        </p>
        <form action={signOut} className="mt-4">
          <button
            type="submit"
            data-testid="pending-sign-out"
            className="min-h-tap rounded-lg border border-ink-200 px-4 text-ui text-ink-700"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
