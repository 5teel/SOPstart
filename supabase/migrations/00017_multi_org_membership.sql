-- Allow users to belong to multiple organisations
-- Previously: UNIQUE(user_id) enforced single-org membership
-- Now: UNIQUE(organisation_id, user_id) still prevents duplicate membership in same org

ALTER TABLE public.organisation_members DROP CONSTRAINT IF EXISTS organisation_members_user_id_key;

-- Update JWT custom_access_token_hook to support org switching
-- Uses user_metadata.active_org_id to determine current org context
-- Falls back to most recently joined org if not set

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims         jsonb;
  member_record  record;
  active_org     uuid;
  raw_meta       jsonb;
BEGIN
  -- Check if user has an active_org_id preference in user_metadata
  raw_meta := event->'claims'->'user_metadata';
  IF raw_meta IS NOT NULL AND raw_meta->>'active_org_id' IS NOT NULL THEN
    active_org := (raw_meta->>'active_org_id')::uuid;
    -- Verify membership exists for this org
    SELECT organisation_id, role
    INTO member_record
    FROM public.organisation_members
    WHERE user_id = (event->>'user_id')::uuid
      AND organisation_id = active_org
    LIMIT 1;
  END IF;

  -- Fallback: use most recently joined org
  IF member_record IS NULL THEN
    SELECT organisation_id, role
    INTO member_record
    FROM public.organisation_members
    WHERE user_id = (event->>'user_id')::uuid
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  claims := event->'claims';
  IF member_record IS NOT NULL THEN
    claims := jsonb_set(claims, '{organisation_id}', to_jsonb(member_record.organisation_id::text));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(member_record.role::text));
  ELSE
    claims := jsonb_set(claims, '{organisation_id}', 'null');
    claims := jsonb_set(claims, '{user_role}', '"pending"');
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;
