'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { loginSchema, type LoginInput } from '@/lib/validators/auth'
import { loginWithEmail } from '@/actions/auth'

export default function LoginForm() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginInput) => {
    setIsSubmitting(true)
    setServerError(null)
    try {
      const result = await loginWithEmail(data)
      if (result?.error) {
        setServerError(result.error)
      }
    } catch {
      // redirect() throws — expected on success
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-steel-100 mb-1">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@yourcompany.co.nz"
          {...register('email')}
          className="w-full px-4 py-3 rounded-lg bg-steel-800 border border-steel-700 text-steel-100 placeholder-steel-400 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-transparent text-base"
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-steel-100 mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          {...register('password')}
          className="w-full px-4 py-3 rounded-lg bg-steel-800 border border-steel-700 text-steel-100 placeholder-steel-400 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-transparent text-base"
        />
        {errors.password && (
          <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>
        )}
      </div>

      {serverError && (
        <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">
          {serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full min-h-[var(--min-tap-target)] bg-brand-yellow hover:bg-brand-orange disabled:opacity-60 disabled:cursor-not-allowed text-steel-900 font-bold rounded-lg text-base transition-colors"
      >
        {isSubmitting ? 'Logging in...' : 'Log In'}
      </button>

      <div className="text-center space-y-2 pt-2">
        <p className="text-steel-400 text-sm">
          Need an account?{' '}
          <Link href="/sign-up" className="text-brand-yellow hover:text-brand-orange font-medium">
            Register a new organisation
          </Link>
        </p>
        <p className="text-steel-400 text-sm">
          Have an invite code?{' '}
          <Link href="/join" className="text-brand-yellow hover:text-brand-orange font-medium">
            Join an organisation
          </Link>
        </p>
      </div>
    </form>
  )
}
