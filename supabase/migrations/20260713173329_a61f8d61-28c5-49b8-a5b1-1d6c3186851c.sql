CREATE TABLE public.lesson_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled lesson plan',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','saved')),
  current_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lesson_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_plan_id uuid NOT NULL REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_no int NOT NULL,
  label text,
  form jsonb NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_plan_id, version_no)
);

ALTER TABLE public.lesson_plans
  ADD CONSTRAINT lesson_plans_current_version_fk
  FOREIGN KEY (current_version_id)
  REFERENCES public.lesson_plan_versions(id) ON DELETE SET NULL;

CREATE INDEX idx_lesson_plans_user ON public.lesson_plans (user_id, status, updated_at DESC);
CREATE INDEX idx_lesson_plan_versions_plan ON public.lesson_plan_versions (lesson_plan_id, version_no DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_plan_versions TO authenticated;
GRANT ALL ON public.lesson_plans TO service_role;
GRANT ALL ON public.lesson_plan_versions TO service_role;

ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_plan_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own plans" ON public.lesson_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own versions" ON public.lesson_plan_versions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_lesson_plans_updated
  BEFORE UPDATE ON public.lesson_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();