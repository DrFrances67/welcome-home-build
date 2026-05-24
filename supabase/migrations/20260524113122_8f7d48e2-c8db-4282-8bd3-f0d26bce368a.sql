
-- 1. user_roles: deny INSERT/DELETE to all non-service roles
CREATE POLICY "Only service role can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can delete roles"
ON public.user_roles FOR DELETE
USING (auth.role() = 'service_role');

CREATE POLICY "Only service role can update roles"
ON public.user_roles FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 2. verification_resend_log: explicit service-role INSERT policy
CREATE POLICY "Service role can insert resend log"
ON public.verification_resend_log FOR INSERT
WITH CHECK (auth.role() = 'service_role');

-- 3. Fix mutable search_path on pgmq wrapper functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;

-- 4. Revoke EXECUTE from anon/authenticated on internal service-only functions.
-- Keep has_role and get_email_by_username executable (used by RLS / login lookup).
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_verification_resend(text, text, text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_recent_verification_resends(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_idle_user_sessions() FROM anon, authenticated, PUBLIC;
