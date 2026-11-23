CREATE TABLE public.admin_email_history_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  state text NOT NULL CHECK (state IN ('restriction_present', 'restriction_cleared')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
GRANT SELECT ON public.admin_email_history_observations TO authenticated;
GRANT ALL ON public.admin_email_history_observations TO service_role;
ALTER TABLE public.admin_email_history_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read protected history observations" ON public.admin_email_history_observations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX admin_email_history_observations_created_idx ON public.admin_email_history_observations (created_at DESC);
CREATE FUNCTION public.record_email_history_observation(_state text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  last_state text;
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL OR NOT public.has_role(actor, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF _state IS NULL OR _state NOT IN ('restriction_present', 'restriction_cleared') THEN
    RAISE EXCEPTION 'Invalid observation state' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(741932608154);
  SELECT state INTO last_state FROM public.admin_email_history_observations ORDER BY created_at DESC, id DESC LIMIT 1;
  IF last_state = _state THEN RETURN false; END IF;
  INSERT INTO public.admin_email_history_observations (actor_user_id, state) VALUES (actor, _state);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.record_email_history_observation(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_email_history_observation(text) TO authenticated;
