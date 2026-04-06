import type { Metadata } from 'next'
import LoginForm from '@/components/auth/LoginForm'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Log In',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>
}) {
  const params = await searchParams
  const justRegistered = params.registered === '1'

  return (
    <div>
      {justRegistered && (
        <div className="rounded-lg bg-green-900/40 border border-green-700 px-4 py-3 text-sm text-green-300 mb-6 text-center">
          Account created successfully. Log in to get started.
        </div>
      )}

      <h2 className="text-xl font-semibold text-steel-100 mb-6 text-center">
        Log in to your account
      </h2>
      <LoginForm />

      {/* Prominent join card below the form */}
      <div className="mt-6 rounded-xl border border-steel-700 bg-steel-800 p-4 text-center">
        <p className="text-sm font-semibold text-steel-100 mb-1">
          Been given an invite code?
        </p>
        <p className="text-xs text-steel-400 mb-3">
          Your admin will have shared a code like ACME-1234
        </p>
        <Link
          href="/join"
          className="inline-flex items-center justify-center h-[44px] px-6 bg-steel-700 text-brand-yellow font-semibold text-sm rounded-lg hover:bg-steel-600 transition-colors border border-brand-yellow/30"
        >
          Join with invite code
        </Link>
      </div>
    </div>
  )
}
