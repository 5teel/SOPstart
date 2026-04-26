import type { ReactNode } from 'react'

export interface BlueprintCanvasProps {
  children: ReactNode
  className?: string
  /** When true, removes the max-width clamp (use for full-bleed Flow tab). */
  fullBleed?: boolean
}

export function BlueprintCanvas({ children, className = '', fullBleed = false }: BlueprintCanvasProps) {
  const inner = fullBleed ? 'w-full px-4 py-6' : 'max-w-3xl mx-auto px-4 py-6'
  return (
    <div className={`bg-grid ${className}`}>
      <div className={inner}>{children}</div>
    </div>
  )
}
