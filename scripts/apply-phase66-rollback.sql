-- Phase 66 rollback of 00087: the pre-00087 policy expressions, captured live 2026-10-24.
alter policy "areas_admin_delete" on public.areas
  using (((organisation_id = current_organisation_id()) AND (EXISTS ( SELECT 1
   FROM organisation_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])))))));
alter policy "areas_admin_insert" on public.areas
  with check (((organisation_id = current_organisation_id()) AND (EXISTS ( SELECT 1
   FROM organisation_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])))))));
alter policy "areas_admin_update" on public.areas
  using (((organisation_id = current_organisation_id()) AND (EXISTS ( SELECT 1
   FROM organisation_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])))))))
  with check (((organisation_id = current_organisation_id()) AND (EXISTS ( SELECT 1
   FROM organisation_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])))))));
alter policy "block_versions_admin_insert_own_org" on public.block_versions
  with check ((EXISTS ( SELECT 1
   FROM blocks b
  WHERE ((b.id = block_versions.block_id) AND (b.organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))))));
alter policy "blocks_admin_delete_own_org" on public.blocks
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
alter policy "blocks_admin_insert_own_org" on public.blocks
  with check (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
alter policy "blocks_admin_update_own_org" on public.blocks
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))))
  with check (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
alter policy "collections_admin_delete" on public.collections
  using (((organisation_id = current_organisation_id()) AND (EXISTS ( SELECT 1
   FROM organisation_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])))))));
alter policy "collections_admin_insert" on public.collections
  with check (((organisation_id = current_organisation_id()) AND (EXISTS ( SELECT 1
   FROM organisation_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])))))));
alter policy "collections_admin_update" on public.collections
  using (((organisation_id = current_organisation_id()) AND (EXISTS ( SELECT 1
   FROM organisation_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])))))))
  with check (((organisation_id = current_organisation_id()) AND (EXISTS ( SELECT 1
   FROM organisation_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])))))));
alter policy "departments_admin_delete" on public.departments
  using (((organisation_id = current_organisation_id()) AND (EXISTS ( SELECT 1
   FROM organisation_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])))))));
alter policy "departments_admin_insert" on public.departments
  with check (((organisation_id = current_organisation_id()) AND (EXISTS ( SELECT 1
   FROM organisation_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])))))));
alter policy "departments_admin_update" on public.departments
  using (((organisation_id = current_organisation_id()) AND (EXISTS ( SELECT 1
   FROM organisation_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])))))))
  with check (((organisation_id = current_organisation_id()) AND (EXISTS ( SELECT 1
   FROM organisation_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])))))));
alter policy "escalation_update_supervisor" on public.escalation_reports
  using (((organisation_id = current_organisation_id()) AND ((current_user_role())::text = ANY (ARRAY['supervisor'::text, 'admin'::text, 'safety_manager'::text]))))
  with check ((organisation_id = current_organisation_id()));
alter policy "admins_can_update_member_roles" on public.organisation_members
  using ((organisation_id = current_organisation_id()))
  with check (((organisation_id = current_organisation_id()) AND (current_user_role() = 'admin'::app_role)));
alter policy "admins_can_manage_parse_jobs" on public.parse_jobs
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
drop policy if exists "admins_can_manage_parse_jobs_read" on public.parse_jobs;
alter policy "roles_admin_delete" on public.roles
  using (((organisation_id = current_organisation_id()) AND (EXISTS ( SELECT 1
   FROM organisation_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])))))));
alter policy "roles_admin_insert" on public.roles
  with check (((organisation_id = current_organisation_id()) AND (EXISTS ( SELECT 1
   FROM organisation_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])))))));
alter policy "roles_admin_update" on public.roles
  using (((organisation_id = current_organisation_id()) AND (EXISTS ( SELECT 1
   FROM organisation_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])))))))
  with check (((organisation_id = current_organisation_id()) AND (EXISTS ( SELECT 1
   FROM organisation_members om
  WHERE ((om.user_id = auth.uid()) AND (om.role = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])))))));
alter policy "section_kinds_admin_delete_own_org" on public.section_kinds
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
alter policy "section_kinds_admin_insert_own_org" on public.section_kinds
  with check (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
alter policy "section_kinds_admin_update_own_org" on public.section_kinds
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))))
  with check (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
alter policy "admins_can_write_site_layouts" on public.site_layouts
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))))
  with check (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
drop policy if exists "admins_can_write_site_layouts_read" on public.site_layouts;
alter policy "admins_can_write_site_machines" on public.site_machines
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))))
  with check (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
drop policy if exists "admins_can_write_site_machines_read" on public.site_machines;
alter policy "admins_can_manage_assignments" on public.sop_assignments
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))))
  with check (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
drop policy if exists "admins_can_manage_assignments_read" on public.sop_assignments;
alter policy "block_update_decisions_insert" on public.sop_block_update_decisions
  with check ((EXISTS ( SELECT 1
   FROM ((sop_section_blocks ssb
     JOIN sop_sections sec ON ((sec.id = ssb.sop_section_id)))
     JOIN sops sop ON ((sop.id = sec.sop_id)))
  WHERE ((ssb.id = sop_block_update_decisions.sop_section_block_id) AND (sop.organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))))));
alter policy "admins_can_manage_images" on public.sop_images
  using ((EXISTS ( SELECT 1
   FROM sops
  WHERE ((sops.id = sop_images.sop_id) AND (sops.organisation_id = current_organisation_id()) AND ((current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])) OR is_sop_sign_off_approver(sops.id))))));
