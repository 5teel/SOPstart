'use client'

/**
 * The admin one screen -- a lazy seam. It is reached only through the
 * next/dynamic import in OneScreen, and it is lazy from the very first bundle
 * measurement on purpose: the admin module must never ride in the worker
 * bundle, and a baseline recorded before the seam existed would hide the
 * moment it did (CLAUDE.md 2026-09-13). Until plan 57-05 fills this file it
 * renders the worker view, so admins already get a working screen.
 */
import { WorkerShell, type ShellProps } from '@/components/shell/WorkerShell'

export function AdminShell(props: ShellProps) {
  return <WorkerShell {...props} />
}
