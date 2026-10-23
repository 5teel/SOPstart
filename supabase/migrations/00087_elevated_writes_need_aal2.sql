-- Phase 66 / ADR-0028, part 2 of 2: every policy arm that grants an admin or safety manager a
-- write now needs public.is_elevated() (role re-checked from the membership row AND an aal2
-- session). Applied only after the app with /verify and the aal2 guards was live, and after the
-- eval session helper minted aal2 for elevated fixtures.
--
-- Generated from the live pg_policies text (scripts/apply-phase66-migration.mjs --audit lists
-- it), so each expression is the deployed one with only the role arm swapped:
--   * admin/safety_manager arm            -> public.is_elevated()
--   * admin-only arm                      -> public.is_elevated() AND role = admin
--   * supervisor/admin/safety_manager arm -> role = supervisor OR public.is_elevated()
--   * the sign-off approver arm keeps working at aal1 for supervisors and workers only: an
--     approver who is an admin or safety manager must be aal2 like any other elevated write
--   * the om.role EXISTS arms (areas, collections, departments, roles) -> public.is_elevated(),
--     which also scopes the role to the session organisation (the EXISTS did not)
-- SELECT policies are untouched, and each ALL policy gets a SELECT twin with its old predicate,
-- so reads stay at aal1 (an elevated person still uses the worker side before the second step).
-- Rollback: scripts/apply-phase66-rollback.sql (node scripts/apply-phase66-migration.mjs --rollback).

-- public.areas: DELETE
alter policy "areas_admin_delete" on public.areas
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.areas: INSERT
alter policy "areas_admin_insert" on public.areas
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.areas: UPDATE
alter policy "areas_admin_update" on public.areas
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()))
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.block_versions: INSERT
alter policy "block_versions_admin_insert_own_org" on public.block_versions
  with check ((EXISTS ( SELECT 1
   FROM blocks b
  WHERE ((b.id = block_versions.block_id) AND (b.organisation_id = current_organisation_id()) AND public.is_elevated()))));

-- public.blocks: DELETE
alter policy "blocks_admin_delete_own_org" on public.blocks
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.blocks: INSERT
alter policy "blocks_admin_insert_own_org" on public.blocks
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.blocks: UPDATE
alter policy "blocks_admin_update_own_org" on public.blocks
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()))
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.collections: DELETE
alter policy "collections_admin_delete" on public.collections
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.collections: INSERT
alter policy "collections_admin_insert" on public.collections
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.collections: UPDATE
alter policy "collections_admin_update" on public.collections
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()))
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.departments: DELETE
alter policy "departments_admin_delete" on public.departments
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.departments: INSERT
alter policy "departments_admin_insert" on public.departments
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.departments: UPDATE
alter policy "departments_admin_update" on public.departments
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()))
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.escalation_reports: UPDATE
alter policy "escalation_update_supervisor" on public.escalation_reports
  using (((organisation_id = current_organisation_id()) AND ((current_user_role() = 'supervisor'::app_role) OR public.is_elevated())))
  with check ((organisation_id = current_organisation_id()));

-- public.organisation_members: UPDATE
alter policy "admins_can_update_member_roles" on public.organisation_members
  using ((organisation_id = current_organisation_id()))
  with check (((organisation_id = current_organisation_id()) AND (public.is_elevated() AND (current_user_role() = 'admin'::app_role))));

-- public.parse_jobs: ALL
alter policy "admins_can_manage_parse_jobs" on public.parse_jobs
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()));
-- the read half of the ALL policy keeps its aal1 predicate (an admin still reads the worker side)
create policy "admins_can_manage_parse_jobs_read" on public.parse_jobs as PERMISSIVE for select to authenticated
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));

-- public.roles: DELETE
alter policy "roles_admin_delete" on public.roles
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.roles: INSERT
alter policy "roles_admin_insert" on public.roles
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.roles: UPDATE
alter policy "roles_admin_update" on public.roles
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()))
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.section_kinds: DELETE
alter policy "section_kinds_admin_delete_own_org" on public.section_kinds
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.section_kinds: INSERT
alter policy "section_kinds_admin_insert_own_org" on public.section_kinds
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.section_kinds: UPDATE
alter policy "section_kinds_admin_update_own_org" on public.section_kinds
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()))
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.site_layouts: ALL
alter policy "admins_can_write_site_layouts" on public.site_layouts
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()))
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated()));
-- the read half of the ALL policy keeps its aal1 predicate (an admin still reads the worker side)
create policy "admins_can_write_site_layouts_read" on public.site_layouts as PERMISSIVE for select to authenticated
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));

-- public.site_machines: ALL
alter policy "admins_can_write_site_machines" on public.site_machines
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()))
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated()));
-- the read half of the ALL policy keeps its aal1 predicate (an admin still reads the worker side)
create policy "admins_can_write_site_machines_read" on public.site_machines as PERMISSIVE for select to authenticated
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));

