-- Concurrency guard: two devices auto-saving the same lesson plan will each
-- compute the same next version_no. The unique constraint makes the second
-- insert fail with 23505, which the server turns into a typed conflict error
-- so the client can reconcile instead of silently overwriting.
ALTER TABLE public.lesson_plan_versions
  ADD CONSTRAINT lesson_plan_versions_plan_version_no_key
  UNIQUE (lesson_plan_id, version_no);