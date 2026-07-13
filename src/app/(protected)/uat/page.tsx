import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/auth/session-context'
import { UAT_TESTS } from '@/lib/uat/tests'
import { listOrgFeedback } from '@/actions/uat'
import { UatBoardClient } from './UatBoardClient'

export const metadata: Metadata = {
  title: 'UAT & Design Feedback',
}

export default async function UatPage() {
  const { userId } = await getSessionContext()
  if (!userId) redirect('/login')

  const feedback = await listOrgFeedback()

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 lg:px-8 lg:py-10">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="pill">UAT · TEAM FEEDBACK</span>
        </div>
        <h1 className="mono text-2xl font-semibold text-[var(--ink-900)]">
          Your feedback
        </h1>
        <p className="text-sm text-[var(--ink-500)] mt-2 max-w-2xl">
          Help us choose how SafeStart should look and work. Have a look at each one,
          answer a couple of quick questions, and tell us what you think — there are no
          wrong answers, and your honest take is exactly what we need.
        </p>
      </div>

      <UatBoardClient
        tests={UAT_TESTS}
        feedback={feedback}
        currentUserId={userId}
      />
    </div>
  )
}
