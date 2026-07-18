'use client'

/**
 * Phase 32-09 — thin client wrapper mounting WiringPatchBay from the async
 * Server Component `/admin/sops` page. Same class of fix as 32-07's
 * TeamViewShell: an async page.tsx can fetch listOrgTree()/listGrants()/
 * collections server-side but cannot hold a client onWireUpComplete callback
 * (router.refresh()) itself — that requires a 'use client' boundary.
 */

import { useRouter } from 'next/navigation'
import { WiringPatchBay, type WiringCollection, type WiringNewSop } from './WiringPatchBay'
import type { AccessGrant, OrgTree } from '@/types/org-model'

export interface WiringPatchBayShellProps {
  tree: OrgTree
  orgName?: string
  collections: WiringCollection[]
  grants: AccessGrant[]
  newSop?: WiringNewSop | null
  /** WR-03: dept id -> member ids from the Phase 25 member_departments junction. */
  deptMembers?: Record<string, string[]>
}

export function WiringPatchBayShell({ tree, orgName, collections, grants, newSop, deptMembers }: WiringPatchBayShellProps) {
  const router = useRouter()
  return (
    <WiringPatchBay
      tree={tree}
      orgName={orgName}
      collections={collections}
      grants={grants}
      newSop={newSop}
      deptMembers={deptMembers}
      onWireUpComplete={() => router.refresh()}
    />
  )
}
