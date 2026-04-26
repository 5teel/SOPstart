'use client'
import { createContext, type ReactNode } from 'react'

export interface SopBlockCtx {
  sopId: string
  sectionId?: string
  stepId?: string
  completionId?: string
}

export const SopBlockContext = createContext<SopBlockCtx | null>(null)

export function SopBlockProvider({
  value,
  children,
}: {
  value: SopBlockCtx
  children: ReactNode
}) {
  return <SopBlockContext.Provider value={value}>{children}</SopBlockContext.Provider>
}
