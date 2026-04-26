import type { ReactNode } from 'react'
import { PRODUCT_NAME } from '@/lib/constants'
import { PaperThemeMount } from './_theme-mount'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PaperThemeMount />
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-ink-900 tracking-tight">
              {PRODUCT_NAME}
            </h1>
            <p className="mt-1 text-ink-500 text-sm">Step-by-step SOP guidance for your team</p>
          </div>
          {children}
        </div>
      </div>
    </>
  )
}
