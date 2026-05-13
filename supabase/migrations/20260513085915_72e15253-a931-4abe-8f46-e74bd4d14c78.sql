CREATE TABLE IF NOT EXISTS public.verification_resend_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  message_id TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_resend_log_email_time
  ON public.verification_resend_log (lower(email), requested_at DESC);

ALTER TABLE public.verification_resend_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read resend log"
  ON public.verification_resend_log FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_verification_resend(
  _email TEXT,
  _status TEXT,
  _error_message TEXT DEFAULT NULL,
  _message_id TEXT DEFAULT NULL
) RETURNS public.verification_resend_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE row public.verification_resend_log;
BEGIN
  INSERT INTO public.verification_resend_log (email, status, error_message, message_id)
  VALUES (lower(_email), _status, _error_message, _message_id)
  RETURNING * INTO row;
  RETURN row;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_recent_verification_resends(_email TEXT)
RETURNS TABLE (requested_at TIMESTAMPTZ, status TEXT, error_message TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT requested_at, status, error_message
  FROM public.verification_resend_log
  WHERE lower(email) = lower(_email)
  ORDER BY requested_at DESC
  LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION public.log_verification_resend(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_verification_resends(TEXT) TO anon, authenticated;