CREATE TABLE public.tool_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid,
  tool_name text NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tool_usage_user ON public.tool_usage(user_id);
CREATE INDEX idx_tool_usage_session ON public.tool_usage(session_id);
CREATE INDEX idx_tool_usage_used_at ON public.tool_usage(used_at DESC);

ALTER TABLE public.tool_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own tool_usage"
  ON public.tool_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own tool_usage"
  ON public.tool_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all tool_usage"
  ON public.tool_usage FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));