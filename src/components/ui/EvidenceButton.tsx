import type { ReactNode, MouseEventHandler } from 'react'

export interface EvidenceButtonProps {
  icon: ReactNode
  label: string
  as?: 'button' | 'a'
  href?: string
  onClick?: MouseEventHandler<HTMLElement>
  children?: ReactNode
  className?: string
}

export function EvidenceButton({
  icon, label, as = 'button', href, onClick, children, className = '',
}: EvidenceButtonProps) {
  const content = (
    <>
      <span aria-hidden="true">{icon}</span>
      <span>{children ?? label}</span>
    </>
  )
  if (as === 'a' && href) {
    return (
      <a href={href} aria-label={label} className={`evidence-btn ${className}`}>
        {content}
      </a>
    )
  }
  return (
    <button type="button" aria-label={label} onClick={onClick as MouseEventHandler<HTMLButtonElement>} className={`evidence-btn ${className}`}>
      {content}
    </button>
  )
}
