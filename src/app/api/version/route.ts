import { NextResponse } from 'next/server'

/**
 * Public, cookie-less build identity for the deployed-site eval runner
 * (scripts/run-evals.mjs polls this until Railway serves the commit under test).
 * Railway injects RAILWAY_GIT_COMMIT_SHA at build time; locally it is null.
 * Exempted from the session middleware in src/lib/supabase/middleware.ts.
 */
export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json({ sha: process.env.RAILWAY_GIT_COMMIT_SHA ?? null }, { headers: { 'cache-control': 'no-store' } })
}
