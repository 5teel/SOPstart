import type { Metadata } from 'next'
import JoinByCodeForm from '@/components/auth/JoinByCodeForm'

export const metadata: Metadata = {
  title: 'Join an organisation',
}

export default function JoinPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-steel-100 mb-2 text-center">
        Join an organisation
      </h2>
      <p className="text-steel-400 text-sm text-center mb-6">
        Enter the invite code provided by your admin
      </p>
      <JoinByCodeForm />
    </div>
  )
}
