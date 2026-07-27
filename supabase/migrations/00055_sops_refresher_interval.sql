-- ============================================================
-- Migration 00055: sops.refresher_interval_months (Phase 36 REF-01/REF-02)
--
-- Adds a per-SOP, nullable, range-constrained refresher interval — the
-- WORKER's re-walkthrough clock. This is DELIBERATELY SEPARATE from
-- sop_review_cadences (the DOCUMENT's review clock, Phase 28): a SOP can
-- have a 12-month document review cadence and a 6-month worker refresher,
-- or no refresher at all.
--
-- D-02: NULL means no refresher, ever — there is no org default and no
-- category default for this column. NULL must never be coerced to a
-- default anywhere downstream (src/lib/competency/refresher.ts enforces
-- this at the pure-function layer).
--
-- No new RLS policy: "admins_can_update_sops" (00003, org + admin/
-- safety_manager) already gates writes to any additive column on sops,
-- and "org_members_can_view_sops" already gates org-wide reads — same
-- precedent migration 00043 relied on for owner_user_id/review_due_at.
-- ============================================================

alter table public.sops
  add column if not exists refresher_interval_months integer;

comment on column public.sops.refresher_interval_months is
  'Phase 36 REF-01/REF-02: worker re-walkthrough cadence in months. Deliberately separate from sop_review_cadences (the document review clock). D-02: NULL = no refresher at all, no org/category default fallback — never coerce NULL to a default.';

alter table public.sops
  drop constraint if exists sops_refresher_interval_months_range;

alter table public.sops
  add constraint sops_refresher_interval_months_range
  check (refresher_interval_months is null or (refresher_interval_months between 1 and 120));
