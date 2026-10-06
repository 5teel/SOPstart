-- Site templates (ADR-0003): a layout made from a template records which one.
-- The template's room positions live in code (src/lib/site/rooms.ts
-- PRESET_ROOMS); null keeps the default room table. No admin positions a room.
alter table public.site_layouts
  add column if not exists preset text
  check (preset is null or preset in ('railway', 'training', 'kitchen', 'bottling'));
