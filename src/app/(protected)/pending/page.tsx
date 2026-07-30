import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Account pending',
}

/**
 * /pending — holding screen for authenticated users with no org role yet
 * (UX-01). JSX relocated verbatim from the old dashboard PendingDashboard.
 */
export default function PendingPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 lg:py-10">
      <div className="blueprint-frame max-w-md">
        <p className="mono text-[11px] text-[var(--ink-500)] uppercase tracking-wider mb-1">
          ACCOUNT PENDING
        </p>
        <p className="text-sm text-[var(--ink-700)]">
          Your account is being set up. Ask your admin if you have access issues.
        </p>
      </div>
    </div>
  )
}
