-- ============================================================
-- 00039 — sop_image_annotations (Phase 26 / Plan 26-05, D-03 / R5)
--
-- Scene store for the Konva diagram annotator: one row per annotated image,
-- holding the editable Konva scene (jsonb), the source image's natural pixel
-- dimensions (for scaling the stage), and — once published — the baked flat
-- PNG's storage path + bake timestamp.
--
-- Security model (copied EXACTLY from 00038 sop_completion_signatures):
--   Append-only via service role: NO authenticated INSERT/UPDATE/DELETE policy.
--   Writes go through createAdminClient() in the saveAnnotation server action
--   (Plan 26-13), which MUST self-enforce org-scoping (service-role bypasses
--   RLS) per CLAUDE.md 2026-06-15/2026-06-26 learnings.
--
--   RLS SELECT: direct current_organisation_id() only — ZERO cross-table join
--   to public.sops / public.sop_images. CRITICAL: referencing public.sops from
--   this policy risks 42P17 infinite recursion (CLAUDE.md 2026-05-13 learning;
--   26-RESEARCH / T-26-05-01). The FK to sop_images is a data-integrity
--   constraint, NOT a policy predicate — it does not recurse.
-- ============================================================
create table if not exists public.sop_image_annotations (
  id                  uuid primary key default gen_random_uuid(),
  organisation_id     uuid not null references public.organisations(id) on delete cascade,
  sop_image_id        uuid not null references public.sop_images(id) on delete cascade,
  scene               jsonb not null,
  natural_width       int,
  natural_height      int,
  baked_storage_path  text,
  baked_at            timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.sop_image_annotations enable row level security;

-- SELECT: org-scoped read — direct current_organisation_id(), NO cross-table join.
-- CRITICAL: do NOT reference public.sops / public.sop_images from this policy —
-- 42P17 recursion risk (CLAUDE.md 2026-05-13; T-26-05-01).
create policy "sop_image_annotations_org_read" on public.sop_image_annotations
  for select to authenticated
  using (organisation_id = public.current_organisation_id());

-- NO authenticated INSERT/UPDATE/DELETE policy (T-26-05-02).
-- Writes via createAdminClient() in the saveAnnotation server action (Plan 26-13),
-- which self-enforces row.organisation_id === caller org (CLAUDE.md 2026-06-15).

create index if not exists idx_sop_image_annotations_org
  on public.sop_image_annotations(organisation_id);
create index if not exists idx_sop_image_annotations_image
  on public.sop_image_annotations(sop_image_id);

comment on table public.sop_image_annotations is
  'Phase 26 D-03: Konva annotation scene store (scene jsonb + natural dims + baked PNG path), one row per annotated sop_image. Append-only — no authenticated write policy; writes via createAdminClient() in saveAnnotation server action with self-enforced org-scope (CLAUDE.md 2026-06-15). RLS SELECT uses current_organisation_id() directly — no cross-table reference to avoid 42P17 (CLAUDE.md 2026-05-13).';
