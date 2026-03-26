-- ============================================================
-- Migration 00010: Completion schema
-- Adds: completion_status enum, photo_required on sop_steps,
--        sop_completions, completion_photos, completion_sign_offs,
--        completion-photos storage bucket.
-- All completion tables are APPEND-ONLY (no UPDATE/DELETE RLS).
-- ============================================================

-- 1. Completion status enum
CREATE TYPE public.completion_status AS ENUM ('pending_sign_off', 'signed_off', 'rejected');

-- 2. photo_required column on sop_steps
ALTER TABLE public.sop_steps
  ADD COLUMN photo_required boolean NOT NULL DEFAULT false;

-- ============================================================
-- 3. sop_completions (append-only, client UUID as PK for idempotency)
-- ============================================================
CREATE TABLE public.sop_completions (
  id               uuid PRIMARY KEY,  -- client-generated UUID (idempotency key)
  organisation_id  uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  sop_id           uuid NOT NULL REFERENCES public.sops(id),
  worker_id        uuid NOT NULL REFERENCES auth.users(id),
  sop_version      int NOT NULL,
  content_hash     text NOT NULL,
  status           public.completion_status NOT NULL DEFAULT 'pending_sign_off',
  step_data        jsonb NOT NULL,
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_completions_org_worker ON public.sop_completions (organisation_id, worker_id);
CREATE INDEX idx_completions_org_sop    ON public.sop_completions (organisation_id, sop_id);
CREATE INDEX idx_completions_org_status ON public.sop_completions (organisation_id, status);

ALTER TABLE public.sop_completions ENABLE ROW LEVEL SECURITY;

-- Workers see their own completions
CREATE POLICY "workers_see_own_completions"
  ON public.sop_completions FOR SELECT TO authenticated
  USING (
    organisation_id = public.current_organisation_id()
    AND worker_id = auth.uid()
  );

-- Supervisors see completions for their assigned workers
CREATE POLICY "supervisors_see_supervised_completions"
  ON public.sop_completions FOR SELECT TO authenticated
  USING (
    organisation_id = public.current_organisation_id()
    AND public.current_user_role() = 'supervisor'
    AND EXISTS (
      SELECT 1 FROM public.supervisor_assignments sa
      WHERE sa.supervisor_id = auth.uid()
        AND sa.worker_id = sop_completions.worker_id
        AND sa.organisation_id = public.current_organisation_id()
    )
  );

-- Safety managers see all completions in their org
CREATE POLICY "safety_managers_see_all_completions"
  ON public.sop_completions FOR SELECT TO authenticated
  USING (
    organisation_id = public.current_organisation_id()
    AND public.current_user_role() = 'safety_manager'
  );

-- Admins see all completions in their org
CREATE POLICY "admins_see_all_completions"
  ON public.sop_completions FOR SELECT TO authenticated
  USING (
    organisation_id = public.current_organisation_id()
    AND public.current_user_role() = 'admin'
  );

-- Workers can insert their own completions (idempotent via client UUID PK)
CREATE POLICY "workers_can_insert_own_completions"
  ON public.sop_completions FOR INSERT TO authenticated
  WITH CHECK (
    organisation_id = public.current_organisation_id()
    AND worker_id = auth.uid()
  );

-- NO UPDATE policy — append-only (COMP-07, D-15)
-- NO DELETE policy — append-only (COMP-07, D-15)

-- ============================================================
-- 4. completion_photos
-- ============================================================
CREATE TABLE public.completion_photos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  completion_id    uuid NOT NULL REFERENCES public.sop_completions(id),
  step_id          uuid NOT NULL,
  storage_path     text NOT NULL,
  content_type     text NOT NULL DEFAULT 'image/jpeg',
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_completion_photos_completion ON public.completion_photos (completion_id);
CREATE INDEX idx_completion_photos_org        ON public.completion_photos (organisation_id);

ALTER TABLE public.completion_photos ENABLE ROW LEVEL SECURITY;

-- Workers see photos for their own completions
CREATE POLICY "workers_see_own_completion_photos"
  ON public.completion_photos FOR SELECT TO authenticated
  USING (
    organisation_id = public.current_organisation_id()
    AND EXISTS (
      SELECT 1 FROM public.sop_completions sc
      WHERE sc.id = completion_photos.completion_id
        AND sc.worker_id = auth.uid()
    )
  );

-- Supervisors see photos for their supervised workers' completions
CREATE POLICY "supervisors_see_supervised_completion_photos"
  ON public.completion_photos FOR SELECT TO authenticated
  USING (
    organisation_id = public.current_organisation_id()
    AND public.current_user_role() = 'supervisor'
    AND EXISTS (
      SELECT 1 FROM public.sop_completions sc
      JOIN public.supervisor_assignments sa ON sa.worker_id = sc.worker_id
      WHERE sc.id = completion_photos.completion_id
        AND sa.supervisor_id = auth.uid()
        AND sa.organisation_id = public.current_organisation_id()
    )
  );

-- Safety managers see all photos in their org
CREATE POLICY "safety_managers_see_all_completion_photos"
  ON public.completion_photos FOR SELECT TO authenticated
  USING (
    organisation_id = public.current_organisation_id()
    AND public.current_user_role() = 'safety_manager'
  );

-- Admins see all photos in their org
CREATE POLICY "admins_see_all_completion_photos"
  ON public.completion_photos FOR SELECT TO authenticated
  USING (
    organisation_id = public.current_organisation_id()
    AND public.current_user_role() = 'admin'
  );

-- Photos are inserted by the server action (admin client) — no authenticated INSERT policy needed
-- NO UPDATE policy — append-only
-- NO DELETE policy — append-only

-- ============================================================
-- 5. completion_sign_offs (second immutable record, D-17)
-- ============================================================
CREATE TABLE public.completion_sign_offs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  completion_id    uuid NOT NULL REFERENCES public.sop_completions(id),
  supervisor_id    uuid NOT NULL REFERENCES auth.users(id),
  decision         text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reason           text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sign_offs_completion ON public.completion_sign_offs (completion_id);
CREATE INDEX idx_sign_offs_org        ON public.completion_sign_offs (organisation_id);

ALTER TABLE public.completion_sign_offs ENABLE ROW LEVEL SECURITY;

-- Workers see sign-offs on their own completions
CREATE POLICY "workers_see_own_sign_offs"
  ON public.completion_sign_offs FOR SELECT TO authenticated
  USING (
    organisation_id = public.current_organisation_id()
    AND EXISTS (
      SELECT 1 FROM public.sop_completions sc
      WHERE sc.id = completion_sign_offs.completion_id
        AND sc.worker_id = auth.uid()
    )
  );

-- Supervisors see sign-offs they made or for supervised workers
CREATE POLICY "supervisors_see_supervised_sign_offs"
  ON public.completion_sign_offs FOR SELECT TO authenticated
  USING (
    organisation_id = public.current_organisation_id()
    AND public.current_user_role() = 'supervisor'
    AND (
      supervisor_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.sop_completions sc
        JOIN public.supervisor_assignments sa ON sa.worker_id = sc.worker_id
        WHERE sc.id = completion_sign_offs.completion_id
          AND sa.supervisor_id = auth.uid()
          AND sa.organisation_id = public.current_organisation_id()
      )
    )
  );

