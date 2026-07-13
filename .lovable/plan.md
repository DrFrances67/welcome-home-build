# Saved Lesson Plans & Draft Version Control

A per-user library where teachers save finalized lesson plans and keep an editable draft history (multiple versions) they can browse and restore.

## Concepts

```text
lesson_plan  (one row per plan the user "owns")
   ├── status: "draft" | "saved"        ← finalized vs in-progress
   └── lesson_plan_version (many)         ← immutable snapshots = version history
          └── one is marked current_version_id on the parent
```

- A **lesson plan** is a container (title + which snapshot is "current").
- Every save writes a new **version** row (a full snapshot of the form + generated result). This gives multiple draft slots per plan and a restore trail automatically — restoring = copy an old version's content into a new current version.
- "Saved Lesson Plans" = plans with `status = 'saved'`; "Drafts" = `status = 'draft'`. Same tables, different filter.

## Database schema (Postgres / Lovable Cloud)

```sql
-- container
CREATE TABLE public.lesson_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled lesson plan',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','saved')),
  current_version_id uuid,          -- FK added after versions table exists
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- immutable snapshots (version history / draft slots)
CREATE TABLE public.lesson_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_plan_id uuid NOT NULL REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version_no int NOT NULL,           -- 1,2,3… per plan
  label text,                        -- optional user note e.g. "before revision"
  form jsonb NOT NULL,               -- the LP form (grade, subject, topic, diff…)
  result jsonb,                      -- generated lesson plan output, if any
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_plan_id, version_no)
);

ALTER TABLE public.lesson_plans
  ADD CONSTRAINT lesson_plans_current_version_fk
  FOREIGN KEY (current_version_id)
  REFERENCES public.lesson_plan_versions(id) ON DELETE SET NULL;

-- GRANTs (required before RLS is useful)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_plan_versions TO authenticated;
GRANT ALL ON public.lesson_plans TO service_role;
GRANT ALL ON public.lesson_plan_versions TO service_role;

-- RLS: users only touch their own rows
ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_plan_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own plans"    ON public.lesson_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own versions" ON public.lesson_plan_versions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- updated_at trigger reuses existing public.update_updated_at_column()
CREATE TRIGGER trg_lesson_plans_updated
  BEFORE UPDATE ON public.lesson_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

`form`/`result` are `jsonb` so the schema doesn't break every time the lesson-plan form gains a field.

## API architecture (TanStack `createServerFn`, RLS-scoped via `requireSupabaseAuth`)

All in `src/lib/lesson-plans.functions.ts`, called from `_authenticated` routes/components. No raw HTTP endpoints needed.

| Function | Method | Purpose |
|---|---|---|
| `listLessonPlans({ status })` | GET | Library list — filter `saved` vs `draft`, newest first. |
| `getLessonPlan({ id })` | GET | One plan + its current version's `form`/`result` (for opening/editing). |
| `listVersions({ planId })` | GET | Draft List UI — all snapshots (version_no, label, created_at). |
| `saveLessonPlan({ id?, title, form, result, status })` | POST | Create plan if no `id`; always insert a new version (`version_no = max+1`), set it as `current_version_id`, update `status`/`title`. This is the autosave + "finalize" entry point. |
| `restoreVersion({ planId, versionId })` | POST | Read the chosen snapshot, insert it as a new current version (non-destructive revert), return it for editing. |
| `renameVersion({ versionId, label })` | POST | Label a draft slot. |
| `deleteLessonPlan({ id })` / `deleteVersion({ versionId })` | POST | Cleanup. |

Bearer token is attached automatically by the existing `functionMiddleware` in `src/start.ts`.

## Frontend surface

- New protected route `src/routes/_authenticated/lesson-plans.tsx` (link it from `UserMenu` + Account).
  - **Tabs:** "Saved" and "Drafts".
  - **Plan card:** title, updated date, Open (loads into `LessonPlanGenerator`), Save-as-final, Delete.
  - **Draft List panel** (per plan): version rows with label + timestamp; a **Restore selector** (dropdown or radio list) → `restoreVersion` → opens in editor.
- `LessonPlanGenerator` gains: a `planId` prop, a "Save to account" button (calls `saveLessonPlan`), and its existing localStorage autosave stays as the anonymous/offline fallback. When signed in, autosave also debounces to `saveLessonPlan` as a draft version.

## Build order

1. Migration (tables + GRANT + RLS + trigger) — needs your approval.
2. `lesson-plans.functions.ts` server functions.
3. `_authenticated/lesson-plans.tsx` route (list + Draft List + Restore selector).
4. Wire `LessonPlanGenerator` save/open/restore + nav links.
5. Tests for save→version→restore flow.

## Notes / decisions

- Version history is capped implicitly by user action; optionally add a "keep last N drafts" prune in `saveLessonPlan` if storage becomes a concern.
- Reuses the existing `has_role`/auth stack — no new auth work.
- Keeping `form` as `jsonb` means no migration churn as the lesson form evolves.
