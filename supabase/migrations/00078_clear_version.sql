-- ADR-0015: the clear version of a SOP. The sections and steps stay the direct translation
-- (the record runs, photos and sign-offs attach to); the clear version is a read-only rewrite
-- stored beside it, shown to workers only once an admin approves it.
alter table public.sops
  add column if not exists clear_version jsonb,
  add column if not exists clear_approved_at timestamptz,
  add column if not exists clear_approved_by uuid references auth.users(id) on delete set null;
