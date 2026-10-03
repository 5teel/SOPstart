import type { Metadata } from 'next'
import LoginForm from '@/components/auth/LoginForm'
import Link from 'next/link'
import { safeNextPath } from '@/lib/auth/next-redirect'

export const metadata: Metadata = {
  title: 'Log In',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams
  const next = safeNextPath(params.next) ?? undefined

  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--ink-900)] mb-6 text-center">
        Log in to your account
      </h2>
      <LoginForm next={next} />

      {/* Prominent join card below the form */}
      <div className="mt-6 rounded-lg border border-[var(--ink-100)] bg-white p-4 text-center">
        <p className="text-sm font-semibold text-[var(--ink-900)] mb-1">
          Been given an invite code?
        </p>
        <p className="text-xs text-[var(--ink-500)] mb-3">
          Your admin will have shared a code like ACME-1234
        </p>
        <Link
          href="/join"
          className="inline-flex items-center justify-center h-tap px-6 bg-[var(--paper-2)] text-[var(--ink-900)] font-semibold text-sm rounded-lg hover:bg-[var(--ink-300)] transition-colors border border-[var(--ink-900)]/30"
        >
          Join with invite code
        </Link>
      </div>
    </div>
  )
}
