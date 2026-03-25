CREATE TABLE public.worker_notifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sop_id           uuid NOT NULL REFERENCES public.sops(id) ON DELETE CASCADE,
  type             text NOT NULL DEFAULT 'sop_updated',
  read             boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.worker_notifications (user_id, read);
CREATE INDEX idx_notifications_org ON public.worker_notifications (organisation_id);

ALTER TABLE public.worker_notifications ENABLE ROW LEVEL SECURITY;

-- Workers see their own notifications
CREATE POLICY "users_see_own_notifications"
  ON public.worker_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND organisation_id = public.current_organisation_id());

-- Workers can mark their own notifications as read
CREATE POLICY "users_can_update_own_notifications"
  ON public.worker_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND organisation_id = public.current_organisation_id())
  WITH CHECK (user_id = auth.uid() AND organisation_id = public.current_organisation_id());

-- Admins can insert notifications (when publishing a new version)
CREATE POLICY "admins_can_insert_notifications"
  ON public.worker_notifications FOR INSERT TO authenticated
  WITH CHECK (
    organisation_id = public.current_organisation_id()
    AND public.current_user_role() IN ('admin', 'safety_manager')
  );
