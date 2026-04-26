'use client'
import type { ReactNode } from 'react'

export interface TabNavItem {
  id: string
  label: string
  icon?: ReactNode
}

export interface TabNavProps {
  tabs: TabNavItem[]
  activeId: string
  onChange: (id: string) => void
  className?: string
  ariaLabel?: string
}

export function TabNav({ tabs, activeId, onChange, className = '', ariaLabel = 'Tabs' }: TabNavProps) {
  return (
    <nav
      role="tablist"
      aria-label={ariaLabel}
      className={`flex overflow-x-auto gap-1 border-b border-[var(--ink-100)] ${className}`}
    >
      {tabs.map((t) => {
        const active = t.id === activeId
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            data-active={active}
            onClick={() => onChange(t.id)}
            className="tab flex-shrink-0"
          >
            {t.icon}
            {t.label}
          </button>
        )
      })}
    </nav>
  )
}
