import type { Metadata } from 'next'
import LoginForm from '@/components/auth/LoginForm'

export const metadata: Metadata = {
  title: 'Log In',
}

export default function LoginPage() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-steel-100 mb-6 text-center">
        Log in to your account
      </h2>
      <LoginForm />
    </div>
  )
}
