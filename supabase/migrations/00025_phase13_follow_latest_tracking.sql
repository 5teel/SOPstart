-- Migration 00025: Phase 13 follow-latest tracking — block update propagation trigger + decision audit
--
-- NOTE: Plan 13-04 originally specified filename 00024 but that slot was
-- consumed by 13-03's reorder RPC migration (already pushed to live Supabase).
-- This file is functionally identical to the planned 00024 — the integer
-- prefix is bumped to 00025 to keep the migration sequence linear.
--
-- Closes the follow-latest update loop (SB-BLOCK-05 runtime + SB-BLOCK-06):
--   1. AFTER INSERT trigger on block_versions flips sop_section_blocks.update_available=true
--      for every junction row in 'follow_latest' mode whose pinned_version_id != new.id
--      and which has not previously declined this exact version.
--   2. sop_block_update_decisions audit table records accept/decline decisions
--      append-only (no UPDATE/DELETE policy).
--   3. accept_block_update / decline_block_update SECURITY DEFINER helpers
--      with explicit role + org defence-in-depth checks.
-- ============================================================

begin;

-- ============================================================
-- 1. Audit table for accept/decline decisions
-- Append-only history so the same update doesn't re-prompt and Summit
-- has visibility into how orgs respond to global block updates.
-- ============================================================
create table if not exists public.sop_block_update_decisions (
  id uuid primary key default gen_random_uuid(),
  sop_section_block_id uuid not null references public.sop_section_blocks(id) on delete cascade,
  block_version_id uuid not null references public.block_versions(id) on delete cascade,
  decision text not null check (decision in ('accept','decline')),
  decided_by uuid references auth.users(id),
  decided_at timestamptz not null default now(),
  note text
);

create index if not exists idx_block_update_decisions_ssb
  on public.sop_block_update_decisions (sop_section_block_id, decided_at desc);

alter table public.sop_block_update_decisions enable row level security;

-- Decisions visible to org admins of the parent SOP
create policy "block_update_decisions_read"
  on public.sop_block_update_decisions for select to authenticated
  using (exists (
    select 1 from public.sop_section_blocks ssb
    join public.sop_sections sec on sec.id = ssb.sop_section_id
    join public.sops sop on sop.id = sec.sop_id
    where ssb.id = sop_block_update_decisions.sop_section_block_id
      and sop.organisation_id = public.current_organisation_id()
  ));

create policy "block_update_decisions_insert"
  on public.sop_block_update_decisions for insert to authenticated
  with check (exists (
    select 1 from public.sop_section_blocks ssb
    join public.sop_sections sec on sec.id = ssb.sop_section_id
    join public.sops sop on sop.id = sec.sop_id
    where ssb.id = sop_block_update_decisions.sop_section_block_id
      and sop.organisation_id = public.current_organisation_id()
      and public.current_user_role() in ('admin','safety_manager')
  ));

-- Append-only — no UPDATE/DELETE policy (matches sop_completions pattern from Phase 4)

comment on table public.sop_block_update_decisions is
  'Phase 13 plan 13-04: append-only audit of accept/decline decisions on block updates. '
  'Indexed by sop_section_block_id; visibility scoped to the SOP''s organisation via RLS.';

-- ============================================================
-- 2. propagate_block_update — AFTER INSERT trigger on block_versions
-- ============================================================
create or replace function public.propagate_block_update() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  -- Mark every follow-latest junction row referencing this block as needing review,
  -- EXCEPT junction rows already pinned to this exact new version (e.g. fresh add)
  -- and EXCEPT rows that have already declined this exact version (idempotent).
  update public.sop_section_blocks ssb
     set update_available = true,
         updated_at = now()
   where ssb.block_id = new.block_id
     and ssb.pin_mode = 'follow_latest'
     and (ssb.pinned_version_id is null or ssb.pinned_version_id <> new.id)
     and not exists (
       select 1 from public.sop_block_update_decisions d
        where d.sop_section_block_id = ssb.id
          and d.block_version_id = new.id
          and d.decision = 'decline'
     );
  return new;
end;
$$;

