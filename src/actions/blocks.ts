'use server'

/**
 * Phase 13 Reusable Block Library — server actions.
 *
 * Final option surface (consumed by 13-02 / 13-03 / 13-04 / 13-05):
 *  - createBlock({ ... scope: 'org' | 'global' })
 *  - listBlocks(opts: ListBlocksOptions) where opts.includeContent / opts.globalOnly
 *  - saveFromSection({ ... scope: 'org' | 'suggest_global' })
 *
 * All content writes call BlockContentSchema.parse() before the insert.
 * RLS handles cross-org isolation; createAdminClient() is used ONLY where the
 * insert/update target is organisation_id = null (global blocks) and the
 * caller has been verified as a Summit super-admin via is_summit_admin().
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { BlockContentSchema } from '@/lib/validators/blocks'
import type { BlockContent } from '@/lib/validators/blocks'
import type {
  Block,
  BlockVersion,
  BlockSuggestion,
  BlockCategory,
} from '@/types/sop'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AdminCtx = {
  supabase: Awaited<ReturnType<typeof createClient>>
  user: { id: string }
  role: string
  organisationId: string | null
}

async function requireAdmin(): Promise<AdminCtx | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: { session } } = await supabase.auth.getSession()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jwtClaims: Record<string, any> = session?.access_token
    ? JSON.parse(atob(session.access_token.split('.')[1]))
    : {}
  const role: string = jwtClaims['user_role'] ?? ''
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }
  const organisationId: string | null = jwtClaims['organisation_id'] ?? null
  return { supabase, user: { id: user.id }, role, organisationId }
}

/**
 * Defence-in-depth: verify caller is a Summit super-admin via the
 * is_summit_admin() RPC. Used by createBlock when scope='global' is
 * requested AND by promoteSuggestion / rejectSuggestion. The full route
 * guard for /admin/global-blocks ships in plan 13-05.
 */
