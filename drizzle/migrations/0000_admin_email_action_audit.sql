CREATE TABLE public.admin_email_action_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('verification_retry_requested', 'entry_dismissed')),
  email_log_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.admin_email_action_audit TO authenticated;
GRANT ALL ON public.admin_email_action_audit TO service_role;
ALTER TABLE public.admin_email_action_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read email action audit" ON public.admin_email_action_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins append own email action audit" ON public.admin_email_action_audit FOR INSERT TO authenticated WITH CHECK (actor_user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX admin_email_action_audit_created_idx ON public.admin_email_action_audit (created_at DESC);
