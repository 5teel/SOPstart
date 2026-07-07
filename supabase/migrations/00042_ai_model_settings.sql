-- AI Settings (admin tool): per-organisation AI model overrides.
-- One row per (organisation, use_case); use_case matches an AiModelKey in
-- src/lib/ai/registry.ts. Resolution order at runtime:
--   org setting (this table) > env var > registry default.
--
-- Writes go through the service-role server action ONLY (src/actions/ai-settings.ts),
-- which self-enforces org scope — same 00031/00036 pattern as the junction tables:
-- no authenticated INSERT/UPDATE/DELETE policy by design.

create table public.ai_model_settings (
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  use_case        text not null,
  model_id        text not null,
  updated_by      uuid references auth.users(id) on delete set null,
  updated_at      timestamptz not null default now(),
  primary key (organisation_id, use_case)
);

alter table public.ai_model_settings enable row level security;

-- Org members can read their own org's settings (non-recursive JWT-claim check,
-- same idiom as 00013 video_generation policies).
create policy ai_model_settings_read_org on public.ai_model_settings
  for select
  using (organisation_id = (auth.jwt()->'app_metadata'->>'organisation_id')::uuid);
