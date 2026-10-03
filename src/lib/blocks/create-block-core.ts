/**
 * blocks insert-with-version core — plain module, deliberately NOT
 * 'use server'.
 *
 * Phase 43 T-43-01: the old createBlock server action accepted a
 * `serviceRole: { organisationId, createdByUserId }` override FROM THE
 * WIRE and skipped requireAdmin() when it was set — a network-reachable,
 * unauthenticated, cross-tenant write bypass (every export of a
 * 'use server' module is a POST-reachable RPC endpoint once a client
 * component imports it, and the Phase 43 create form is the first client
 * import of createBlock). The trust flag must never arrive over the wire.
 * Mirrors the Phase 46 CR-01 split in src/lib/builder/section-blocks-core.ts.
 *
 * Split:
 *   - insertBlockWithVersion(writer, owner, input) — the shared insert body
 *     (validate input + content, insert blocks + block_versions v1, roll
 *     back on version failure, set current_version_id). Caller supplies the
 *     client AND the owner, so the AUTH DECISION lives with the caller, not
 *     a wire flag.
 *   - createBlockAsService(input, owner) — server-only parser entry point.
 *     Uses the service-role client directly. Reachable only by importing
 *     this module from server code — it has no server-action endpoint ID.
 *     The parser pipeline owns the org-scope invariant (it passes the
 *     organisation of the SOP it is parsing).
 *
 * The user-facing server action was removed with the content library in
 * Phase 55; any future one must run requireAdmin() before delegating here.
 */

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { BlockContentSchema } from '@/lib/validators/blocks'
import type { BlockContent } from '@/lib/validators/blocks'
import type { Block, BlockVersion } from '@/types/sop'

export const CreateBlockInput = z.object({
  kindSlug: z.string().min(1),
  name: z.string().min(1).max(200),
  categoryTags: z.array(z.string()).max(20).default([]),
  freeTextTags: z.array(z.string()).max(20).default([]),
  content: z.unknown(), // validated below via BlockContentSchema
  changeNote: z.string().max(500).optional(),
  // Phase 25: 'global' scope removed — all blocks are org-owned.
  scope: z.enum(['org']).default('org'),
  /**
   * Phase 21 Plan 21-05 — written to blocks.category. The picker filters
   * `category != 'parsed_inline'` by default so per-item library blocks
   * created during parsing don't bloat the picker UX (T-21-05-01).
   * Other callers (Phase 13 wizard, picker promotion) leave this null.
   */
  category: z.string().max(60).nullable().optional(),
})

export interface CreateBlockOwner {
  organisationId: string
  createdByUserId: string | null
}

/**
 * Shared insert body. RLS applies (or not) according to the client the
 * caller hands in — session client for user paths, admin client for the
 * parser. No auth is performed here; the caller supplies `owner`.
 */
export async function insertBlockWithVersion(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writer: any,
  owner: CreateBlockOwner,
  input: z.input<typeof CreateBlockInput>
): Promise<{ block: Block; version: BlockVersion } | { error: string }> {
  const parsed = CreateBlockInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const data = parsed.data

  // Validate the content payload BEFORE any DB writes (T-13-01-03 mitigation).
  let content: BlockContent
  try {
    content = BlockContentSchema.parse(data.content) as BlockContent
  } catch {
    return { error: 'Invalid block content' }
  }

  // Insert blocks row
  const { data: blockRow, error: blockErr } = await writer
    .from('blocks')
    .insert({
      organisation_id: owner.organisationId,
      kind_slug: data.kindSlug,
      name: data.name,
      category_tags: data.categoryTags,
      free_text_tags: data.freeTextTags,
      created_by: owner.createdByUserId,
      // Plan 21-05 — only set when supplied (Phase 13 callers leave null).
      ...(data.category ? { category: data.category } : {}),
    })
    .select('*')
    .single()
  if (blockErr || !blockRow) {
    console.error('[createBlock] block insert error', blockErr)
    return { error: blockErr?.message ?? 'Failed to create block' }
  }

  // Insert block_versions v1
  const { data: versionRow, error: versionErr } = await writer
    .from('block_versions')
    .insert({
      block_id: blockRow.id,
      version_number: 1,
      content: content as unknown as object,
      change_note: data.changeNote ?? null,
      created_by: owner.createdByUserId,
    })
    .select('*')
    .single()
  if (versionErr || !versionRow) {
    console.error('[createBlock] version insert error — rolling back block', versionErr)
    // Rollback the block row so we don't leave an orphan with no current_version_id.
    await writer.from('blocks').delete().eq('id', blockRow.id)
    return { error: versionErr?.message ?? 'Failed to create block version' }
  }

  // Set blocks.current_version_id
  const { error: updErr } = await writer
    .from('blocks')
    .update({ current_version_id: versionRow.id })
    .eq('id', blockRow.id)
  if (updErr) {
    console.error('[createBlock] current_version_id update error', updErr)
    return { error: updErr.message }
  }

  return {
    block: { ...(blockRow as unknown as Block), current_version_id: versionRow.id },
    version: versionRow as unknown as BlockVersion,
  }
}

/**
 * Server-only parser entry point. No session exists in the parse-job
 * worker, so the write goes through the service-role client. The caller
 * (parser pipeline) owns the org-scope invariant — it passes the
 * organisation of the SOP it is parsing, not a wire-supplied value.
 * Not a server action — reachable only by importing this module from
 * server code.
 */
export async function createBlockAsService(
  input: z.input<typeof CreateBlockInput>,
  owner: CreateBlockOwner
): Promise<{ block: Block; version: BlockVersion } | { error: string }> {
  return insertBlockWithVersion(createAdminClient(), owner, input)
}
