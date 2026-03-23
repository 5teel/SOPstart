-- ORGANISATIONS policies
-- Authenticated users can view their own org
create policy "users_can_view_own_org"
  on public.organisations for select
  to authenticated
  using (id = public.current_organisation_id());

-- Allow insert for org registration (user has no org yet, so service_role handles this via admin client)
-- Org creation is done via the admin client (service_role), not via RLS-authenticated queries

-- ORGANISATION_MEMBERS policies
-- Members can view their own org's members
create policy "org_members_can_view_own_org"
  on public.organisation_members for select
  to authenticated
  using (organisation_id = public.current_organisation_id());

-- Admins can insert new members into their org
create policy "admins_can_insert_members"
  on public.organisation_members for insert
  to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() in ('admin', 'safety_manager')
  );

-- Admins can update roles within their org
create policy "admins_can_update_member_roles"
  on public.organisation_members for update
  to authenticated
  using (organisation_id = public.current_organisation_id())
  with check (public.current_user_role() = 'admin');

-- SUPERVISOR_ASSIGNMENTS policies
-- Members can view supervisor assignments in their org
create policy "org_members_can_view_assignments"
  on public.supervisor_assignments for select
  to authenticated
  using (organisation_id = public.current_organisation_id());

-- Admins can manage supervisor assignments
create policy "admins_can_manage_assignments"
  on public.supervisor_assignments for insert
  to authenticated
  with check (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() = 'admin'
  );

create policy "admins_can_delete_assignments"
  on public.supervisor_assignments for delete
  to authenticated
  using (
    organisation_id = public.current_organisation_id()
    and public.current_user_role() = 'admin'
  );
