import type { ReactNode } from 'react'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { RoleProvider, type AppRole } from '@/components/providers/RoleProvider'

export type { AppRole }

/** The two providers every signed-in screen needs, in one place. */
export function ProtectedProviders({ role, children }: { role: AppRole; children: ReactNode }) {
  return (
    <QueryProvider>
      <RoleProvider role={role}>{children}</RoleProvider>
    </QueryProvider>
  )
}
