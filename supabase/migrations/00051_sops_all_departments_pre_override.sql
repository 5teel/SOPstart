-- ============================================================
-- Migration 00051: Phase 33 WR-02 closure — snapshot column to fix the
-- one-way all_departments visibility ratchet in materializeSopAccessForOrg.
--
-- When a SOP gains its first SOP-target grant, materializeSopAccessForOrg
-- (src/actions/grants.ts) force-writes all_departments=false (correct --
-- closes the 00035 org-wide-visibility bypass). But when the LAST
-- SOP-target grant is revoked, there was no restore branch: a pre-Phase-32
-- org-wide SOP (all_departments=true, in a collection carrying no grants --
-- the default state for any org that never opened the Access map) went
-- silently invisible to every worker after one override->revoke round trip.
--
-- Fix: snapshot the pre-override all_departments value on first override,
-- restore it on re-follow. A snapshot column is the only way to
-- distinguish a legacy org-wide SOP (was true) from a collection-following
-- SOP (was false) -- both hit the same re-follow-resolves-to-empty path,
-- but only the org-wide one should regain org-wide visibility.
--
-- Additive and non-destructive: no backfill. NULL is correct for every
-- existing row -- none are mid-override at migration time (00050 that
-- introduced SOP-target grants has not yet been used to materialize any
-- override in production).
-- ============================================================

begin;

alter table public.sops
  add column if not exists all_departments_pre_override boolean;

comment on column public.sops.all_departments_pre_override is
  'Phase 33 (00051, WR-02): snapshot of all_departments captured when this SOP first gains a SOP-target grant (narrowing override). Restored to all_departments and cleared to NULL when the last SOP-target grant is revoked (re-follow). NULL means "not currently overridden -- no snapshot outstanding".';

commit;