drop trigger if exists trg_propagate_block_update on public.block_versions;
create trigger trg_propagate_block_update
  after insert on public.block_versions
  for each row execute function public.propagate_block_update();

comment on function public.propagate_block_update() is
  'Phase 13 plan 13-04: fires after each block_versions insert. Flips '
  'sop_section_blocks.update_available=true on every follow-latest junction '
  'row (except already-declined). Boolean only — no content copied.';

-- ============================================================
-- 3. accept_block_update — SECURITY DEFINER RPC for the publish-gate accept path
-- Updates snapshot_content + pinned_version_id + clears update_available + audits.
-- ============================================================
create or replace function public.accept_block_update(
  p_sop_section_block_id uuid,
  p_new_version_id uuid,
  p_note text default null
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_role text := public.current_user_role();
  v_org uuid := public.current_organisation_id();
  v_section_org uuid;
  v_new_content jsonb;
begin
  if v_role not in ('admin','safety_manager') then
    raise exception 'Admin access required';
  end if;
  -- Verify caller is in the org owning this SOP (defence vs guessed UUIDs)
  select sop.organisation_id into v_section_org
    from public.sop_section_blocks ssb
    join public.sop_sections sec on sec.id = ssb.sop_section_id
    join public.sops sop on sop.id = sec.sop_id
   where ssb.id = p_sop_section_block_id;
  if v_section_org is null or v_section_org <> v_org then
    raise exception 'Not authorised for this SOP';
  end if;
  -- Fetch new version content
  select content into v_new_content from public.block_versions where id = p_new_version_id;
  if v_new_content is null then raise exception 'Version not found'; end if;
  -- Apply the update
  update public.sop_section_blocks
     set snapshot_content = v_new_content,
         pinned_version_id = p_new_version_id,
         update_available = false,
         updated_at = now()
   where id = p_sop_section_block_id;
  -- Audit
  insert into public.sop_block_update_decisions (sop_section_block_id, block_version_id, decision, decided_by, note)
    values (p_sop_section_block_id, p_new_version_id, 'accept', v_user, p_note);
end;
$$;

grant execute on function public.accept_block_update(uuid, uuid, text) to authenticated;

comment on function public.accept_block_update(uuid, uuid, text) is
  'Phase 13 plan 13-04: applies a follow-latest update to a junction row. '
  'SECURITY DEFINER with explicit role+org checks. Writes snapshot_content + '
  'pinned_version_id, clears update_available, and inserts an accept audit row.';

-- ============================================================
-- 4. decline_block_update — SECURITY DEFINER RPC for the decline path
-- Keeps existing snapshot, sets overridden_at, records the decline.
-- ============================================================
create or replace function public.decline_block_update(
  p_sop_section_block_id uuid,
  p_new_version_id uuid,
  p_note text default null
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_role text := public.current_user_role();
  v_org uuid := public.current_organisation_id();
  v_section_org uuid;
begin
  if v_role not in ('admin','safety_manager') then
    raise exception 'Admin access required';
  end if;
  select sop.organisation_id into v_section_org
    from public.sop_section_blocks ssb
    join public.sop_sections sec on sec.id = ssb.sop_section_id
    join public.sops sop on sop.id = sec.sop_id
   where ssb.id = p_sop_section_block_id;
  if v_section_org is null or v_section_org <> v_org then
    raise exception 'Not authorised for this SOP';
  end if;
  update public.sop_section_blocks
     set update_available = false,
         overridden_at = now(),
         updated_at = now()
   where id = p_sop_section_block_id;
  insert into public.sop_block_update_decisions (sop_section_block_id, block_version_id, decision, decided_by, note)
    values (p_sop_section_block_id, p_new_version_id, 'decline', v_user, p_note);
end;
$$;

grant execute on function public.decline_block_update(uuid, uuid, text) to authenticated;

comment on function public.decline_block_update(uuid, uuid, text) is
  'Phase 13 plan 13-04: declines a follow-latest update. SECURITY DEFINER with '
  'explicit role+org checks. Clears update_available, sets overridden_at, and '
  'inserts a decline audit row so the same version will not re-trigger the badge.';

commit;