-- public.sop_assignments: ALL
alter policy "admins_can_manage_assignments" on public.sop_assignments
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()))
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated()));
-- the read half of the ALL policy keeps its aal1 predicate (an admin still reads the worker side)
create policy "admins_can_manage_assignments_read" on public.sop_assignments as PERMISSIVE for select to authenticated
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));

-- public.sop_block_update_decisions: INSERT
alter policy "block_update_decisions_insert" on public.sop_block_update_decisions
  with check ((EXISTS ( SELECT 1
   FROM ((sop_section_blocks ssb
     JOIN sop_sections sec ON ((sec.id = ssb.sop_section_id)))
     JOIN sops sop ON ((sop.id = sec.sop_id)))
  WHERE ((ssb.id = sop_block_update_decisions.sop_section_block_id) AND (sop.organisation_id = current_organisation_id()) AND public.is_elevated()))));

-- public.sop_images: ALL
alter policy "admins_can_manage_images" on public.sop_images
  using ((EXISTS ( SELECT 1
   FROM sops
  WHERE ((sops.id = sop_images.sop_id) AND (sops.organisation_id = current_organisation_id()) AND (public.is_elevated() OR (is_sop_sign_off_approver(sops.id) AND NOT COALESCE((current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])), false)))))));
-- the read half of the ALL policy keeps its aal1 predicate (an admin still reads the worker side)
create policy "admins_can_manage_images_read" on public.sop_images as PERMISSIVE for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM sops
  WHERE ((sops.id = sop_images.sop_id) AND (sops.organisation_id = current_organisation_id()) AND ((current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])) OR is_sop_sign_off_approver(sops.id))))));

-- public.sop_machines: ALL
alter policy "admins_can_write_sop_machines" on public.sop_machines
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()))
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated()));
-- the read half of the ALL policy keeps its aal1 predicate (an admin still reads the worker side)
create policy "admins_can_write_sop_machines_read" on public.sop_machines as PERMISSIVE for select to authenticated
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));

-- public.sop_observations: INSERT
alter policy "sop_observations_insert_recorder" on public.sop_observations
  with check (((organisation_id = current_organisation_id()) AND ((current_user_role() = 'supervisor'::app_role) OR public.is_elevated()) AND (observed_by = auth.uid()) AND sop_observation_refs_in_org(sop_id, observed_worker_id) AND ((NOT is_assessor_override) OR public.is_elevated())));

-- public.sop_review_events: INSERT
alter policy "sop_review_events_insert_admin" on public.sop_review_events
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated() AND (reviewed_by = auth.uid())));

-- public.sop_section_blocks: ALL
alter policy "ssb_admin_manage_own_org" on public.sop_section_blocks
  using ((EXISTS ( SELECT 1
   FROM (sop_sections sec
     JOIN sops sop ON ((sop.id = sec.sop_id)))
  WHERE ((sec.id = sop_section_blocks.sop_section_id) AND (sop.organisation_id = current_organisation_id()) AND (public.is_elevated() OR (is_sop_sign_off_approver(sop.id) AND NOT COALESCE((current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])), false)))))))
  with check ((EXISTS ( SELECT 1
   FROM (sop_sections sec
     JOIN sops sop ON ((sop.id = sec.sop_id)))
  WHERE ((sec.id = sop_section_blocks.sop_section_id) AND (sop.organisation_id = current_organisation_id()) AND (public.is_elevated() OR (is_sop_sign_off_approver(sop.id) AND NOT COALESCE((current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])), false)))))));
-- the read half of the ALL policy keeps its aal1 predicate (an admin still reads the worker side)
create policy "ssb_admin_manage_own_org_read" on public.sop_section_blocks as PERMISSIVE for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM (sop_sections sec
     JOIN sops sop ON ((sop.id = sec.sop_id)))
  WHERE ((sec.id = sop_section_blocks.sop_section_id) AND (sop.organisation_id = current_organisation_id()) AND ((current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])) OR is_sop_sign_off_approver(sop.id))))));

-- public.sop_sections: ALL
alter policy "admins_can_manage_sections" on public.sop_sections
  using ((EXISTS ( SELECT 1
   FROM sops
  WHERE ((sops.id = sop_sections.sop_id) AND (sops.organisation_id = current_organisation_id()) AND (public.is_elevated() OR (is_sop_sign_off_approver(sops.id) AND NOT COALESCE((current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])), false)))))));
-- the read half of the ALL policy keeps its aal1 predicate (an admin still reads the worker side)
create policy "admins_can_manage_sections_read" on public.sop_sections as PERMISSIVE for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM sops
  WHERE ((sops.id = sop_sections.sop_id) AND (sops.organisation_id = current_organisation_id()) AND ((current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])) OR is_sop_sign_off_approver(sops.id))))));

