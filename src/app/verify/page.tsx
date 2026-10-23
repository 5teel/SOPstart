import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Wordmark } from '@/components/brand/Wordmark'
import { VerifyForm } from '@/components/auth/VerifyForm'
import { getSessionContext } from '@/lib/auth/session-context'
import { isElevatedRole } from '@/lib/auth/elevated'
import { safeNextPath } from '@/lib/auth/next-redirect'

export const metadata: Metadata = { title: "Confirm it's you" }

/**
 * Phase 66 / ADR-0028: where an admin or safety manager proves the second step. The server
 * decides the state (set up, or enter a code) and sends an aal2 session on to the validated
 * `next`: a server redirect, never a client effect (CLAUDE.md 2026-09-29).
 */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { supabase, userId, memberRole, aal } = await getSessionContext()
  if (!userId) redirect('/login')
  const next = safeNextPath((await searchParams).next) ?? '/'
  if (aal === 'aal2') redirect(next)

  const { data } = await supabase.auth.mfa.listFactors()
  const factor = data?.totp.find((f) => f.status === 'verified') ?? null

  return (
    <div className="min-h-dvh bg-paper flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Wordmark size="hero" />
        </div>
        <VerifyForm mode={factor ? 'challenge' : 'enrol'} factorId={factor?.id ?? null} next={next} elevated={isElevatedRole(memberRole)} />
      </div>
    </div>
  )
}
