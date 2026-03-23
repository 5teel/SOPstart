import type { Metadata } from 'next'
import { Suspense } from 'react'
import InviteAcceptForm from '@/components/auth/InviteAcceptForm'

export const metadata: Metadata = {
  title: 'Accept your invitation',
}

export default function InviteAcceptPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-steel-100 mb-2 text-center">
        Accept your invitation
      </h2>
      <p className="text-steel-400 text-sm text-center mb-6">
        Set a password to complete your account setup
      </p>
      <Suspense fallback={<div className="text-steel-400 text-center py-4">Loading...</div>}>
        <InviteAcceptForm />
      </Suspense>
    </div>
  )
}