-- public.sop_steps: ALL
alter policy "admins_can_manage_steps" on public.sop_steps
  using ((EXISTS ( SELECT 1
   FROM (sop_sections s
     JOIN sops sop ON ((sop.id = s.sop_id)))
  WHERE ((s.id = sop_steps.section_id) AND (sop.organisation_id = current_organisation_id()) AND (public.is_elevated() OR (is_sop_sign_off_approver(sop.id) AND NOT COALESCE((current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])), false)))))));
-- the read half of the ALL policy keeps its aal1 predicate (an admin still reads the worker side)
create policy "admins_can_manage_steps_read" on public.sop_steps as PERMISSIVE for select to authenticated
  using ((EXISTS ( SELECT 1
   FROM (sop_sections s
     JOIN sops sop ON ((sop.id = s.sop_id)))
  WHERE ((s.id = sop_steps.section_id) AND (sop.organisation_id = current_organisation_id()) AND ((current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])) OR is_sop_sign_off_approver(sop.id))))));

-- public.sops: DELETE
alter policy "admins_can_delete_sops" on public.sops
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.sops: INSERT
alter policy "admins_can_insert_sops" on public.sops
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.sops: UPDATE
alter policy "admins_can_update_sops" on public.sops
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.standard_attachments: INSERT
alter policy "admins_can_attach_standards" on public.standard_attachments
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated() AND (((sop_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM sops s
  WHERE ((s.id = standard_attachments.sop_id) AND (s.organisation_id = current_organisation_id()))))) OR ((section_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (sop_sections sec
     JOIN sops s ON ((s.id = sec.sop_id)))
  WHERE ((sec.id = standard_attachments.section_id) AND (s.organisation_id = current_organisation_id()))))) OR ((focus_step_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM sop_focus_steps f
  WHERE ((f.id = standard_attachments.focus_step_id) AND (f.organisation_id = current_organisation_id()))))))));

-- public.standard_attachments: DELETE
alter policy "admins_can_detach_standards" on public.standard_attachments
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- public.standards: ALL
alter policy "admins_can_write_standards" on public.standards
  using (((organisation_id = current_organisation_id()) AND public.is_elevated()))
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated()));
-- the read half of the ALL policy keeps its aal1 predicate (an admin still reads the worker side)
create policy "admins_can_write_standards_read" on public.standards as PERMISSIVE for select to authenticated
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));

-- public.supervisor_assignments: DELETE
alter policy "admins_can_delete_assignments" on public.supervisor_assignments
  using (((organisation_id = current_organisation_id()) AND (public.is_elevated() AND (current_user_role() = 'admin'::app_role))));

-- public.supervisor_assignments: INSERT
alter policy "admins_can_manage_assignments" on public.supervisor_assignments
  with check (((organisation_id = current_organisation_id()) AND (public.is_elevated() AND (current_user_role() = 'admin'::app_role))));

-- public.worker_notifications: INSERT
alter policy "admins_can_insert_notifications" on public.worker_notifications
  with check (((organisation_id = current_organisation_id()) AND public.is_elevated()));

-- storage.objects: DELETE
alter policy "admins_can_delete_site_scenes" on storage.objects
  using (((bucket_id = 'site-scenes'::text) AND ((storage.foldername(name))[1] = (current_organisation_id())::text) AND public.is_elevated()));

-- storage.objects: UPDATE
alter policy "admins_can_update_sop_videos" on storage.objects
  using (((bucket_id = 'sop-videos'::text) AND ((storage.foldername(name))[1] = (current_organisation_id())::text) AND public.is_elevated()))
  with check (((bucket_id = 'sop-videos'::text) AND ((storage.foldername(name))[1] = (current_organisation_id())::text) AND public.is_elevated()));

-- storage.objects: INSERT
alter policy "admins_can_upload_site_scenes" on storage.objects
  with check (((bucket_id = 'site-scenes'::text) AND ((storage.foldername(name))[1] = (current_organisation_id())::text) AND public.is_elevated()));

-- storage.objects: INSERT
alter policy "admins_can_upload_sop_docs" on storage.objects
  with check (((bucket_id = 'sop-documents'::text) AND ((storage.foldername(name))[1] = (current_organisation_id())::text) AND public.is_elevated()));

-- storage.objects: INSERT
alter policy "admins_can_upload_sop_images" on storage.objects
  with check (((bucket_id = 'sop-images'::text) AND ((storage.foldername(name))[1] = (current_organisation_id())::text) AND public.is_elevated()));

-- storage.objects: INSERT
alter policy "admins_can_upload_sop_videos" on storage.objects
  with check (((bucket_id = 'sop-videos'::text) AND ((storage.foldername(name))[1] = (current_organisation_id())::text) AND public.is_elevated()));
