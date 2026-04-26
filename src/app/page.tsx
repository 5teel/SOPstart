import Link from 'next/link'
import { PRODUCT_NAME, PRODUCT_DESCRIPTION } from '@/lib/constants'
import { PaperThemeMount } from './_theme-mount'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper p-8">
      <PaperThemeMount />
      <h1 className="text-4xl font-bold text-brand-yellow mb-4">{PRODUCT_NAME}</h1>
      <p className="text-steel-400 text-lg mb-8">{PRODUCT_DESCRIPTION}</p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="bg-brand-yellow text-steel-900 font-semibold px-6 py-3 rounded-lg min-h-[var(--min-tap-target)] flex items-center hover:opacity-90 transition-opacity"
        >
          Log In
        </Link>
        <Link
          href="/sign-up"
          className="bg-steel-800 text-steel-100 font-semibold px-6 py-3 rounded-lg min-h-[var(--min-tap-target)] flex items-center border border-steel-700 hover:border-brand-yellow transition-colors"
        >
          Sign Up
        </Link>
      </div>
    </main>
  )
}
