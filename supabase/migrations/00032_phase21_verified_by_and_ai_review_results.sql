-- ============================================================
-- Migration 00032: Phase 21 — Safety-Critical Parsing foundation
--
-- Wave 1 / Plan 21-01 schema additions:
--   1. sop_section_blocks.verified_by_admin_id  (uuid, nullable, FK auth.users)
--   2. sop_section_blocks.verified_at           (timestamptz, nullable)
--   3. sop_section_blocks.block_provenance      (jsonb, nullable) — D-CV2-06 ship
--   4. parse_jobs.ai_review_results             (jsonb, default '{}')
--   5. org_anthropic_spend                      (NEW table, per D-21-06)
--   6. ai_review_rate_limits                    (NEW table, per D-21-13)
--   7. Trigger clear_block_verification_on_content_change — fires when content
--      columns change; explicitly guards against infinite loop by checking
--      WHEN clause so editing verified_by_admin_id itself does NOT re-fire.
--
-- D-21-01: this is migration 00032 (not 00031; that one is the sub-trades RLS
-- recursion fix from Phase 15).
-- D-21-05: verified_by_admin_id and verified_at are NULLABLE so existing rows
-- survive AND so Phase 23 G-01 supersede flow (version bump → new blocks)
-- doesn't break.
-- D-21-13: ai_review_rate_limits is created HERE in 00032 — no follow-up 00033.
--
-- Notes:
--   * The trigger watches snapshot_content + pinned_version_id (the actual
--     content columns on sop_section_blocks; the plan's mention of
--     "content_snapshot" is just a generic content-column reference).
--   * RLS on the two new tables is enabled; org_anthropic_spend grants SELECT
--     to platform admins only — writes always come from the service-role
--     client in cost-guard.ts. ai_review_rate_limits has NO direct user
--     policies — only service-role writers touch it.
-- ============================================================

begin;

-- ============================================================
-- 1. sop_section_blocks: verification + provenance columns
-- ============================================================

alter table public.sop_section_blocks
  add column if not exists verified_by_admin_id uuid references auth.users(id) on delete set null;

alter table public.sop_section_blocks
  add column if not exists verified_at timestamptz;

-- D-CV2-06: block_provenance JSONB column. Shape:
--   { region: SourceProvenanceRegion, parser_run_id: text, parser_version: text }
-- Existing rows survive as NULL; only newly-parsed blocks populate it.
alter table public.sop_section_blocks
  add column if not exists block_provenance jsonb;

comment on column public.sop_section_blocks.verified_by_admin_id is
  'Phase 21 (00032): admin user who marked this block verified at the pre-publish gate. NULL = unverified. Cleared automatically when content changes via clear_block_verification_on_content_change trigger.';

comment on column public.sop_section_blocks.verified_at is
  'Phase 21 (00032): timestamp the block was verified. NULL = unverified. Paired with verified_by_admin_id.';

comment on column public.sop_section_blocks.block_provenance is
  'Phase 21 (00032) / D-CV2-06: parser-written source-region pointer. Shape: { region: SourceProvenanceRegion, parser_run_id: text, parser_version: text }. NULL on pre-Phase-21 rows.';

-- Partial sparse index — most rows will be unverified, so index only the
-- verified ones for fast "which blocks are NOT verified yet" queries.
create index if not exists idx_sop_section_blocks_verified
  on public.sop_section_blocks (verified_by_admin_id)
  where verified_by_admin_id is not null;

-- ============================================================
-- 2. parse_jobs.ai_review_results JSONB
-- ============================================================

alter table public.parse_jobs
  add column if not exists ai_review_results jsonb not null default '{}'::jsonb;

comment on column public.parse_jobs.ai_review_results is
  'Phase 21 (00032): persisted ReviewerRunEnvelope from src/lib/parsers/ai-reviewer/orchestrator.ts. Lazy-loaded per block in the builder. Default empty object so old rows decode cleanly.';

-- ============================================================
-- 3. org_anthropic_spend — per-org rolling-month spend ledger (D-21-06)
-- ============================================================

create table if not exists public.org_anthropic_spend (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  month_start     date not null,
  spend_cents     int4 not null default 0,
  -- cap_cents NULL = use env var ANTHROPIC_PER_ORG_MONTHLY_CAP_USD default ($5.00 = 500c)
  cap_cents       int4 default null,
  updated_at      timestamptz not null default now(),
  primary key (organisation_id, month_start)
);

