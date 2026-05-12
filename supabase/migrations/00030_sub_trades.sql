-- ============================================================
-- Migration 00030: Phase 15 Manufacturing-Line Mode — sub-trade junction schema
-- Adds:
--   1. sub_trades                — controlled-vocab seed table (D-10, D-13)
--   2. users_sub_trades          — junction (worker -> sub-trades, many-to-many)
--   3. sops_sub_trades           — junction (SOP -> sub-trades, many-to-many)
--   4. current_user_sub_trades() — SECURITY DEFINER helper for RLS
--   5. sub_trade_id_intersects() — SECURITY DEFINER helper used by policy
--   6. RLS extension on sops SELECT — sub-trade gate (empty rows = no gate)
--   7. sop_completions.step_ack_trace JSONB — D-21 sequential ack evidence
--
-- Note: project table is `sop_completions` (per migration 00010), not `completions`.
-- Plan/RESEARCH referred to `completions` — corrected here (Rule 1 — bug).
--
-- All changes are pure-additive — no existing tables, columns, or policies modified.
-- ============================================================

begin;

-- ============================================================
-- 1. sub_trades — controlled vocab table (D-10, D-13)
-- ============================================================
create table if not exists public.sub_trades (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  label       text not null,
  sort_order  int not null default 100,
  created_at  timestamptz not null default now()
);

alter table public.sub_trades enable row level security;

create policy "sub_trades_read_all" on public.sub_trades
  for select to authenticated using (true);
-- writes: service_role only — no authenticated INSERT/UPDATE/DELETE policy

comment on table public.sub_trades is
  'Phase 15: controlled vocabulary of worker sub-trades (operator/fitter/sparky/maintainer/other). Locked in 15a; admin-editable in 15b.';

-- ============================================================
-- 2. users_sub_trades junction (worker -> sub-trades, many-to-many)
-- ============================================================
create table if not exists public.users_sub_trades (
  user_id       uuid not null references auth.users(id) on delete cascade,
  sub_trade_id  uuid not null references public.sub_trades(id) on delete cascade,
  assigned_at   timestamptz not null default now(),
  assigned_by   uuid references auth.users(id),
  primary key (user_id, sub_trade_id)
);

alter table public.users_sub_trades enable row level security;

-- Workers see their own assignments; admins/safety_managers in same org see all
-- (mirrors organisation_members read pattern from 00017_multi_org_membership.sql).
create policy "users_sub_trades_self_read" on public.users_sub_trades
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.organisation_members om
      where om.user_id = auth.uid()
        and om.role in ('admin', 'safety_manager')
    )
  );
-- writes: service_role + admin server actions (via supabase admin client)

create index if not exists idx_users_sub_trades_user on public.users_sub_trades(user_id);
create index if not exists idx_users_sub_trades_subtrade on public.users_sub_trades(sub_trade_id);

comment on table public.users_sub_trades is
  'Phase 15: many-to-many junction binding workers to sub-trade vocabulary. Self-read + same-org admin/safety_manager read. Writes via admin server actions only.';

-- ============================================================
-- 3. sops_sub_trades junction (SOP -> sub-trades, many-to-many)
-- ============================================================
create table if not exists public.sops_sub_trades (
  sop_id        uuid not null references public.sops(id) on delete cascade,
  sub_trade_id  uuid not null references public.sub_trades(id) on delete cascade,
  primary key (sop_id, sub_trade_id)
);

alter table public.sops_sub_trades enable row level security;

-- If the user can SELECT the parent SOP (existing sops RLS), they can read its sub-trade tags.
create policy "sops_sub_trades_read_for_org" on public.sops_sub_trades
  for select to authenticated
  using (
    exists (
      select 1 from public.sops s
      where s.id = sops_sub_trades.sop_id
    )
  );

create index if not exists idx_sops_sub_trades_sop on public.sops_sub_trades(sop_id);

comment on table public.sops_sub_trades is
  'Phase 15: many-to-many junction binding SOPs to sub-trade vocabulary. Empty for a SOP = visible to all workers (backward compat with Phase 1-14 data).';

-- ============================================================
-- 4. current_user_sub_trades() — SECURITY DEFINER helper for RLS
-- Mirrors is_platform_admin() pattern from migration 00028.
-- ============================================================
create or replace function public.current_user_sub_trades() returns setof uuid
  language sql
  stable
  security definer
  set search_path = public
as $$
  select sub_trade_id from public.users_sub_trades where user_id = auth.uid();
$$;

comment on function public.current_user_sub_trades() is
  'Phase 15: returns sub_trade_ids assigned to the calling user. Used by sops_visible_by_sub_trade policy. CRITICAL: SQL function body references users_sub_trades by NAME — any later rename MUST recompile this function (CLAUDE.md learning 2026-05-08).';

-- ============================================================
-- 5. sub_trade_id_intersects(p_sop_id uuid) — boolean helper used by policy.
-- Kept separate from the policy for testability and reuse.
-- ============================================================
create or replace function public.sub_trade_id_intersects(p_sop_id uuid) returns boolean
  language sql
  stable
  security definer
  set search_path = public
as $$
  select exists (
    select 1
    from public.sops_sub_trades sst
    where sst.sop_id = p_sop_id
      and sst.sub_trade_id in (select * from public.current_user_sub_trades())
  );
$$;

comment on function public.sub_trade_id_intersects(uuid) is
  'Phase 15: returns true if the calling user shares at least one sub_trade with the SOP. Used by sops_visible_by_sub_trade policy. References public.sops_sub_trades by NAME — see CLAUDE.md learning 2026-05-08.';

-- ============================================================
-- 6. Seed vocabulary — exactly 5 rows (D-13)
-- ============================================================
insert into public.sub_trades (slug, label, sort_order) values
  ('operator',   'Operator',             10),
  ('fitter',     'Fitter',               20),
  ('sparky',     'Sparky / Electrician', 30),
  ('maintainer', 'Maintainer',           40),
  ('other',      'Other',                90)
on conflict (slug) do nothing;

-- ============================================================
-- 7. Extend sops SELECT RLS with sub-trade gate (D-11)
-- ADDITIVE policy: multiple permissive policies on the same command OR together.
-- Empty sops_sub_trades for a SOP = no gate (backward compat with Phase 1-14 data).
-- ============================================================
create policy "sops_visible_by_sub_trade" on public.sops
  for select to authenticated
  using (
    not exists (select 1 from public.sops_sub_trades sst where sst.sop_id = sops.id)
    or sub_trade_id_intersects(sops.id)
  );

-- ============================================================
-- 8. sop_completions.step_ack_trace JSONB (D-21)
-- Append-only completion table gains an evidence column for sequential ack clicks.
-- ============================================================
alter table public.sop_completions
  add column if not exists step_ack_trace jsonb not null default '[]'::jsonb;

comment on column public.sop_completions.step_ack_trace is
  'Phase 15 D-21: ordered list of {step_id, timestamp} ack-button clicks during walkthrough. Evidence of sequential reading. Not gated server-side in 15a (auth attribution deferred to 15b).';

commit;