drop policy if exists "admins_can_manage_images_read" on public.sop_images;
alter policy "admins_can_write_sop_machines" on public.sop_machines
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))))
  with check (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
drop policy if exists "admins_can_write_sop_machines_read" on public.sop_machines;
alter policy "sop_observations_insert_recorder" on public.sop_observations
  with check (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role, 'supervisor'::app_role])) AND (observed_by = auth.uid()) AND sop_observation_refs_in_org(sop_id, observed_worker_id) AND ((NOT is_assessor_override) OR (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])))));
alter policy "sop_review_events_insert_admin" on public.sop_review_events
  with check (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])) AND (reviewed_by = auth.uid())));
alter policy "ssb_admin_manage_own_org" on public.sop_section_blocks
  using ((EXISTS ( SELECT 1
   FROM (sop_sections sec
     JOIN sops sop ON ((sop.id = sec.sop_id)))
  WHERE ((sec.id = sop_section_blocks.sop_section_id) AND (sop.organisation_id = current_organisation_id()) AND ((current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])) OR is_sop_sign_off_approver(sop.id))))))
  with check ((EXISTS ( SELECT 1
   FROM (sop_sections sec
     JOIN sops sop ON ((sop.id = sec.sop_id)))
  WHERE ((sec.id = sop_section_blocks.sop_section_id) AND (sop.organisation_id = current_organisation_id()) AND ((current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])) OR is_sop_sign_off_approver(sop.id))))));
drop policy if exists "ssb_admin_manage_own_org_read" on public.sop_section_blocks;
alter policy "admins_can_manage_sections" on public.sop_sections
  using ((EXISTS ( SELECT 1
   FROM sops
  WHERE ((sops.id = sop_sections.sop_id) AND (sops.organisation_id = current_organisation_id()) AND ((current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])) OR is_sop_sign_off_approver(sops.id))))));
drop policy if exists "admins_can_manage_sections_read" on public.sop_sections;
alter policy "admins_can_manage_steps" on public.sop_steps
  using ((EXISTS ( SELECT 1
   FROM (sop_sections s
     JOIN sops sop ON ((sop.id = s.sop_id)))
  WHERE ((s.id = sop_steps.section_id) AND (sop.organisation_id = current_organisation_id()) AND ((current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])) OR is_sop_sign_off_approver(sop.id))))));
drop policy if exists "admins_can_manage_steps_read" on public.sop_steps;
alter policy "admins_can_delete_sops" on public.sops
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
alter policy "admins_can_insert_sops" on public.sops
  with check (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
alter policy "admins_can_update_sops" on public.sops
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
alter policy "admins_can_attach_standards" on public.standard_attachments
  with check (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role])) AND (((sop_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM sops s
  WHERE ((s.id = standard_attachments.sop_id) AND (s.organisation_id = current_organisation_id()))))) OR ((section_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (sop_sections sec
     JOIN sops s ON ((s.id = sec.sop_id)))
  WHERE ((sec.id = standard_attachments.section_id) AND (s.organisation_id = current_organisation_id()))))) OR ((focus_step_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM sop_focus_steps f
  WHERE ((f.id = standard_attachments.focus_step_id) AND (f.organisation_id = current_organisation_id()))))))));
alter policy "admins_can_detach_standards" on public.standard_attachments
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
alter policy "admins_can_write_standards" on public.standards
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))))
  with check (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
drop policy if exists "admins_can_write_standards_read" on public.standards;
alter policy "admins_can_delete_assignments" on public.supervisor_assignments
  using (((organisation_id = current_organisation_id()) AND (current_user_role() = 'admin'::app_role)));
alter policy "admins_can_manage_assignments" on public.supervisor_assignments
  with check (((organisation_id = current_organisation_id()) AND (current_user_role() = 'admin'::app_role)));
alter policy "admins_can_insert_notifications" on public.worker_notifications
  with check (((organisation_id = current_organisation_id()) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
alter policy "admins_can_delete_site_scenes" on storage.objects
  using (((bucket_id = 'site-scenes'::text) AND ((storage.foldername(name))[1] = (current_organisation_id())::text) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
alter policy "admins_can_update_sop_videos" on storage.objects
  using (((bucket_id = 'sop-videos'::text) AND ((storage.foldername(name))[1] = (current_organisation_id())::text) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))))
  with check (((bucket_id = 'sop-videos'::text) AND ((storage.foldername(name))[1] = (current_organisation_id())::text) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
alter policy "admins_can_upload_site_scenes" on storage.objects
  with check (((bucket_id = 'site-scenes'::text) AND ((storage.foldername(name))[1] = (current_organisation_id())::text) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
alter policy "admins_can_upload_sop_docs" on storage.objects
  with check (((bucket_id = 'sop-documents'::text) AND ((storage.foldername(name))[1] = (current_organisation_id())::text) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
alter policy "admins_can_upload_sop_images" on storage.objects
  with check (((bucket_id = 'sop-images'::text) AND ((storage.foldername(name))[1] = (current_organisation_id())::text) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
alter policy "admins_can_upload_sop_videos" on storage.objects
  with check (((bucket_id = 'sop-videos'::text) AND ((storage.foldername(name))[1] = (current_organisation_id())::text) AND (current_user_role() = ANY (ARRAY['admin'::app_role, 'safety_manager'::app_role]))));
