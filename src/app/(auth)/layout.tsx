import type { ReactNode } from 'react'
import { Wordmark } from '@/components/brand/Wordmark'
import { RouteTransition } from '@/components/layout/RouteTransition'

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
      </div>
    </div>
  )
}