async function requireSummitAdmin(): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('is_summit_admin')
  if (error || data !== true) {
    return { error: 'Summit super-admin required' }
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const CreateBlockInput = z.object({
  kindSlug: z.string().min(1),
  name: z.string().min(1).max(200),
  categoryTags: z.array(z.string()).max(20).default([]),
  freeTextTags: z.array(z.string()).max(20).default([]),
  content: z.unknown(), // validated below via BlockContentSchema
  changeNote: z.string().max(500).optional(),
  // 'global' requires Summit super-admin (D-Global-01)
  scope: z.enum(['org', 'global']).default('org'),
})

const UpdateBlockInput = z.object({
  blockId: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  categoryTags: z.array(z.string()).max(20).optional(),
  freeTextTags: z.array(z.string()).max(20).optional(),
  content: z.unknown().optional(), // if present → triggers a new block_versions row
  changeNote: z.string().max(500).optional(),
})

const SaveFromSectionInput = z.object({
  sopSectionBlockId: z.string().uuid().optional(),
  kindSlug: z.string().min(1),
  name: z.string().min(1).max(200),
  categoryTags: z.array(z.string()).max(20).default([]),
  freeTextTags: z.array(z.string()).max(20).default([]),
  content: z.unknown(),
  scope: z.enum(['org', 'suggest_global']),
})

/**
 * ListBlocks options surface — FINAL.
 * Downstream plans (13-03 picker, 13-04 follow-latest, 13-05 super-admin UI)
 * MUST consume these options as-is. Do NOT add new options in those plans.
 */
export type ListBlocksOptions = {
  kindSlug?: string
  includeArchived?: boolean
  categoryTag?: string
  /** default true: include organisation_id is null rows alongside org-scoped blocks */
  includeGlobal?: boolean
  /** default false: when true, return ONLY organisation_id is null rows (consumed by 13-05) */
  globalOnly?: boolean
  /** default false: when true, hydrate currentContent on each block from block_versions (consumed by 13-03 to avoid N+1) */
  includeContent?: boolean
}

// ---------------------------------------------------------------------------
// 1. createBlock
// ---------------------------------------------------------------------------

export async function createBlock(
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

  const isGlobal = data.scope === 'global'

  // Auth gates
  let organisationId: string | null = null
  let createdByUserId: string | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let writer: any
  if (isGlobal) {
    const summit = await requireSummitAdmin()
    if ('error' in summit) {
      return { error: 'Summit super-admin required to create global blocks' }
    }
    // For global writes (organisation_id = null) use the service-role client
    // since the authenticated RLS path would also work (per 00022 policy) but
    // the admin client avoids any ambiguity in tooling.
    writer = createAdminClient()
    // Capture the calling user id via the regular client.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    createdByUserId = user?.id ?? null
  } else {
    const ctx = await requireAdmin()
    if ('error' in ctx) return { error: ctx.error }
    if (!ctx.organisationId) return { error: 'No organisation' }
    writer = ctx.supabase
    organisationId = ctx.organisationId
    createdByUserId = ctx.user.id
  }

  // Insert blocks row
  const { data: blockRow, error: blockErr } = await writer
    .from('blocks')
    .insert({
      organisation_id: organisationId,
      kind_slug: data.kindSlug,
      name: data.name,
      category_tags: data.categoryTags,
      free_text_tags: data.freeTextTags,
      created_by: createdByUserId,
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
      created_by: createdByUserId,
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

// ---------------------------------------------------------------------------
// 2. updateBlock
// ---------------------------------------------------------------------------

export async function updateBlock(
  input: z.input<typeof UpdateBlockInput>
): Promise<{ block: Block; version?: BlockVersion } | { error: string }> {
  const parsed = UpdateBlockInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const data = parsed.data

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabase, user } = ctx

  // Fetch current block — RLS-scoped (returns null if not visible / cross-org).
  // For global blocks, RLS update policy from 00022 will gate the actual write
  // on is_summit_admin(); we do not pre-check here to avoid duplicating logic.
  const { data: existing, error: selErr } = await supabase
    .from('blocks')
    .select('*')
    .eq('id', data.blockId)
    .maybeSingle()
  if (selErr) {
    console.error('[updateBlock] select error', selErr)
    return { error: selErr.message }
  }
  if (!existing) return { error: 'Block not found or not accessible' }

  let newVersion: BlockVersion | undefined

  // If content provided → insert new immutable block_versions row.
  if (data.content !== undefined) {
    let content: BlockContent
    try {
      content = BlockContentSchema.parse(data.content) as BlockContent
    } catch {
      return { error: 'Invalid block content' }
    }

    // Compute next version_number = current max + 1 (strict-monotonic).
    const { data: maxRow, error: maxErr } = await supabase
      .from('block_versions')
      .select('version_number')
      .eq('block_id', data.blockId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (maxErr) {
      console.error('[updateBlock] version_number lookup error', maxErr)
      return { error: maxErr.message }
    }
    const nextVersion = (maxRow?.version_number ?? 0) + 1

    const { data: vRow, error: vErr } = await supabase
      .from('block_versions')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        block_id: data.blockId,
        version_number: nextVersion,
        content: content as unknown as object,
        change_note: data.changeNote ?? null,
        created_by: user.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select('*')
      .single()
    if (vErr || !vRow) {
      console.error('[updateBlock] version insert error', vErr)
      return { error: vErr?.message ?? 'Failed to create block version' }
    }
    newVersion = vRow as unknown as BlockVersion

    // Bump current_version_id on the block.
    const { error: bumpErr } = await supabase
      .from('blocks')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ current_version_id: vRow.id, updated_at: new Date().toISOString() } as any)
      .eq('id', data.blockId)
    if (bumpErr) {
      console.error('[updateBlock] current_version_id bump error', bumpErr)
      return { error: bumpErr.message }
    }
  }

  // Update metadata fields on blocks if any of them changed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const metaUpdate: Record<string, any> = {}
  if (data.name !== undefined) metaUpdate.name = data.name
  if (data.categoryTags !== undefined) metaUpdate.category_tags = data.categoryTags
  if (data.freeTextTags !== undefined) metaUpdate.free_text_tags = data.freeTextTags
  if (Object.keys(metaUpdate).length > 0) {
    metaUpdate.updated_at = new Date().toISOString()
    const { error: metaErr } = await supabase
      .from('blocks')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(metaUpdate as any)
      .eq('id', data.blockId)
    if (metaErr) {
      console.error('[updateBlock] meta update error', metaErr)
      return { error: metaErr.message }
    }
  }

  // Re-read for fresh row.
  const { data: refreshed, error: reErr } = await supabase
    .from('blocks')
    .select('*')
    .eq('id', data.blockId)
    .single()
  if (reErr || !refreshed) {
    console.error('[updateBlock] refresh error', reErr)
    return { error: reErr?.message ?? 'Failed to refresh block' }
  }

  return { block: refreshed as unknown as Block, version: newVersion }
}

// ---------------------------------------------------------------------------
// 3. archiveBlock
// ---------------------------------------------------------------------------

export async function archiveBlock(
  blockId: string
): Promise<{ success: true } | { error: string }> {
  if (!blockId) return { error: 'blockId required' }

  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const { supabase } = ctx

  const { error } = await supabase
    .from('blocks')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ archived_at: new Date().toISOString() } as any)
    .eq('id', blockId)
  if (error) {
    console.error('[archiveBlock] update error', error)
    return { error: error.message }
  }
  return { success: true }
}

