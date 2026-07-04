-- ============================================================
-- 00040 — Agent Metadata Layer schema (Phase 26.5 Plan 02, D-01/D-02/D-03/D-05/D-07/D-08)
--
-- Ships the entire agent-layer data model as one additive migration:
--   1. pgvector extension enablement
--   2. sop_agent_metadata      — SOP-level summary/tags/entities/embedding/assessment (D-01/D-03)
--   3. block_agent_metadata    — block-level tags/entities/embedding, keyed by the
--                                sop_section_blocks junction id (D-02 junction identity)
--   4. agent_memory            — append-only per-SOP + org-wide observations (D-05/D-08)
--   5. agent_learning_proposals — evidence-backed proposals extending the X-03
--                                pending-approval spine as a SIBLING table, not a
--                                shared row shape (D-07 — RESEARCH Alternatives Considered)
--   6. sop_voice_qa_log        — voice Q&A transcript persistence (closes the RESEARCH
--                                Pitfall 1 gap — this signal source did not exist before)
--   7. match_sop_agent_metadata — SECURITY DEFINER pgvector similarity RPC (Pitfall 3)
--
-- Security model (copied EXACTLY from 00038/00039 precedent):
--   Append-only via service role: NO authenticated INSERT/UPDATE/DELETE policy on
--   any of the 5 tables. Writes go through createAdminClient() in agent-layer
--   server actions/synthesis pipeline (Plans 26.5-03..08), which MUST self-enforce
--   org-scoping (service-role bypasses RLS) per CLAUDE.md 2026-06-15/2026-06-26.
--
--   RLS SELECT: direct current_organisation_id() only — ZERO cross-table join to
--   public.sops or any other table. CRITICAL: referencing public.sops from a
--   policy body risks 42P17 infinite recursion (CLAUDE.md 2026-05-13 learning;
--   RESEARCH Pitfall — same class already bit this codebase twice). FKs to sops /
--   sop_section_blocks are data-integrity constraints, NOT policy predicates —
--   they do not recurse.
-- ============================================================

create extension if not exists vector;