-- Safety managers see all sign-offs in their org
CREATE POLICY "safety_managers_see_all_sign_offs"
  ON public.completion_sign_offs FOR SELECT TO authenticated
  USING (
    organisation_id = public.current_organisation_id()
    AND public.current_user_role() = 'safety_manager'
  );

-- Admins see all sign-offs in their org
CREATE POLICY "admins_see_all_sign_offs"
  ON public.completion_sign_offs FOR SELECT TO authenticated
  USING (
    organisation_id = public.current_organisation_id()
    AND public.current_user_role() = 'admin'
  );

-- Sign-offs are inserted by server action (admin client) — no authenticated INSERT policy needed
-- NO UPDATE policy — append-only (D-17)
-- NO DELETE policy — append-only (D-17)

-- ============================================================
-- 6. completion-photos Storage bucket (private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('completion-photos', 'completion-photos', false);

-- Storage RLS: org-scoped read access
-- Workers can read their own completion photos
CREATE POLICY "workers_read_own_completion_photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'completion-photos'
    AND (storage.foldername(name))[1] = (
      SELECT current_organisation_id()::text
    )
    AND EXISTS (
      SELECT 1 FROM public.completion_photos cp
      JOIN public.sop_completions sc ON sc.id = cp.completion_id
      WHERE cp.storage_path = name
        AND sc.worker_id = auth.uid()
    )
  );

-- Supervisors and managers can read completion photos in their org
CREATE POLICY "supervisors_read_supervised_completion_photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'completion-photos'
    AND (storage.foldername(name))[1] = (
      SELECT current_organisation_id()::text
    )
    AND public.current_user_role() IN ('supervisor', 'safety_manager', 'admin')
  );

-- Server action (admin client) handles uploads — no authenticated INSERT on storage needed
