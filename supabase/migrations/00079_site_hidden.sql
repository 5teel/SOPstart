-- A site an admin has hidden: it leaves every member's site picker and cannot be switched to
-- (Settings → Sites in the picker). Members keep their membership and the site keeps its data.
alter table public.organisations
  add column if not exists hidden_from_picker boolean not null default false;
