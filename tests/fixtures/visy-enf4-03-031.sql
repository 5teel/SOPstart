-- Phase 15 / Wave 0 — Seed fixture for Phase 15 voice grounding tests + final Visy demo prep.
--
-- Inserts the Visy ENF4-03-031 Blank Side Hanger SOP with three sections
-- (Overview, Hazards, Steps) and at least three sop_steps. The Hazards
-- section mentions "heat-resistant gloves" so the SB-LINE-04 voice
-- grounding test ("What PPE do I need for this procedure?") has a real
-- target to cite.
--
-- Idempotent: uses fixed UUIDs declared at the top; re-running deletes the
-- prior fixture rows before inserting. Wave 1-4 plans MAY extend this file
-- with more sections / sop_section_blocks once the demo wedge is fleshed
-- out — keep the UUIDs stable.
--
-- Usage:
--   psql "$DATABASE_URL" -f tests/fixtures/visy-enf4-03-031.sql
--
-- The org_id below MUST exist in the target instance (point to a test org).
-- Wave 4 UAT prep script will swap in the real Visy org id before demo.

\set sop_id              'aaaaaaaa-0000-4000-8000-000000000001'
\set org_id              'aaaaaaaa-0000-4000-8000-000000000000'
\set section_overview_id 'aaaaaaaa-0000-4000-8000-000000000010'
\set section_hazards_id  'aaaaaaaa-0000-4000-8000-000000000011'
\set section_steps_id    'aaaaaaaa-0000-4000-8000-000000000012'
\set step_1_id           'aaaaaaaa-0000-4000-8000-000000000020'
\set step_2_id           'aaaaaaaa-0000-4000-8000-000000000021'
\set step_3_id           'aaaaaaaa-0000-4000-8000-000000000022'

begin;

-- Tear down any prior fixture rows so the file is re-runnable.
delete from sop_steps where sop_id = :'sop_id';
delete from sop_sections where sop_id = :'sop_id';
delete from sops where id = :'sop_id';

-- SOP record. Status published so the worker walkthrough is reachable.
insert into sops (
  id,
  organisation_id,
  title,
  status,
  version,
  created_at,
  updated_at
) values (
  :'sop_id',
  :'org_id',
  'ENF4-03-031 Blank Side Hanger',
  'published',
  1,
  now(),
  now()
);

-- Three sections in expected reading order.
insert into sop_sections (id, sop_id, type, title, content, sort_order, approved, confidence)
values
  (
    :'section_overview_id',
    :'sop_id',
    'overview',
    'Overview',
    'Procedure for fitting blank side hangers on the ENF4 line. Operator must have completed onboarding before performing this task.',
    0,
    true,
    0.95
  ),
  (
    :'section_hazards_id',
    :'sop_id',
    'hazards',
    'Hazards & PPE',
    'PPE required: heat-resistant gloves, safety glasses, hi-vis vest. Hot surfaces are present on the line — keep hands clear of the dwell section until the green ready light is lit.',
    1,
    true,
    0.97
  ),
  (
    :'section_steps_id',
    :'sop_id',
    'steps',
    'Steps',
    'Sequential walkthrough steps for fitting the blank side hanger.',
    2,
    true,
    0.93
  );

-- Three steps so SB-LINE-02 sequential gate has > 2 transitions to exercise.
insert into sop_steps (id, sop_id, section_id, text, warning, sort_order)
values
  (
    :'step_1_id',
    :'sop_id',
    :'section_steps_id',
    'Confirm the line is at idle and the green ready light is lit before approaching the dwell section.',
    'Do not approach the dwell section while the amber heat-warning lamp is active.',
    0
  ),
  (
    :'step_2_id',
    :'sop_id',
    :'section_steps_id',
    'Don heat-resistant gloves and safety glasses. Visually inspect the side-hanger blank for cracks before mounting.',
    null,
    1
  ),
  (
    :'step_3_id',
    :'sop_id',
    :'section_steps_id',
    'Mount the blank side hanger onto the carrier pin, rotate clockwise until the lock-tab clicks, and confirm engagement with a gentle tug.',
    null,
    2
  );

commit;
