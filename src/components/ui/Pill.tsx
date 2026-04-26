import type { ReactNode } from 'react'

type Accent = 'measure' | 'decision' | 'escalate' | 'signoff' | 'inspect' | 'zone' | 'voice'

export interface PillProps {
  children: ReactNode
  variant?: 'default' | 'accent'
  accent?: Accent
  className?: string
}

export function Pill({ children, variant = 'default', accent, className = '' }: PillProps) {
  if (variant === 'accent' && accent) {
    const color = `var(--accent-${accent})`
    return (
      <span
        className={`pill ${className}`}
        style={{ borderColor: color, color }}
      >
        {children}
      </span>
    )
  }
  return <span className={`pill ${className}`}>{children}</span>
}