comment on table public.org_anthropic_spend is
  'Phase 21 (00032) / D-21-06: per-organisation rolling-month Anthropic spend ledger for the AI reviewer cost guard. Atomic UPSERT in cost-guard.ts. NEW table — does NOT reuse Phase 15 voice-qa cap (different scope).';

alter table public.org_anthropic_spend enable row level security;

-- Only platform admins may read directly. Writes always via service-role
-- client in cost-guard.ts; no INSERT/UPDATE/DELETE policy for authenticated.
create policy "org_anthropic_spend_platform_read"
  on public.org_anthropic_spend
  for select
  to authenticated
  using (public.is_platform_admin());

comment on policy "org_anthropic_spend_platform_read" on public.org_anthropic_spend is
  'Phase 21: platform super-admins read all rows for ops dashboards. Org admins do NOT see this directly — their UI surface is the OrgSpendCapExceededError thrown by the orchestrator.';

-- ============================================================
-- 4. ai_review_rate_limits — per-SOP per-day run counter (D-21-13)
-- ============================================================

create table if not exists public.ai_review_rate_limits (
  sop_id              uuid primary key references public.sops(id) on delete cascade,
  runs_today          int4 not null default 0,
  runs_today_reset_at timestamptz not null default now()
);

comment on table public.ai_review_rate_limits is
  'Phase 21 (00032) / D-21-13: per-SOP per-day reviewer-run counter. CONV-09 caps at 5 runs/day per SOP. Atomic increment via UPDATE ... RETURNING in the orchestrator. NO direct user access — service-role only.';

alter table public.ai_review_rate_limits enable row level security;
-- Intentionally no policies — only service-role (cost-guard / orchestrator) writes here.

-- ============================================================
-- 5. Trigger: clear verification when content changes
--    [2026-05-08] CLAUDE.md learning: SQL function bodies are NOT
--    rewritten on rename. This trigger touches no renamed objects,
--    but if you later rename sop_section_blocks columns, CREATE OR
--    REPLACE this function with the new identifiers.
-- ============================================================

create or replace function public.clear_block_verification_on_content_change()
returns trigger
language plpgsql
as $$
begin
  new.verified_by_admin_id := null;
  new.verified_at := null;
  return new;
end;
$$;

comment on function public.clear_block_verification_on_content_change() is
  'Phase 21 (00032) / D-21-08 + SCP-VERIFY-04: clears verified_by_admin_id and verified_at when block content mutates. Re-editing a block invalidates its own verification only, never other blocks. Guarded by WHEN clause on the trigger to prevent infinite loop when the only change is the verification columns themselves.';

drop trigger if exists trg_clear_block_verification on public.sop_section_blocks;

-- WHEN clause: fire ONLY when a content-bearing column actually changed.
-- This prevents recursion when the trigger writes verified_by_admin_id = NULL
-- back to NEW (the trigger's own write does not change snapshot_content or
-- pinned_version_id, so the WHEN clause filters the re-fire out).
create trigger trg_clear_block_verification
  before update on public.sop_section_blocks
  for each row
  when (
    new.snapshot_content is distinct from old.snapshot_content
    or new.pinned_version_id is distinct from old.pinned_version_id
  )
  execute function public.clear_block_verification_on_content_change();

comment on trigger trg_clear_block_verification on public.sop_section_blocks is
  'Phase 21 (00032): fires only when snapshot_content or pinned_version_id changes — never on verified_by_admin_id-only updates (loop prevention).';

commit;

-- ============================================================
-- DOWN (manual rollback — comments only; matches 00026 / 00028 convention)
-- ============================================================
-- begin;
--   drop trigger if exists trg_clear_block_verification on public.sop_section_blocks;
--   drop function if exists public.clear_block_verification_on_content_change();
--   drop table if exists public.ai_review_rate_limits;
--   drop table if exists public.org_anthropic_spend;
--   alter table public.parse_jobs drop column if exists ai_review_results;
--   drop index if exists public.idx_sop_section_blocks_verified;
--   alter table public.sop_section_blocks drop column if exists block_provenance;
--   alter table public.sop_section_blocks drop column if exists verified_at;
--   alter table public.sop_section_blocks drop column if exists verified_by_admin_id;
-- commit;
