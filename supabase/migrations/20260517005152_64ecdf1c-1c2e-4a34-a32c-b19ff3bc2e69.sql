-- 1. Add last_active column to user_sessions
ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS user_sessions_active_idx
  ON public.user_sessions (last_active)
  WHERE ended_at IS NULL;

-- 2. Allow admins to update any session (needed to end them)
DROP POLICY IF EXISTS "Admins can update any session" ON public.user_sessions;
CREATE POLICY "Admins can update any session"
ON public.user_sessions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Enable pg_cron for scheduled cleanup
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 4. Cleanup function: end sessions inactive for 30+ minutes
CREATE OR REPLACE FUNCTION public.expire_idle_user_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE affected integer;
BEGIN
  UPDATE public.user_sessions
  SET ended_at = now()
  WHERE ended_at IS NULL
    AND last_active < now() - INTERVAL '30 minutes';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 5. Schedule it every 30 minutes (replace if exists)
DO $$
BEGIN
  PERFORM cron.unschedule('expire-idle-user-sessions');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'expire-idle-user-sessions',
  '*/30 * * * *',
  $$SELECT public.expire_idle_user_sessions();$$
);