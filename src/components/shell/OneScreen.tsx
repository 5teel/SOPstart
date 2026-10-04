'use client'

/**
 * The one screen's role fork. Admins get the lazy AdminShell chunk; everyone
 * else gets the worker shell in the page bundle. AdminShell is referenced only
 * inside this dynamic import (ssr off, same idiom as SiteEditorLoader).
 */
import dynamic from 'next/dynamic'
import { useIsAdmin } from '@/components/providers/RoleProvider'
import type { ShellProps } from '@/components/shell/WorkerShell'

const SHELL_LOADING = () => (
  <div data-testid="shell-loading" className="grid min-h-dvh place-items-center bg-paper text-ui text-ink-500">
    Loading the site…
  </div>
)

// The worker shell is split off the root page's own chunk too. The bundle
// check charges every route for the client modules the root page pulls in, so
// the shell rides in a chunk of its own (server-rendered, preloaded with the
// page) instead of inflating the First Load of /sops and /sops/[sopId].
const WorkerShell = dynamic(() => import('@/components/shell/WorkerShell').then((m) => m.WorkerShell), {
  loading: SHELL_LOADING,
})

const AdminShell = dynamic(() => import('@/components/shell/AdminShell').then((m) => m.AdminShell), {
  ssr: false,
  loading: SHELL_LOADING,
})

export function OneScreen(props: ShellProps) {
  const isAdmin = useIsAdmin()
  return isAdmin ? <AdminShell {...props} /> : <WorkerShell {...props} />
}
