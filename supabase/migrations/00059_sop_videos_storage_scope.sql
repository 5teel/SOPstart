-- Phase 40 gap closure (40-14) -- T-40-14-03/04.
--
-- 00012 created the sop-videos bucket with a bucket-wide, org-blind INSERT
-- policy ("Authenticated users can upload to sop-videos": WITH CHECK
-- (bucket_id = 'sop-videos') only) because at the time the TUS upload was
-- authorised by the service-role key, not the caller's own session -- RLS
-- on this bucket was never load-bearing. Plan 40-14 removes the
-- service-role key from every video-upload code path (src/actions/sops.ts,
-- src/actions/versioning.ts), which makes this bucket's RLS the actual
-- write gate for the first time. This migration tightens INSERT (and adds
-- UPDATE, which x-upsert:'true' resumable uploads require) to the same
-- org-prefix + admin-role shape 00005 already uses for sop-documents.
--
-- SELECT is deliberately left untouched here: reads on this bucket go
-- through the admin client (src/app/api/sops/transcribe/route.ts) or a
-- session-client signed URL already gated by an admin-role check plus RLS
-- on sops (src/app/api/sops/[sopId]/source-url/route.ts). Narrowing SELECT
-- is a separate, pre-existing concern (T-40-14-05, disposition: accept) and
-- out of this gap-closure pass's scope.
--
-- No table, no DROP COLUMN, no SECURITY DEFINER function is added.

drop policy if exists "Authenticated users can upload to sop-videos" on storage.objects;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'admins_can_upload_sop_videos'
  ) then
    create policy "admins_can_upload_sop_videos"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'sop-videos'
        and (storage.foldername(name))[1] = public.current_organisation_id()::text
        and public.current_user_role() in ('admin', 'safety_manager')
      );
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'admins_can_update_sop_videos'
  ) then
    create policy "admins_can_update_sop_videos"
      on storage.objects for update to authenticated
      using (
        bucket_id = 'sop-videos'
        and (storage.foldername(name))[1] = public.current_organisation_id()::text
        and public.current_user_role() in ('admin', 'safety_manager')
      )
      with check (
        bucket_id = 'sop-videos'
        and (storage.foldername(name))[1] = public.current_organisation_id()::text
        and public.current_user_role() in ('admin', 'safety_manager')
      );
  end if;
end $$;
