import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  deleteLessonPlanImpl,
  deleteVersionImpl,
  getInputSchema,
  getLessonPlanImpl,
  listInputSchema,
  listLessonPlansImpl,
  listVersionsImpl,
  listVersionsInputSchema,
  renameLessonPlanImpl,
  renamePlanInputSchema,
  renameVersionImpl,
  renameVersionInputSchema,
  restoreInputSchema,
  restoreVersionImpl,
  saveInputSchema,
  saveLessonPlanImpl,
} from "./lesson-plans.impl";
import { z } from "zod";

export type {
  LessonPlanRow,
  LessonPlanStatus,
  LessonPlanVersionRow,
  LessonPlanWithCurrent,
} from "./lesson-plans.impl";

export const listLessonPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listInputSchema.parse(data ?? {}))
  .handler(({ context, data }) => listLessonPlansImpl(context.supabase, data));

export const getLessonPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => getInputSchema.parse(data))
  .handler(({ context, data }) => getLessonPlanImpl(context.supabase, data));

export const listVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => listVersionsInputSchema.parse(data))
  .handler(({ context, data }) => listVersionsImpl(context.supabase, data));

export const saveLessonPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveInputSchema.parse(data))
  .handler(({ context, data }) => saveLessonPlanImpl(context.supabase, context.userId, data));

export const restoreVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => restoreInputSchema.parse(data))
  .handler(({ context, data }) => restoreVersionImpl(context.supabase, context.userId, data));

export const renameLessonPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => renamePlanInputSchema.parse(data))
  .handler(({ context, data }) => renameLessonPlanImpl(context.supabase, data));

export const renameVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => renameVersionInputSchema.parse(data))
  .handler(({ context, data }) => renameVersionImpl(context.supabase, data));

export const deleteLessonPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => getInputSchema.parse(data))
  .handler(({ context, data }) => deleteLessonPlanImpl(context.supabase, data));

export const deleteVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ versionId: z.string().uuid() }).parse(data))
  .handler(({ context, data }) => deleteVersionImpl(context.supabase, data));
