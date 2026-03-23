'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSearchParams } from 'next/navigation'
import { acceptInviteSchema, type AcceptInviteInput } from '@/lib/validators/auth'
import { acceptInvite } from '@/actions/auth'

export default function InviteAcceptForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token_hash') ?? searchParams.get('token') ?? ''
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<AcceptInviteInput>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { token },
  })

  useEffect(() => {
    setValue('token', token)
  }, [token, setValue])

  const onSubmit = async (data: AcceptInviteInput) => {
    setIsSubmitting(true)
    setServerError(null)
    try {
      const result = await acceptInvite(data)
      if (result?.error) {
        setServerError(result.error)
      }
    } catch {
      // redirect() throws — expected on success
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!token) {
    return (
      <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-6 text-center">
        <p className="text-red-300 font-medium">Invalid invite link</p>
        <p className="text-red-400 text-sm mt-1">
          This invite link is missing required information. Please ask your admin to send a new invite.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Hidden token field */}
      <input type="hidden" {...register('token')} />

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-steel-100 mb-1">
          Set Your Password
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
        {isSubmitting ? 'Setting up your account...' : 'Accept Invitation'}
      </button>
    </form>
  )
}
