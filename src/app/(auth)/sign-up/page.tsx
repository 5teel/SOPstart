import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'SOPstart is by invitation',
}

export default function SignUpPage() {
  return (
    <div className="text-center">
      <h2 className="text-xl font-semibold text-[var(--ink-900)] mb-3">
        SOPstart is by invitation
      </h2>
      <p className="text-sm text-[var(--ink-500)] mb-6">
        Ask your admin to invite you. Already invited? Open the link in your invitation email.
      </p>
      <div className="space-y-2">
        <p className="text-[var(--ink-500)] text-sm">
          <Link href="/login" className="text-[var(--ink-900)] hover:text-[var(--accent-voice)] font-medium">
            Log in
          </Link>
        </p>
        <p className="text-[var(--ink-500)] text-sm">
          <Link href="/join" className="text-[var(--ink-900)] hover:text-[var(--accent-voice)] font-medium">
            I have an invite code
          </Link>
        </p>
      </div>
    </div>
  )
}
