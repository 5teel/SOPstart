import type { ReactNode } from 'react'
import { PRODUCT_NAME } from '@/lib/constants'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-steel-900 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-brand-yellow tracking-tight">
            {PRODUCT_NAME}
          </h1>
          <p className="mt-1 text-steel-400 text-sm">Step-by-step SOP guidance for your team</p>
        </div>
        {children}
      </div>
    </div>
  )
}
