'use client'
import { createContext, useContext, type ReactNode } from 'react'

export type AppRole = 'admin' | 'safety_manager' | 'supervisor' | 'worker' | null

const RoleContext = createContext<AppRole>(null)

/**
 * Supplies the current member's org role to client components beneath the
 * protected layout. The role is resolved server-side in the layout and passed
 * down here so client surfaces (e.g. the worker SOP view) can offer deliberate
 * "off path" admin affordances without re-fetching.
 */
export function RoleProvider({ role, children }: { role: AppRole; children: ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>
}

export function useRole(): AppRole {
  return useContext(RoleContext)
}

/** True for roles that may enter admin pathways (mirrors the server-side admin gate). */
export function useIsAdmin(): boolean {
  const role = useContext(RoleContext)
  return role === 'admin' || role === 'safety_manager'
}
