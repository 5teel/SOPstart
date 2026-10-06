import type { NextRequest } from 'next/server'
import { handleCron } from '@/lib/cron/route'
import { runReviewDueSweep } from '@/lib/cron/sweeps'

export const dynamic = 'force-dynamic'

/** Phase 60 (A-08, D-08 trigger 2): daily owner review-due notifications. Bearer CRON_SECRET, POST only. */
export async function POST(request: NextRequest) {
  return handleCron(request, (organisationId) => runReviewDueSweep({ organisationId }))
}
