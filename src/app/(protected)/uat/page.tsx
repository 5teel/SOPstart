import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UAT_TESTS } from '@/lib/uat/tests'
import { listOrgFeedback } from '@/actions/uat'
import { UatBoardClient } from './UatBoardClient'

export const metadata: Metadata = {
  title: 'UAT & Design Feedback',
}

export default async function UatPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const feedback = await listOrgFeedback()

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 lg:px-8 lg:py-10">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="pill">UAT · TEAM FEEDBACK</span>
        </div>
        <h1 className="mono text-2xl font-semibold text-[var(--ink-900)]">
          Test &amp; Design Feedback
        </h1>
        <p className="text-sm text-[var(--ink-500)] mt-2 max-w-2xl">
          Review the directions below, tick how each criterion lands, and leave notes.
          Your input is saved per test and shared with the team — an AI agent reads it back
          to record and analyse where everyone landed.
        </p>
      </div>

      <UatBoardClient
        tests={UAT_TESTS}
        feedback={feedback}
        currentUserId={user.id}
      />
    </div>
  )
}
