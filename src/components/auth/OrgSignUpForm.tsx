'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { orgSignUpSchema, type OrgSignUpInput } from '@/lib/validators/auth'
import { signUpOrganisation } from '@/actions/auth'

export default function OrgSignUpForm() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrgSignUpInput>({
    resolver: zodResolver(orgSignUpSchema),
  })

  const onSubmit = async (data: OrgSignUpInput) => {
    setIsSubmitting(true)
    setServerError(null)
    try {
      const result = await signUpOrganisation(data)
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
        <label htmlFor="organisationName" className="block text-sm font-medium text-steel-100 mb-1">
          Organisation Name
        </label>
        <input
          id="organisationName"
          type="text"
          autoComplete="organization"
          placeholder="Acme Industries Ltd"
          {...register('organisationName')}
          className="w-full px-4 py-3 rounded-lg bg-steel-800 border border-steel-700 text-steel-100 placeholder-steel-400 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-transparent text-base"
        />
        {errors.organisationName && (
          <p className="mt-1 text-sm text-red-400">{errors.organisationName.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-steel-100 mb-1">
          Email Address
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="admin@yourcompany.co.nz"
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
          autoComplete="new-password"
          placeholder="At least 8 characters"
          {...register('password')}
          className="w-full px-4 py-3 rounded-lg bg-steel-800 border border-steel-700 text-steel-100 placeholder-steel-400 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-transparent text-base"
        />
        {errors.password && (
          <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-steel-100 mb-1">
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat your password"
          {...register('confirmPassword')}
          className="w-full px-4 py-3 rounded-lg bg-steel-800 border border-steel-700 text-steel-100 placeholder-steel-400 focus:outline-none focus:ring-2 focus:ring-brand-yellow focus:border-transparent text-base"
        />
        {errors.confirmPassword && (
          <p className="mt-1 text-sm text-red-400">{errors.confirmPassword.message}</p>
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
        {isSubmitting ? 'Creating your organisation...' : 'Register Organisation'}
      </button>

      <div className="text-center space-y-2 pt-2">
        <p className="text-steel-400 text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-yellow hover:text-brand-orange font-medium">
            Log in
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
