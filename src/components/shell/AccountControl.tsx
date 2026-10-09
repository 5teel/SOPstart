'use client'

/**
 * Quiet account control at the foot of the list pane (D-15b): who you are,
 * your profile, sign out -- an account menu, not a navigation bar. Admins also
 * get the two maps (Pathways, Feedback).
 */
import Link from 'next/link'
import { signOut } from '@/actions/auth'

const LINK = 'flex min-h-tap items-center rounded px-2 text-meta text-ink-600 hover:text-ink-900'

export function AccountControl({ email, isAdmin }: { email: string | null; isAdmin: boolean }) {
  return (
    <div data-testid="shell-account" className="flex flex-col gap-0.5 border-t border-ink-200 p-2">
      {email && <p className="mono truncate px-2 text-meta text-ink-600">{email}</p>}
      <div className="flex flex-wrap items-center gap-x-1">
        <Link href="/profile" className={LINK}>
          Profile
        </Link>
        {isAdmin && (
          <>
            <Link href="/pathways" className={LINK}>
              Pathways
            </Link>
            <Link href="/uat" className={LINK}>
              Feedback
            </Link>
          </>
        )}
        <form action={signOut} className="ml-auto">
          <button type="submit" data-testid="shell-sign-out" className={LINK}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
