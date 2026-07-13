'use server'

/**
 * Phase 13 Reusable Block Library — server actions.
 * Phase 25 update: org-vs-global model retired; global blocks converted to
 * org-owned with all_departments = true. listBlocks now accepts departmentId
 * for department-based filtering.
 *
 * Remaining surface:
 *  - createBlock({ ... scope: 'org' })
 *  - listBlocks(opts: ListBlocksOptions) where opts.departmentId filters to dept + all_departments
 *  - saveFromSection({ ... scope: 'org' })
 *
 * All content writes call BlockContentSchema.parse() before the insert.
 * RLS handles cross-org isolation.
 */

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminContext } from '@/lib/auth/guards'
import { BlockContentSchema } from '@/lib/validators/blocks'
import type { BlockContent } from '@/lib/validators/blocks'
import type {
  Block,
  BlockVersion,
  BlockCategory,
} from '@/types/sop'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireAdmin() {
  return requireAdminContext()
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
  // Phase 25: 'global' scope removed — all blocks are org-owned.
  scope: z.enum(['org']).default('org'),
  /**
   * Phase 21 Plan 21-05 — written to blocks.category. The picker filters
   * `category != 'parsed_inline'` by default so per-item library blocks
   * created during parsing don't bloat the picker UX (T-21-05-01).
   * Other callers (Phase 13 wizard, picker promotion) leave this null.
   */
  category: z.string().max(60).nullable().optional(),
  /**
   * Phase 21 Plan 21-05 — service-role / parser invocation override.
   * When set, the action skips the auth-session-based requireAdmin() path
   * and uses the admin (service-role) supabase client with the explicit
   * organisationId. NEVER call from a user-facing context — parser is the
   * sole consumer because parse-jobs run server-side with no auth session.
   */
  serviceRole: z
    .object({
      organisationId: z.string().uuid(),
      createdByUserId: z.string().uuid().nullable(),
    })
    .optional(),
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
  // Phase 25: only 'org' scope remains (A5/A6 — global model retired).
  scope: z.enum(['org']),
})

/**
 * ListBlocks options surface — Phase 25 update.
 * org-vs-global model retired; departmentId added for department-based filtering.
 * departmentId: when set, returns blocks tagged to that department OR
 * blocks with all_departments = true (org-wide blocks).
 */
export type ListBlocksOptions = {
  kindSlug?: string
  includeArchived?: boolean
  categoryTag?: string
  /** Phase 25: filter to this department's blocks (junction) OR org-wide (all_departments=true) */
  departmentId?: string
  /** default false: when true, hydrate currentContent on each block from block_versions */
  includeContent?: boolean
  /**
   * Plan 21-05 / T-21-05-01 — default false:
   *   excludes blocks whose category = 'parsed_inline' so the library picker
   *   isn't bloated with single-use parser-created blocks.
   */
  includeParsedInline?: boolean
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

  // Auth gates
  let organisationId: string | null = null
  let createdByUserId: string | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let writer: any
  if (data.serviceRole) {
    // Plan 21-05 — parser invocation. Bypass requireAdmin (no session in the
    // parse-job worker context). Always scoped to the caller-supplied org.
    writer = createAdminClient()
    organisationId = data.serviceRole.organisationId
    createdByUserId = data.serviceRole.createdByUserId
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
  // on is_platform_admin(); we do not pre-check here to avoid duplicating logic.
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
    includeArchived: false,
    includeContent: false,
    includeParsedInline: false,
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

  // Phase 25: org-vs-global model retired. RLS already excludes organisation_id IS NULL
  // after migration 00036 converts all global blocks to org-owned. No explicit filter needed.
  // departmentId: restrict to blocks tagged to this dept OR with all_departments = true.
  if (opts.departmentId) {
    // Fetch block IDs tagged to this department from the junction table.
    const { data: junctionRows } = await supabase
      .from('block_departments' as Parameters<typeof supabase.from>[0])
      .select('block_id')
      .eq('department_id', opts.departmentId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const taggedBlockIds: string[] = ((junctionRows ?? []) as any[]).map((r: any) => r.block_id)
    if (taggedBlockIds.length > 0) {
      // Include blocks tagged to this dept OR org-wide blocks.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = (query as any).or(`id.in.(${taggedBlockIds.join(',')}),all_departments.eq.true`)
    } else {
      // No tagged blocks — only org-wide blocks.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = (query as any).eq('all_departments', true)
    }
  }

  // Plan 21-05 / T-21-05-01 — by default hide parser-created blocks from
  // the picker so 50-block parsed SOPs don't bloat the library. `category`
  // is NULL for hand-authored library blocks (Phase 13) and 'parsed_inline'
  // for parser-created junctions. NULL passes `neq` checks.
  if (!opts.includeParsedInline) {
    // PostgREST: `category=neq.parsed_inline` excludes the equal rows but
    // also drops NULL rows because NULL comparisons are unknown. Use
    // .or() to keep NULL rows.
    query = query.or('category.is.null,category.neq.parsed_inline')
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
): Promise<{ block: Block } | { error: string }> {
  const parsed = SaveFromSectionInput.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const data = parsed.data

  // Create the block in the caller's org.
  // Phase 25: only 'org' scope — global model retired (A5/A6).
  const created = await createBlock({
    kindSlug: data.kindSlug,
    name: data.name,
    categoryTags: data.categoryTags,
    freeTextTags: data.freeTextTags,
    content: data.content,
    scope: 'org',
  })
  if ('error' in created) return { error: created.error }

  return { block: created.block }
}

// ---------------------------------------------------------------------------
// 7. listBlockCategories
// ---------------------------------------------------------------------------
// NOTE: suggestion functions removed in Phase 25 (global model retired — A5/A6).
// block_suggestions table dropped in migration 00037.

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
