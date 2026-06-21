-- Fix: User email addresses exposed to unauthenticated callers (email_enum_by_username)
-- get_email_by_username is a SECURITY DEFINER function that was callable by anon/authenticated,
-- letting anyone resolve any user's email by username. Username->email resolution now happens
-- exclusively server-side (service role) inside the /api/public/login handler, so revoke direct
-- API access from anon and authenticated.
REVOKE EXECUTE ON FUNCTION public.get_email_by_username(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_email_by_username(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_email_by_username(text) FROM PUBLIC;

-- Hygiene: the updated_at trigger helper never needs to be callable through the Data API.
-- Triggers run as the table owner regardless of these grants, so revoking is safe.
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;