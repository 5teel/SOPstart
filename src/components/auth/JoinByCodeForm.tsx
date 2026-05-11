'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { inviteCodeSchema, type InviteCodeInput } from '@/lib/validators/auth'
import { joinWithInviteCode } from '@/actions/auth'

export default function JoinByCodeForm() {
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteCodeInput>({
    resolver: zodResolver(inviteCodeSchema),
  })

  const onSubmit = async (data: InviteCodeInput) => {
    setIsSubmitting(true)
    setServerError(null)
    try {
      const result = await joinWithInviteCode(data)
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
        <label htmlFor="code" className="block text-sm font-medium text-[var(--ink-900)] mb-1">
          Invite Code
        </label>
        <input
          id="code"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          placeholder="e.g. ACME-1234"
          {...register('code')}
          className="w-full px-4 py-3 rounded-lg bg-white border border-[var(--ink-100)] text-[var(--ink-900)] placeholder-[var(--ink-500)] focus:outline-none focus:ring-2 focus:ring-[var(--ink-900)] focus:border-transparent text-base uppercase tracking-widest"
        />
        {errors.code && (
          <p className="mt-1 text-sm text-red-400">{errors.code.message}</p>
        )}
      </div>

      {serverError && (
        <div className="rounded-lg bg-red-900/40 border border-red-700 px-4 py-3 text-sm text-red-300">
          {serverError === 'You are already a member of an organisation.'
            ? 'You are already part of an organisation. Log in to continue.'
            : serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full min-h-[var(--min-tap-target)] bg-[var(--ink-900)] hover:bg-[var(--accent-voice)] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-lg text-base transition-colors"
      >
        {isSubmitting ? 'Joining...' : 'Join Organisation'}
      </button>

      <div className="text-center space-y-2 pt-2">
        <p className="text-[var(--ink-500)] text-sm">
          Registering a new org instead?{' '}
          <Link href="/sign-up" className="text-[var(--ink-900)] hover:text-[var(--accent-voice)] font-medium">
            Sign up
          </Link>
        </p>
        <p className="text-[var(--ink-500)] text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-[var(--ink-900)] hover:text-[var(--accent-voice)] font-medium">
            Log in
          </Link>
        </p>
      </div>
    </form>
  )
}