// ---------------------------------------------------------------------------
// 4. listBlocks
// ---------------------------------------------------------------------------

export async function listBlocks(
  options?: ListBlocksOptions
): Promise<Array<Block & { currentContent?: BlockContent | null }>> {
  const opts: ListBlocksOptions = {
    includeGlobal: true,
    includeArchived: false,
    globalOnly: false,
    includeContent: false,
    ...(options ?? {}),
  }

  const supabase = await createClient()

  // Build select list. Use a join to block_versions when includeContent is requested.
  const selectExpr = opts.includeContent
    ? '*, current_version:block_versions!blocks_current_version_fk(content)'
    : '*'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase.from('blocks').select(selectExpr).limit(500)

  if (opts.kindSlug) {
    query = query.eq('kind_slug', opts.kindSlug)
  }

  if (!opts.includeArchived) {
    query = query.is('archived_at', null)
  }

  if (opts.categoryTag) {
    // GIN-indexed array contains (Postgres @> operator)
    query = query.contains('category_tags', [opts.categoryTag])
  }

  if (opts.globalOnly) {
    query = query.is('organisation_id', null)
  } else if (!opts.includeGlobal) {
    // RLS already restricts to org + globals; if caller does not want globals,
    // exclude null org rows explicitly.
    query = query.not('organisation_id', 'is', null)
  }

  // Order: org blocks first (organisation_id is not null), then by name.
  // Postgres NULLs LAST for ascending = org first.
  query = query.order('organisation_id', { ascending: true, nullsFirst: false }).order('name', { ascending: true })

  const { data, error } = await query
  if (error) {
    console.error('[listBlocks] error', error)
    return []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[]
  return rows.map((r) => {
    const { current_version, ...rest } = r
    const block = rest as unknown as Block
    if (opts.includeContent) {
      const cv = current_version
      const content = Array.isArray(cv) ? cv[0]?.content : cv?.content
      return { ...block, currentContent: (content ?? null) as BlockContent | null }
    }
    return block
  })
}

// ---------------------------------------------------------------------------
// 5. getBlock
// ---------------------------------------------------------------------------

export async function getBlock(
  blockId: string
): Promise<{ block: Block; currentVersion: BlockVersion; allVersions: BlockVersion[] } | null> {
  if (!blockId) return null

  const supabase = await createClient()

  const { data: blockRow, error: blockErr } = await supabase
    .from('blocks')
    .select('*')
    .eq('id', blockId)
    .maybeSingle()
  if (blockErr || !blockRow) return null

  const { data: versions, error: vErr } = await supabase
    .from('block_versions')
    .select('*')
    .eq('block_id', blockId)
    .order('version_number', { ascending: false })
  if (vErr) {
    console.error('[getBlock] versions error', vErr)
    return null
  }

  const allVersions = (versions ?? []) as unknown as BlockVersion[]
  const currentVersion =
    allVersions.find((v) => v.id === (blockRow as { current_version_id: string | null }).current_version_id) ??
    allVersions[0]
  if (!currentVersion) return null

  return {
    block: blockRow as unknown as Block,
    currentVersion,
    allVersions,
  }
}

// ---------------------------------------------------------------------------
// 6. saveFromSection
// ---------------------------------------------------------------------------

export async function saveFromSection(
  input: z.input<typeof SaveFromSectionInput>
): Promise<{ block: Block; suggestionId?: string } | { error: string }> {
  const parsed = SaveFromSectionInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const data = parsed.data

  // Always create the block in the caller's org (even when scope='suggest_global'
  // the org keeps its own copy; promotion later copies to global).
  const created = await createBlock({
    kindSlug: data.kindSlug,
    name: data.name,
    categoryTags: data.categoryTags,
    freeTextTags: data.freeTextTags,
    content: data.content,
    scope: 'org',
  })
  if ('error' in created) return { error: created.error }

  let suggestionId: string | undefined

  if (data.scope === 'suggest_global') {
    const ctx = await requireAdmin()
    if ('error' in ctx) return { error: ctx.error }
    const { supabase, user, organisationId } = ctx
    if (!organisationId) return { error: 'No organisation' }

    const snapshot = {
      kind_slug: data.kindSlug,
      name: data.name,
      category_tags: data.categoryTags,
      free_text_tags: data.freeTextTags,
      content: data.content,
    }

    const { data: sugRow, error: sugErr } = await supabase
      .from('block_suggestions')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        source_block_id: created.block.id,
        suggested_by_org_id: organisationId,
        suggested_by_user: user.id,
        snapshot: snapshot as unknown as object,
        status: 'pending',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select('id')
      .single()
    if (sugErr || !sugRow) {
      console.error('[saveFromSection] suggestion insert error', sugErr)
      return { error: sugErr?.message ?? 'Failed to create suggestion' }
    }
    suggestionId = (sugRow as { id: string }).id
  }

  return { block: created.block, suggestionId }
}

// ---------------------------------------------------------------------------
// 7. listBlockSuggestions
// ---------------------------------------------------------------------------

export async function listBlockSuggestions(
  options?: { status?: 'pending' | 'promoted' | 'rejected' }
): Promise<BlockSuggestion[]> {
  const supabase = await createClient()
  const status = options?.status ?? 'pending'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('block_suggestions')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    console.error('[listBlockSuggestions] error', error)
    return []
  }
  return (data ?? []) as unknown as BlockSuggestion[]
}

