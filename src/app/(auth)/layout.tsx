import type { ReactNode } from 'react'
import { Wordmark } from '@/components/brand/Wordmark'
import { RouteTransition } from '@/components/layout/RouteTransition'
import { Enquiries } from '@/components/contact/Enquiries'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1>
            <Wordmark size="hero" />
          </h1>
          <p className="mt-3 text-ink-500 text-sm">Step-by-step SOP guidance for your team</p>
        </div>
        <RouteTransition>{children}</RouteTransition>
        <div className="mt-8 text-center text-ui text-ink-500">
          New to SOPstart?{' '}
          <Enquiries className="font-semibold text-ink-900 underline" />
        </div>
      </div>
    </div>
  )
}
