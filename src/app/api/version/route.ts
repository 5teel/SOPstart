import { NextResponse } from 'next/server'

/**
 * Public, cookie-less build identity for the deployed-site eval runner
 * (scripts/run-evals.mjs polls this until the host serves the commit under test).
 * Fly.io: GIT_SHA from the image build (Dockerfile); Railway: RAILWAY_GIT_COMMIT_SHA; locally null.
 * Exempted from the session middleware in src/lib/supabase/middleware.ts.
 */
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ sha: process.env.GIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || null }, { headers: { 'cache-control': 'no-store' } })
}
