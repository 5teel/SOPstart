-- Tool search matches part of a tool name, any case (Phase 63 matched the exact name only).
-- PostgREST cannot ilike inside a text[], so each step carries its tools as one lower-cased
-- string. array_to_string is only STABLE in general; for text[] it is immutable, hence the wrapper.

create or replace function public.tools_text(tools text[])
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$ select lower(coalesce(pg_catalog.array_to_string(tools, ' '), '')) $$;

alter table public.sop_focus_steps
  add column if not exists tools_text text
  generated always as (public.tools_text(required_tools)) stored;
