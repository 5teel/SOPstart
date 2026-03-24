-- Create the sop-documents storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sop-documents',
  'sop-documents',
  false,
  52428800, -- 50MB
  array['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf', 'image/jpeg', 'image/png']
);

-- Create the sop-images storage bucket (for extracted images)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sop-images',
  'sop-images',
  false,
  5242880, -- 5MB per image
  array['image/jpeg', 'image/png', 'image/webp']
);

-- Storage RLS: org members can view their org's SOP documents
create policy "org_members_can_view_sop_docs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'sop-documents'
    and (storage.foldername(name))[1] = public.current_organisation_id()::text
  );

-- Admins can upload SOP documents
create policy "admins_can_upload_sop_docs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sop-documents'
    and (storage.foldername(name))[1] = public.current_organisation_id()::text
    and public.current_user_role() in ('admin', 'safety_manager')
  );

-- Same for sop-images bucket
create policy "org_members_can_view_sop_images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'sop-images'
    and (storage.foldername(name))[1] = public.current_organisation_id()::text
  );

create policy "admins_can_upload_sop_images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'sop-images'
    and (storage.foldername(name))[1] = public.current_organisation_id()::text
    and public.current_user_role() in ('admin', 'safety_manager')
  );
