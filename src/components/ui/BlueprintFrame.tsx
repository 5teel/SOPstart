import type { ReactNode } from 'react'

export interface BlueprintFrameProps {
  children: ReactNode
  className?: string
  asSection?: boolean
}

export function BlueprintFrame({ children, className = '', asSection = false }: BlueprintFrameProps) {
  const Tag = asSection ? 'section' : 'div'
  return <Tag className={`blueprint-frame ${className}`}>{children}</Tag>
}
