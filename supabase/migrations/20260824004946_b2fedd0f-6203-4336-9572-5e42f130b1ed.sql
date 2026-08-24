CREATE TABLE public.worksheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled worksheet',
  status text NOT NULL DEFAULT 'draft',
  current_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worksheets TO authenticated;
GRANT ALL ON public.worksheets TO service_role;

ALTER TABLE public.worksheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own worksheets" ON public.worksheets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.worksheet_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worksheet_id uuid NOT NULL REFERENCES public.worksheets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_no integer NOT NULL,
  label text,
  form jsonb NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (worksheet_id, version_no)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.worksheet_versions TO authenticated;
GRANT ALL ON public.worksheet_versions TO service_role;

ALTER TABLE public.worksheet_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own worksheet versions" ON public.worksheet_versions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.worksheets
  ADD CONSTRAINT worksheets_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES public.worksheet_versions(id) ON DELETE SET NULL;

CREATE INDEX worksheets_user_updated_idx ON public.worksheets (user_id, updated_at DESC);
CREATE INDEX worksheet_versions_ws_idx ON public.worksheet_versions (worksheet_id, version_no DESC);

CREATE TRIGGER update_worksheets_updated_at
  BEFORE UPDATE ON public.worksheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();