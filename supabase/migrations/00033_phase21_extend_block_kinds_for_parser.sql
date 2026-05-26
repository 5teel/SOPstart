-- ============================================================
-- Phase 21 Plan 21-05 — extend section_kinds catalog for parser
-- ============================================================
--
-- Background: Plan 21-05 wires the parse pipeline to create library blocks
-- + sop_section_blocks junction rows per emitted Puck item so the verify
-- checklist (Wave 4 publish gate) is no longer a `0 === 0` no-op for parsed
-- SOPs. The 7 new Puck registry kinds that the converter emits but were
-- never in the library catalog need global section_kinds rows so the
-- builder picker UI and the parser's createBlock() invocations can resolve
-- them by slug.
--
-- No schema change — blocks.kind_slug is text (not an FK). This migration
-- is pure seed data, fully idempotent via ON CONFLICT DO NOTHING. Safe to
-- re-run.
--
-- The full surface of slugs the parser now emits:
--   pre-existing (00019 / 13 / 21):
--     hazards, ppe, steps, emergency, signoff, content, custom,
--     measurement, decision, escalate, zone, inspect, voice-note
--   new (this migration — match Puck registry kinds in puck-config.tsx):
--     text, heading, photo, callout, model, step_with_photos, photo_grid

insert into public.section_kinds (
  organisation_id, slug, display_name, render_family, icon, color_family, render_priority, description
) values
  (null, 'text',              'Text',              'content',  'Type',       'steel-100',    35,
   'Free-form narrative text rendered as a paragraph block. Emitted by the parser for section.content with no steps.'),
  (null, 'heading',           'Heading',           'content',  'Heading',    'steel-100',    32,
   'Subsection heading (h2 / h3). Emitted by the parser to label unanchored figure groups.'),
  (null, 'photo',              'Photo',             'content',  'Image',      'steel-100',    36,
   'Single photograph with optional caption. Authored inline in the builder.'),
  (null, 'callout',            'Callout',           'content',  'AlertCircle','steel-100',    37,
   'Title + body callout (notes, warnings, cautions, tips). Parser emits one per step.warning/caution/tip.'),
  (null, 'model',              '3D Model',          'content',  'Box',        'steel-100',    80,
   '3D model viewer (Three.js, feature-flagged). Inline only; never parsed from source docs.'),
  (null, 'step_with_photos',   'Step with Photos',  'steps',    'ListChecks', 'brand-yellow', 41,
   'A procedural step rendered next to one or more photos. Parser emits this when the step has image_indexes attached.'),
  (null, 'photo_grid',         'Photo Grid',        'content',  'Grid3x3',    'steel-100',    38,
   'A responsive grid of photos. Parser emits this for orphan images that could not be re-anchored to a specific step.')
on conflict do nothing;

-- Verification (informational comment only):
--   select count(*) from public.section_kinds
--   where organisation_id is null
--     and slug in ('text','heading','photo','callout','model','step_with_photos','photo_grid');
--   -- expected: 7 after first apply; remains 7 on re-apply (ON CONFLICT DO NOTHING).
