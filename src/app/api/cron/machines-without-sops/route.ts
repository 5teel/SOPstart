import type { NextRequest } from 'next/server'
import { handleCron } from '@/lib/cron/route'
import { runMachinesWithoutSopsSweep } from '@/lib/cron/sweeps'

export const dynamic = 'force-dynamic'

/** Phase 60 (A-08, D-05): daily agent-raised new-SOP requests for machines with no SOP. Bearer CRON_SECRET, POST only. */
export async function POST(request: NextRequest) {
  return handleCron(request, (organisationId) => runMachinesWithoutSopsSweep({ organisationId }))
}
