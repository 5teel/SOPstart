'use client'

/**
 * Quiet account control at the foot of the menu (D-15b): who you are and where,
 * then one link per row -- an account menu, not a navigation bar. Admins also get
 * the two maps (Pathways, Feedback). Sign out is last and separated.
 */
import Link from 'next/link'
import { signOut } from '@/actions/auth'

const LINK = 'flex min-h-tap w-full items-center rounded-lg px-2 text-left text-ui text-ink-700 hover:bg-paper-2 hover:text-ink-900'

export function AccountControl({ email, isAdmin, org }: { email: string | null; isAdmin: boolean; org?: string }) {
  return (
    <div data-testid="shell-account" className="flex flex-col border-t border-ink-200 p-2">
      {(email || org) && (
        <div className="min-w-0 px-2 pb-2 pt-1">
          {email && <p className="truncate text-ui font-semibold text-ink-900">{email}</p>}
          {org && (
            <p data-testid="home-org" className="mono truncate text-meta text-ink-600">
              {org}
            </p>
          )}
        </div>
      )}
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
      <form action={signOut} className="mt-1 border-t border-ink-200 pt-1">
        <button type="submit" data-testid="shell-sign-out" className={LINK}>
          Sign out
        </button>
      </form>
    </div>
  )
}
