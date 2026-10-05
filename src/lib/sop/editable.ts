/**
 * Phase 58 -- the one "may this SOP's content change right now" check (D-11, WRK-03).
 *
 * Plain module so both src/actions/focus-steps.ts and src/actions/sections.ts use
 * the same rule (a server-action file cannot export a helper). The organisation is
 * the caller's SESSION organisation, passed in from a guard context; the row's own
 * organisation_id is never consulted (CLAUDE.md 2026-07-28).
 *
 * A published SOP is read-only -- edits go to the next version's draft. A SOP
 * still uploading or parsing is being written by the parser.
 */
import { createAdminClient } from '@/lib/supabase/admin'

export const PUBLISHED_MSG = 'Published — start a new version to change it.'
export const PARSING_MSG = "Still reading the document — try again when it's done."

export async function editableSop(
  organisationId: string,
  sopId: string
): Promise<{ ok: true } | { error: string }> {
  const { data: sop } = await createAdminClient()
    .from('sops')
    .select('status')
    .eq('id', sopId)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  if (!sop) return { error: 'SOP not found in your organisation.' }
  const status = (sop as { status: string }).status
  if (status === 'draft') return { ok: true }
  return { error: status === 'published' ? PUBLISHED_MSG : PARSING_MSG }
}
