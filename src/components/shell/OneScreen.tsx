'use client'

/**
 * The one screen's role fork. Admins get the lazy AdminShell chunk; everyone
 * else gets the worker shell in the page bundle. AdminShell is referenced only
 * inside this dynamic import (ssr off, same idiom as SiteEditorLoader).
 */
import dynamic from 'next/dynamic'
import { useIsAdmin } from '@/components/providers/RoleProvider'
import { WorkerShell, type ShellProps } from '@/components/shell/WorkerShell'

const AdminShell = dynamic(() => import('@/components/shell/AdminShell').then((m) => m.AdminShell), {
  ssr: false,
  loading: () => (
    <div data-testid="shell-loading" className="grid min-h-dvh place-items-center bg-paper text-ui text-ink-500">
      Loading the site…
    </div>
  ),
})

export function OneScreen(props: ShellProps) {
  const isAdmin = useIsAdmin()
  return isAdmin ? <AdminShell {...props} /> : <WorkerShell {...props} />
}
