import Link from 'next/link'
import { PRODUCT_NAME, PRODUCT_DESCRIPTION } from '@/lib/constants'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper p-8">
      <h1 className="text-4xl font-bold text-[var(--ink-900)] mb-4">{PRODUCT_NAME}</h1>
      <p className="text-[var(--ink-500)] text-lg mb-8">{PRODUCT_DESCRIPTION}</p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="bg-[var(--ink-900)] text-white font-semibold px-6 py-3 rounded-lg min-h-[var(--min-tap-target)] flex items-center hover:opacity-90 transition-opacity"
        >
          Log In
        </Link>
        <Link
          href="/sign-up"
          className="bg-white text-[var(--ink-900)] font-semibold px-6 py-3 rounded-lg min-h-[var(--min-tap-target)] flex items-center border border-[var(--ink-100)] hover:border-[var(--ink-900)] transition-colors"
        >
          Sign Up
        </Link>
      </div>
    </main>
  )
}
