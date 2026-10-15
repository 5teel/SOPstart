-- Send for sign-off in one round trip and one transaction: the completion, its photo rows and the
-- walk's submitted status land together or not at all. The app server (Singapore) is ~300 ms from
-- the database (Sydney) per call; this replaces three to five serial calls.
-- Caller: submitCompletion (src/actions/completions.ts) only, after it has checked the walk against
-- the SESSION org and worker. service_role only (it takes an org id parameter).
create or replace function public.complete_walk(
  p_walk_id uuid,
  p_org uuid,
  p_worker uuid,
  p_sop_id uuid,
  p_sop_version integer,
  p_hash text,
  p_step_data jsonb,
  p_ack_trace jsonb,
  p_photos jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The walk id is the completion id: a retry finds the row it already wrote.
  insert into sop_completions (id, organisation_id, sop_id, worker_id, sop_version, content_hash, step_data, step_ack_trace)
  values (p_walk_id, p_org, p_sop_id, p_worker, p_sop_version, p_hash, p_step_data, p_ack_trace)
  on conflict (id) do nothing;
  if not exists (select 1 from sop_completions where id = p_walk_id and worker_id = p_worker and organisation_id = p_org) then
    raise exception 'completion % is not this worker''s', p_walk_id;
  end if;

  insert into completion_photos (organisation_id, completion_id, step_id, storage_path, content_type)
  select p_org, p_walk_id, (x->>'stepId')::uuid, x->>'storagePath', x->>'contentType'
  from jsonb_array_elements(p_photos) x
  where not exists (
    select 1 from completion_photos c
    where c.completion_id = p_walk_id and c.organisation_id = p_org and c.storage_path = x->>'storagePath'
  );

  update sop_walks
  set status = 'submitted', submitted_at = now(), updated_at = now()
  where id = p_walk_id and organisation_id = p_org and worker_id = p_worker and status = 'in_progress';
end;
$$;

revoke all on function public.complete_walk(uuid, uuid, uuid, uuid, integer, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.complete_walk(uuid, uuid, uuid, uuid, integer, text, jsonb, jsonb, jsonb) to service_role;
