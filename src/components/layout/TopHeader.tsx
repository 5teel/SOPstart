'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from '@/actions/auth'
import { NotificationBadge } from '@/components/layout/NotificationBadge'
import { PRODUCT_NAME } from '@/lib/constants'

function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M16 2 L28 6 L28 15 C28 22 22 28 16 30 C10 28 4 22 4 15 L4 6 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontFamily="ui-monospace, monospace"
        fontSize="13"
        fontWeight="700"
        fill="currentColor"
      >
        S
      </text>
    </svg>
  )
}

function MenuIcon({ className }: { className?: string }) {
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
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
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

function SignOutIcon({ className }: { className?: string }) {
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
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

type Role = 'admin' | 'safety_manager' | 'supervisor' | 'worker' | null

interface NavLink {
  label: string
  href: string
}

function linksForRole(role: Role): NavLink[] {
  if (role === 'admin' || role === 'safety_manager' || role === 'supervisor') {
    return [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'SOPs', href: '/admin/sops' },
      { label: 'Blocks', href: '/admin/blocks' },
      { label: 'Team', href: '/admin/team' },
      { label: 'Activity', href: '/activity' },
      { label: 'Pathways', href: '/pathways' },
      { label: 'Feedback', href: '/uat' },
    ]
  }
  return [
    { label: 'Home', href: '/dashboard' },
    { label: 'SOPs', href: '/sops' },
    { label: 'Activity', href: '/activity' },
    { label: 'Pathways', href: '/pathways' },
    { label: 'Feedback', href: '/uat' },
  ]
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/'
  return pathname === href || pathname.startsWith(href + '/')
}

export interface TopHeaderProps {
  role: Role
  userEmail: string | null
}

export function TopHeader({ role, userEmail }: TopHeaderProps) {
  const pathname = usePathname()
  const links = linksForRole(role)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [menuOpen])

  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : '??'

  return (
    <header
      role="banner"
      className="top-header flex-shrink-0 border-b border-[var(--ink-100)] bg-[var(--paper)] pt-[env(safe-area-inset-top)]"
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--ink-700)] hover:bg-[var(--paper-2)] focus-visible:outline-2 focus-visible:outline-[var(--ink-900)] focus-visible:outline-offset-2"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          aria-controls="top-header-drawer"
        >
          <MenuIcon className="h-5 w-5" />
        </button>

        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-[var(--ink-900)] focus-visible:outline-offset-2 rounded-sm"
          aria-label={`${PRODUCT_NAME} — home`}
        >
          <BrandMark className="h-7 w-7" />
          <span className="mono text-base font-semibold tracking-tight">
            {PRODUCT_NAME}
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden md:flex flex-1 items-center gap-1 ml-4"
        >
          {links.map((link) => {
            const active = isActive(pathname, link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className="tab"
                data-active={active ? 'true' : undefined}
                aria-current={active ? 'page' : undefined}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex-1 md:hidden" />

        <div className="flex items-center gap-1">
          <Link
            href="/sops"
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--ink-700)] hover:bg-[var(--paper-2)] focus-visible:outline-2 focus-visible:outline-[var(--ink-900)] focus-visible:outline-offset-2"
            aria-label="Notifications"
          >
            <NotificationBadge />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
          </Link>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--ink-300)] bg-white mono text-xs font-semibold text-[var(--ink-900)] hover:border-[var(--ink-900)] focus-visible:outline-2 focus-visible:outline-[var(--ink-900)] focus-visible:outline-offset-2"
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {initials}
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-56 rounded-md border border-[var(--ink-200)] bg-white shadow-lg z-50"
              >
                {userEmail && (
                  <div className="px-3 py-2 border-b border-[var(--ink-100)]">
                    <p className="mono text-[10px] uppercase tracking-wider text-[var(--ink-500)]">
                      Signed in as
                    </p>
                    <p className="text-sm text-[var(--ink-900)] truncate" title={userEmail}>
                      {userEmail}
                    </p>
                  </div>
                )}
                <Link
                  href="/profile"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--ink-900)] hover:bg-[var(--paper-2)]"
                >
                  <UserIcon className="h-4 w-4" />
                  Profile
                </Link>
                <form action={signOut}>
                  <button
                    type="submit"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--ink-900)] hover:bg-[var(--paper-2)] border-t border-[var(--ink-100)]"
                  >
                    <SignOutIcon className="h-4 w-4" />
                    Sign out
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          id="top-header-drawer"
        >
          <div
            className="absolute inset-0 bg-[var(--ink-900)]/40"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[80vw] bg-[var(--paper)] border-r border-[var(--ink-200)] flex flex-col">
            <div className="flex h-14 items-center justify-between px-4 border-b border-[var(--ink-100)]">
              <div className="flex items-center gap-2 text-[var(--ink-900)]">
                <BrandMark className="h-6 w-6" />
                <span className="mono text-base font-semibold">
                  {PRODUCT_NAME}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--ink-700)] hover:bg-[var(--paper-2)] focus-visible:outline-2 focus-visible:outline-[var(--ink-900)] focus-visible:outline-offset-2"
                aria-label="Close navigation"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="Primary mobile" className="flex flex-col p-2 gap-1">
              {links.map((link) => {
                const active = isActive(pathname, link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setDrawerOpen(false)}
                    className={[
                      'flex items-center px-3 py-3 rounded-md text-sm font-medium',
                      'min-h-[var(--min-tap-target)]',
                      active
                        ? 'bg-[var(--paper-2)] text-[var(--ink-900)]'
                        : 'text-[var(--ink-700)] hover:bg-[var(--paper-2)] hover:text-[var(--ink-900)]',
                    ].join(' ')}
                    aria-current={active ? 'page' : undefined}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}
