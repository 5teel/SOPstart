import { getSessionContext } from './session-context'
import type { SessionContext } from './session-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { stepMatchesCaller, type ChainStep } from '@/lib/governance/approvals'
import type { AppRole } from '@/types/auth'

export interface AdminContext {
  supabase: SessionContext['supabase']
  user: { id: string }
  role: string
  organisationId: string | null
}

/**
 * Shared admin guard for server actions and API routes. Replaces the
 * per-file getUser() + getSession() + JWT-parse copies: getSessionContext()
 * verifies the JWT locally (ES256 JWKS — no auth round-trip) and reads the
 * member role from organisation_members, the same table the access-token
 * hook mints the user_role claim from, so the value is equal or fresher
 * than the old claim read.
 */
export async function requireAdminContext(): Promise<AdminContext | { error: string }> {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }
  return { supabase, user: { id: userId }, role, organisationId }
}

// ---------------------------------------------------------------------------
// CAP-02 — requireSopEditAccess: object-level (per-SOP) edit authorization.
//
// A1 RESOLVED (Simon, 2026-08-25): "sign-off authority" = approval-chain
// approvers (Phase 29 approval_chains/sop_approvals) — NOT sops.owner_user_id.
// A caller gains edit rights when any step of the approval chain configured
// for (their org, the SOP's category_slug) matches them via stepMatchesCaller
// (userId equality OR role equality). Accepted consequence: a SOP whose
// category has NO configured chain (or an empty steps array) has zero people
// with sign-off-derived edit rights — only admin/safety_manager can edit it;
// the SOP owner as such gains nothing. Assumption (A2) unchanged: "edit" =
// SOP content (sections, steps, images, layout_data, block junctions) only.
// Publish, verify-blocks, delete, version-supersede/clone and
// owner-reassignment stay on requireAdminContext() — this guard must never
// be swapped in there.
//
// The org filter in step 3 below is the SESSION organisationId, applied as
// .eq('organisation_id', organisationId) on the admin-client fetch — never a
// value read off the fetched SOP row. A client-supplied sopId names a row the
// caller does not yet own the right to read; trusting that row's own
// organisation_id to decide the check would let the row assert its own
// membership (CLAUDE.md 2026-07-28: an org predicate derived from a
// client-supplied id's fetched row is untrusted even when it "obviously"
// matches).
// ---------------------------------------------------------------------------

export type SopEditTarget =
  | { sopId: string }
  | { sectionId: string }
  | { junctionId: string }

export interface SopEditContext {
  supabase: SessionContext['supabase']
  user: { id: string }
  role: string
  organisationId: string
  sopId: string
  viaApproverStep: boolean
}

export async function requireSopEditAccess(
  target: SopEditTarget
): Promise<SopEditContext | { error: string }> {
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }
  if (!organisationId) return { error: 'No organisation found' }

  const admin = createAdminClient()

  // Resolve the target locator down to a sopId. One resolution path for all
  // three locator shapes — callers never write their own lookup (the sibling-
  // caller-miss class in CLAUDE.md 2026-07-29).
  let sopId: string
  if ('sopId' in target) {
    sopId = target.sopId
  } else if ('sectionId' in target) {
    const { data: section } = await admin
      .from('sop_sections')
      .select('sop_id')
      .eq('id', target.sectionId)
      .maybeSingle()
    if (!section) return { error: 'SOP not found' }
    sopId = (section as { sop_id: string }).sop_id
  } else {
    const { data: junction } = await admin
      .from('sop_section_blocks')
      .select('sop_section_id')
      .eq('id', target.junctionId)
      .maybeSingle()
    if (!junction) return { error: 'SOP not found' }
    const { data: section } = await admin
      .from('sop_sections')
      .select('sop_id')
      .eq('id', (junction as { sop_section_id: string }).sop_section_id)
      .maybeSingle()
    if (!section) return { error: 'SOP not found' }
    sopId = (section as { sop_id: string }).sop_id
  }

  // Self-enforced org scope: filtered by the SESSION organisationId, never by
  // any value read off the fetched row. This runs for admins too — the admin
  // client bypasses RLS, so this call is the only org gate on these paths.
  const { data: sop } = await admin
    .from('sops')
    .select('id, category_slug')
    .eq('id', sopId)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  if (!sop) return { error: 'SOP not found in your organisation.' }

  if (role === 'admin' || role === 'safety_manager') {
    return { supabase, user: { id: userId }, role, organisationId, sopId, viaApproverStep: false }
  }

  // A1: chain lookup mirrors the canonical publish-route lookup —
  // approval_chains keyed on (SESSION organisationId, sops.category_slug).
  // approval_chains is not in database.types.ts — (as any) cast matches the
  // publish route precedent. No chain row / empty steps ⇒ deny (accepted
  // consequence of A1).
  const categorySlug = (sop as { category_slug: string | null }).category_slug
  if (categorySlug) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: chainRow } = await (admin as any)
      .from('approval_chains')
      .select('steps')
      .eq('organisation_id', organisationId)
      .eq('category', categorySlug)
      .maybeSingle()
    const steps = (chainRow?.steps ?? []) as ChainStep[]
    const caller = { userId, role: (role ?? '') as AppRole }
    if (Array.isArray(steps) && steps.some((s) => stepMatchesCaller(s, caller))) {
      return { supabase, user: { id: userId }, role: role ?? '', organisationId, sopId, viaApproverStep: true }
    }
  }
  return { error: "Edit access required — you must be an admin, safety manager, or a sign-off approver in this SOP's category approval chain." }
}
