import type { Metadata } from 'next'
import OrgSignUpForm from '@/components/auth/OrgSignUpForm'

export const metadata: Metadata = {
  title: 'Register your organisation',
}

export default function SignUpPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-steel-100 mb-6 text-center">
        Register your organisation
      </h2>
      <OrgSignUpForm />
    </div>
  )
}