// ---------------------------------------------------------------------------
// 8. promoteSuggestion
// ---------------------------------------------------------------------------

export async function promoteSuggestion(
  suggestionId: string,
  decisionNote?: string
): Promise<{ promotedBlockId: string } | { error: string }> {
  if (!suggestionId) return { error: 'suggestionId required' }

  const summit = await requireSummitAdmin()
  if ('error' in summit) return { error: summit.error }

  // Capture caller user id via regular client (admin client has no auth context).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const admin = createAdminClient()

  // Fetch suggestion (admin client bypasses RLS — fine since requireSummitAdmin gated).
  const { data: sug, error: sugErr } = await admin
    .from('block_suggestions')
    .select('*')
    .eq('id', suggestionId)
    .maybeSingle()
  if (sugErr || !sug) {
    return { error: sugErr?.message ?? 'Suggestion not found' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snapshot = (sug as any).snapshot as {
    kind_slug: string
    name: string
    category_tags: string[]
    free_text_tags: string[]
    content: unknown
  }

  // Validate snapshot content payload before promoting.
  let content: BlockContent
  try {
    content = BlockContentSchema.parse(snapshot.content) as BlockContent
  } catch {
    return { error: 'Suggestion snapshot has invalid content' }
  }

  // Insert global block (organisation_id = null).
  const { data: blockRow, error: blockErr } = await admin
    .from('blocks')
    .insert({
      organisation_id: null,
      kind_slug: snapshot.kind_slug,
      name: snapshot.name,
      category_tags: snapshot.category_tags ?? [],
      free_text_tags: snapshot.free_text_tags ?? [],
      created_by: user.id,
    })
    .select('id')
    .single()
  if (blockErr || !blockRow) {
    console.error('[promoteSuggestion] block insert error', blockErr)
    return { error: blockErr?.message ?? 'Failed to create global block' }
  }

  const newBlockId = (blockRow as { id: string }).id

  // Insert v1 block_versions row.
  const { data: vRow, error: vErr } = await admin
    .from('block_versions')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      block_id: newBlockId,
      version_number: 1,
      content: content as unknown as object,
      change_note: 'Promoted from suggestion',
      created_by: user.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .select('id')
    .single()
  if (vErr || !vRow) {
    console.error('[promoteSuggestion] version insert error — rolling back block', vErr)
    await admin.from('blocks').delete().eq('id', newBlockId)
    return { error: vErr?.message ?? 'Failed to create block version' }
  }

  // Bump current_version_id on the new global block.
  const { error: bumpErr } = await admin
    .from('blocks')
    .update({ current_version_id: (vRow as { id: string }).id })
    .eq('id', newBlockId)
  if (bumpErr) {
    console.error('[promoteSuggestion] current_version_id bump error', bumpErr)
    return { error: bumpErr.message }
  }

  // Mark suggestion promoted.
  const { error: updErr } = await admin
    .from('block_suggestions')
    .update({
      status: 'promoted',
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      decision_note: decisionNote ?? null,
      promoted_block_id: newBlockId,
    })
    .eq('id', suggestionId)
  if (updErr) {
    console.error('[promoteSuggestion] suggestion update error', updErr)
    return { error: updErr.message }
  }

  return { promotedBlockId: newBlockId }
}

// ---------------------------------------------------------------------------
// 9. rejectSuggestion
// ---------------------------------------------------------------------------

export async function rejectSuggestion(
  suggestionId: string,
  decisionNote?: string
): Promise<{ success: true } | { error: string }> {
  if (!suggestionId) return { error: 'suggestionId required' }

  const summit = await requireSummitAdmin()
  if ('error' in summit) return { error: summit.error }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // RLS update policy block_suggestions_update_summit_only allows this via
  // the regular client because requireSummitAdmin already passed.
  const { error } = await supabase
    .from('block_suggestions')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      status: 'rejected',
      decided_by: user.id,
      decided_at: new Date().toISOString(),
      decision_note: decisionNote ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .eq('id', suggestionId)
  if (error) {
    console.error('[rejectSuggestion] update error', error)
    return { error: error.message }
  }
  return { success: true }
}

// ---------------------------------------------------------------------------
// 10. listBlockCategories
// ---------------------------------------------------------------------------

/**
 * Phase 13 plan 13-04: count downstream SOP usages of a block in follow_latest
 * mode. Surfaced in BlockEditorClient post-save toast so admins know how many
 * SOPs will see an update-available badge.
 *
 * Counts ALL follow-latest junction rows referencing this block — across the
 * entire org (RLS-scoped: only own-org SOPs are returned by the count).
 * Globals show the count of follow-latest junction rows the calling org owns.
 */
export async function countFollowLatestUsages(blockId: string): Promise<number> {
  if (!blockId) return 0
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count, error } = await (supabase as any)
    .from('sop_section_blocks')
    .select('id', { count: 'exact', head: true })
    .eq('block_id', blockId)
    .eq('pin_mode', 'follow_latest')
  if (error) {
    console.error('[countFollowLatestUsages] error', error)
    return 0
  }
  return count ?? 0
}

export async function listBlockCategories(): Promise<BlockCategory[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('block_categories')
    .select('*')
    .order('category_group', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('slug', { ascending: true })

  if (error) {
    console.error('[listBlockCategories] error', error)
    return []
  }
  return (data ?? []) as unknown as BlockCategory[]
}
