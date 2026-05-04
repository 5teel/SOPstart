'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NotificationBadge } from '@/components/layout/NotificationBadge'

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

const tabs = [
  { label: 'SOPs', href: '/sops', Icon: DocumentIcon },
  { label: 'Activity', href: '/activity', Icon: ClockIcon },
  { label: 'Profile', href: '/profile', Icon: UserIcon },
]

export function BottomTabBar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main navigation"
      className="bottom-tab-bar flex-shrink-0 bg-steel-800 border-t border-steel-700 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex">
        {tabs.map(({ label, href, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={[
                'tab-link flex flex-1 flex-col items-center justify-center gap-1',
                'min-h-[var(--min-tap-target)] text-xs font-medium',
                'transition-colors duration-150',
                isActive
                  ? 'text-brand-yellow'
                  : 'text-steel-400 hover:text-steel-100',
              ].join(' ')}
              aria-current={isActive ? 'page' : undefined}
            >
              {label === 'SOPs' ? (
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  <NotificationBadge />
                </span>
              ) : (
                <Icon className="h-5 w-5" />
              )}
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
