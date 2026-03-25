CREATE TYPE public.assignment_type AS ENUM ('role', 'individual');

CREATE TABLE public.sop_assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  sop_id           uuid NOT NULL REFERENCES public.sops(id) ON DELETE CASCADE,
  assignment_type  public.assignment_type NOT NULL,
  role             public.app_role,
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sop_id, assignment_type, role),
  UNIQUE (sop_id, assignment_type, user_id)
);

CREATE INDEX idx_sop_assignments_org ON public.sop_assignments (organisation_id);
CREATE INDEX idx_sop_assignments_sop ON public.sop_assignments (sop_id);
CREATE INDEX idx_sop_assignments_user ON public.sop_assignments (user_id);
CREATE INDEX idx_sop_assignments_role ON public.sop_assignments (role);

ALTER TABLE public.sop_assignments ENABLE ROW LEVEL SECURITY;

-- Workers can see their own assignments (role-match or individual)
CREATE POLICY "workers_can_view_own_assignments"
  ON public.sop_assignments FOR SELECT TO authenticated
  USING (
    organisation_id = public.current_organisation_id()
    AND (
      (assignment_type = 'individual' AND user_id = auth.uid())
      OR (assignment_type = 'role' AND role = public.current_user_role())
    )
  );

-- Admins can manage all assignments in their org
CREATE POLICY "admins_can_manage_assignments"
  ON public.sop_assignments FOR ALL TO authenticated
  USING (
    organisation_id = public.current_organisation_id()
    AND public.current_user_role() IN ('admin', 'safety_manager')
  )
  WITH CHECK (
    organisation_id = public.current_organisation_id()
    AND public.current_user_role() IN ('admin', 'safety_manager')
  );