-- ============================================================
-- 1. sop_agent_metadata — SOP-level machine layer (D-01/D-03/D-12)
-- ============================================================
create table if not exists public.sop_agent_metadata (
  id                     uuid primary key default gen_random_uuid(),
  organisation_id        uuid not null references public.organisations(id) on delete cascade,
  sop_id                 uuid not null references public.sops(id) on delete cascade,
  summary                text,
  tags                   text[] not null default '{}',
  entities               jsonb not null default '[]'::jsonb,
  embedding              vector(1024),
  assessment             text not null default 'fresh' check (assessment in ('fresh', 'drifting', 'needs-review')),
  links                  jsonb not null default '[]'::jsonb,
  last_synthesis_status  text,
  last_synthesis_error   text,
  regenerated_at         timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.sop_agent_metadata enable row level security;

-- SELECT: org-scoped read — direct current_organisation_id(), NO cross-table join.
-- CRITICAL: do NOT reference public.sops from this policy — 42P17 recursion risk
-- (CLAUDE.md 2026-05-13; T-26.5-02-02).
create policy "sop_agent_metadata_org_read" on public.sop_agent_metadata
  for select to authenticated
  using (organisation_id = public.current_organisation_id());

-- NO authenticated INSERT/UPDATE/DELETE policy (T-26.5-02-01/02).
-- Writes via createAdminClient() in the synthesis pipeline (Plan 26.5-04), which
-- self-enforces row.organisation_id === caller org (CLAUDE.md 2026-06-15).

create index if not exists idx_sop_agent_metadata_org on public.sop_agent_metadata(organisation_id);
create unique index if not exists idx_sop_agent_metadata_sop on public.sop_agent_metadata(sop_id);
create index if not exists idx_sop_agent_metadata_embedding on public.sop_agent_metadata
  using hnsw (embedding vector_cosine_ops);

comment on table public.sop_agent_metadata is
  'Phase 26.5 D-01/D-03/D-12: SOP-level agent metadata (summary/tags/entities/embedding/assessment). Append-only — no authenticated write policy; writes via createAdminClient() in the synthesis pipeline with self-enforced org-scope (CLAUDE.md 2026-06-15). RLS SELECT uses current_organisation_id() directly — no cross-table reference to avoid 42P17 (CLAUDE.md 2026-05-13).';

-- ============================================================
-- 2. block_agent_metadata — block-level machine layer, keyed by junction id (D-02)
-- ============================================================
create table if not exists public.block_agent_metadata (
  id                uuid primary key default gen_random_uuid(),
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  block_id          uuid not null references public.sop_section_blocks(id) on delete cascade,
  sop_id            uuid references public.sops(id) on delete cascade,
  tags              text[] default '{}',
  entities          jsonb default '[]'::jsonb,
  embedding         vector(1024),
  regenerated_at    timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.block_agent_metadata enable row level security;

-- SELECT: org-scoped read — direct current_organisation_id(), NO cross-table join.
-- CRITICAL: do NOT reference public.sops / public.sop_section_blocks from this
-- policy — 42P17 recursion risk (CLAUDE.md 2026-05-13; T-26.5-02-02).
create policy "block_agent_metadata_org_read" on public.block_agent_metadata
  for select to authenticated
  using (organisation_id = public.current_organisation_id());

-- NO authenticated INSERT/UPDATE/DELETE policy.
-- Writes via createAdminClient() in the synthesis pipeline, self-enforced org-scope.

create index if not exists idx_block_agent_metadata_org on public.block_agent_metadata(organisation_id);
create unique index if not exists idx_block_agent_metadata_block on public.block_agent_metadata(block_id);
create index if not exists idx_block_agent_metadata_sop on public.block_agent_metadata(sop_id);
create index if not exists idx_block_agent_metadata_embedding on public.block_agent_metadata
  using hnsw (embedding vector_cosine_ops);

comment on table public.block_agent_metadata is
  'Phase 26.5 D-02/D-03: block-level agent metadata keyed by the sop_section_blocks junction id (same identity provenance verify-state already uses). Append-only — no authenticated write policy; writes via createAdminClient() with self-enforced org-scope (CLAUDE.md 2026-06-15). RLS SELECT uses current_organisation_id() directly — no cross-table reference to avoid 42P17 (CLAUDE.md 2026-05-13).';

-- ============================================================
-- 3. agent_memory — append-only per-SOP + org-wide observations (D-05/D-06/D-08)
-- ============================================================
create table if not exists public.agent_memory (
  id                uuid primary key default gen_random_uuid(),
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  sop_id            uuid references public.sops(id) on delete set null,
  scope             text not null check (scope in ('sop', 'org')),
  observation       text not null,
  signal_source     text,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

alter table public.agent_memory enable row level security;

-- SELECT: org-scoped read — direct current_organisation_id(), NO cross-table join.
-- CRITICAL: do NOT reference public.sops from this policy — 42P17 recursion risk
-- (CLAUDE.md 2026-05-13; T-26.5-02-02).
create policy "agent_memory_org_read" on public.agent_memory
  for select to authenticated
  using (organisation_id = public.current_organisation_id());

-- NO authenticated INSERT/UPDATE/DELETE policy (D-08 — free append-only, no
-- approval gate, but still service-role-only write). Writes via
-- createAdminClient() in the synthesis pipeline, self-enforced org-scope.

create index if not exists idx_agent_memory_org on public.agent_memory(organisation_id);
create index if not exists idx_agent_memory_sop on public.agent_memory(sop_id);

comment on table public.agent_memory is
  'Phase 26.5 D-05/D-06/D-08: append-only agent observations, per-SOP or org-wide (scope column). Free-append — no approval gate, but still writes-via-service-role-only (no authenticated write policy). RLS SELECT uses current_organisation_id() directly — no cross-table reference to avoid 42P17 (CLAUDE.md 2026-05-13).';

-- ============================================================
-- 4. agent_learning_proposals — evidence-backed proposals, sibling to ai_field_proposals (D-07)
-- ============================================================
create table if not exists public.agent_learning_proposals (
  id                uuid primary key default gen_random_uuid(),
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  sop_id            uuid references public.sops(id) on delete cascade,
  kind              text not null,
  description       text not null,
  evidence          jsonb not null default '[]'::jsonb,
  status            text not null default 'pending' check (status in ('pending', 'applied', 'rejected')),
  reviewed_by       uuid references auth.users(id),
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now()
);

alter table public.agent_learning_proposals enable row level security;

-- SELECT: org-scoped read — direct current_organisation_id(), NO cross-table join.
-- CRITICAL: do NOT reference public.sops from this policy — 42P17 recursion risk
-- (CLAUDE.md 2026-05-13; T-26.5-02-02).
create policy "agent_learning_proposals_org_read" on public.agent_learning_proposals
  for select to authenticated
  using (organisation_id = public.current_organisation_id());

-- NO authenticated INSERT/UPDATE/DELETE policy.
-- Writes via createAdminClient() in createLearningProposal / approve / decline
-- server actions (Plan 26.5-07), self-enforced org-scope.

create index if not exists idx_agent_learning_proposals_org_status
  on public.agent_learning_proposals(organisation_id, status);
create index if not exists idx_agent_learning_proposals_sop on public.agent_learning_proposals(sop_id);

comment on table public.agent_learning_proposals is
  'Phase 26.5 D-07: evidence-backed learning proposals — a SIBLING table to ai_field_proposals (00038), not a shared row shape, because ai_field_proposals.field_id/context are single-field-write-specific. Every proposal is always-pending (no auto-apply tier). No authenticated write policy — writes via createAdminClient() with self-enforced org-scope (CLAUDE.md 2026-06-15). RLS SELECT uses current_organisation_id() directly — no cross-table reference to avoid 42P17 (CLAUDE.md 2026-05-13).';

-- ============================================================
-- 5. sop_voice_qa_log — voice Q&A transcript persistence (closes RESEARCH Pitfall 1)
-- ============================================================
create table if not exists public.sop_voice_qa_log (
  id                uuid primary key default gen_random_uuid(),
  organisation_id   uuid not null references public.organisations(id) on delete cascade,
  sop_id            uuid not null references public.sops(id) on delete cascade,
  user_id           uuid references auth.users(id),
  question          text not null,
  answer            text,
  citations         jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now()
);

alter table public.sop_voice_qa_log enable row level security;

-- SELECT: org-scoped read — direct current_organisation_id(), NO cross-table join.
-- CRITICAL: do NOT reference public.sops from this policy — 42P17 recursion risk
-- (CLAUDE.md 2026-05-13; T-26.5-02-02).
create policy "sop_voice_qa_log_org_read" on public.sop_voice_qa_log
  for select to authenticated
  using (organisation_id = public.current_organisation_id());

-- NO authenticated INSERT/UPDATE/DELETE policy.
-- Writes via createAdminClient() in /api/voice/query/route.ts (Plan 26.5-03),
-- self-enforced org-scope.

create index if not exists idx_sop_voice_qa_log_org on public.sop_voice_qa_log(organisation_id);
create index if not exists idx_sop_voice_qa_log_sop on public.sop_voice_qa_log(sop_id);

comment on table public.sop_voice_qa_log is
  'Phase 26.5 D-06: voice Q&A transcript log (question/answer/citations) — the previously-missing signal source #3 (RESEARCH Pitfall 1; /api/voice/query/route.ts was stateless before this). Append-only — no authenticated write policy; writes via createAdminClient() with self-enforced org-scope (CLAUDE.md 2026-06-15). RLS SELECT uses current_organisation_id() directly — no cross-table reference to avoid 42P17 (CLAUDE.md 2026-05-13).';

-- ============================================================
-- 6. match_sop_agent_metadata — pgvector similarity RPC (D-03, Pitfall 3)
--
-- PostgREST cannot express the <=> operator directly — wrap in a SECURITY
-- DEFINER function (mirrors current_user_sub_trades()/sub_trade_id_intersects()
-- from migration 00030). SECURITY DEFINER bypasses RLS, so the org filter
-- INSIDE the function body is the self-enforcement (same discipline as every
-- service-role write in this codebase — CLAUDE.md 2026-06-15/2026-06-26).
-- ============================================================
create or replace function public.match_sop_agent_metadata(
  p_organisation_id uuid,
  query_embedding vector(1024),
  match_count int default 10
)
returns table (sop_id uuid, similarity float)
language sql stable security definer
as $$
  select sop_id, 1 - (embedding <=> query_embedding) as similarity
  from public.sop_agent_metadata
  where organisation_id = p_organisation_id
  order by embedding <=> query_embedding
  limit match_count
$$;

comment on function public.match_sop_agent_metadata is
  'Phase 26.5 D-03: pgvector cosine-similarity search over sop_agent_metadata.embedding. SECURITY DEFINER bypasses RLS — the organisation_id = p_organisation_id filter inside this body IS the self-enforcement (CLAUDE.md 2026-06-15/2026-06-26 learnings). Called via supabase.rpc(), never via .select() (PostgREST cannot express the <=> operator).';
