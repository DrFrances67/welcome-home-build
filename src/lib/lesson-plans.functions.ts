import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type LessonPlanStatus = "draft" | "saved";

export interface LessonPlanRow {
  id: string;
  user_id: string;
  title: string;
  status: LessonPlanStatus;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LessonPlanVersionRow {
  id: string;
  lesson_plan_id: string;
  user_id: string;
  version_no: number;
  label: string | null;
  form: Json;
  result: Json | null;
  created_at: string;
}

export interface LessonPlanWithCurrent extends LessonPlanRow {
  current: LessonPlanVersionRow | null;
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------
const jsonRecord = z.record(z.string(), z.unknown());

const saveInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  form: jsonRecord,
  result: z.unknown().optional(),
  status: z.enum(["draft", "saved"]).default("draft"),
  label: z.string().trim().max(120).optional(),
});

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------
export const listLessonPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ status: z.enum(["draft", "saved"]).optional() }).parse(data ?? {}),
  )
  .handler(async ({ context, data }): Promise<LessonPlanRow[]> => {
    let query = context.supabase
      .from("lesson_plans")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data.status) query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows as LessonPlanRow[]) ?? [];
  });

export const getLessonPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<LessonPlanWithCurrent> => {
    const { data: plan, error } = await context.supabase
      .from("lesson_plans")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !plan) throw new Error(error?.message ?? "Lesson plan not found");

    let current: LessonPlanVersionRow | null = null;
    const currentId = (plan as LessonPlanRow).current_version_id;
    if (currentId) {
      const { data: ver } = await context.supabase
        .from("lesson_plan_versions")
        .select("*")
        .eq("id", currentId)
        .maybeSingle();
      current = (ver as LessonPlanVersionRow) ?? null;
    }
    return { ...(plan as LessonPlanRow), current };
  });

export const listVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ planId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<LessonPlanVersionRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("lesson_plan_versions")
      .select("*")
      .eq("lesson_plan_id", data.planId)
      .order("version_no", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows as LessonPlanVersionRow[]) ?? [];
  });

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Create-or-update a lesson plan and always append a new immutable version
 * snapshot, marking it as the plan's current version.
 * This is the single entry point used by both autosave (status="draft") and
 * finalize (status="saved").
 */
export const saveLessonPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => saveInput.parse(data))
  .handler(async ({ context, data }): Promise<LessonPlanWithCurrent> => {
    const { supabase, userId } = context;

    // 1. Ensure a plan container exists.
    let planId = data.id;
    if (planId) {
      const { data: existing, error } = await supabase
        .from("lesson_plans")
        .select("id")
        .eq("id", planId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!existing) throw new Error("Lesson plan not found");
    } else {
      const { data: created, error } = await supabase
        .from("lesson_plans")
        .insert({
          user_id: userId,
          title: data.title ?? "Untitled lesson plan",
          status: data.status,
        })
        .select("id")
        .single();
      if (error || !created) throw new Error(error?.message ?? "Failed to create lesson plan");
      planId = created.id;
    }

    // 2. Determine next version number.
    const { data: last } = await supabase
      .from("lesson_plan_versions")
      .select("version_no")
      .eq("lesson_plan_id", planId)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNo = ((last?.version_no as number | undefined) ?? 0) + 1;

    // 3. Insert the snapshot.
    const { data: version, error: verErr } = await supabase
      .from("lesson_plan_versions")
      .insert({
        lesson_plan_id: planId,
        user_id: userId,
        version_no: nextNo,
        label: data.label ?? null,
        form: data.form as Json,
        result: (data.result ?? null) as Json,
      })
      .select("*")
      .single();
    if (verErr || !version) throw new Error(verErr?.message ?? "Failed to save version");

    // 4. Point the plan at the new current version (+ title/status if provided).
    const patch: { current_version_id: string; status: LessonPlanStatus; title?: string } = {
      current_version_id: version.id,
      status: data.status,
    };
    if (data.title) patch.title = data.title;
    const { data: plan, error: updErr } = await supabase
      .from("lesson_plans")
      .update(patch)
      .eq("id", planId)
      .select("*")
      .single();
    if (updErr || !plan) throw new Error(updErr?.message ?? "Failed to update lesson plan");

    return { ...(plan as LessonPlanRow), current: version as LessonPlanVersionRow };
  });

/**
 * Non-destructive revert: copies the chosen snapshot into a brand-new current
 * version so history is preserved. Returns the plan with its new current version.
 */
export const restoreVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ planId: z.string().uuid(), versionId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }): Promise<LessonPlanWithCurrent> => {
    const { supabase, userId } = context;

    const { data: source, error } = await supabase
      .from("lesson_plan_versions")
      .select("*")
      .eq("id", data.versionId)
      .eq("lesson_plan_id", data.planId)
      .single();
    if (error || !source) throw new Error(error?.message ?? "Version not found");

    const { data: last } = await supabase
      .from("lesson_plan_versions")
      .select("version_no")
      .eq("lesson_plan_id", data.planId)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNo = ((last?.version_no as number | undefined) ?? 0) + 1;

    const src = source as LessonPlanVersionRow;
    const { data: version, error: verErr } = await supabase
      .from("lesson_plan_versions")
      .insert({
        lesson_plan_id: data.planId,
        user_id: userId,
        version_no: nextNo,
        label: `Restored from v${src.version_no}`,
        form: src.form,
        result: src.result,
      })
      .select("*")
      .single();
    if (verErr || !version) throw new Error(verErr?.message ?? "Failed to restore version");

    const { data: plan, error: updErr } = await supabase
      .from("lesson_plans")
      .update({ current_version_id: version.id })
      .eq("id", data.planId)
      .select("*")
      .single();
    if (updErr || !plan) throw new Error(updErr?.message ?? "Failed to update lesson plan");

    return { ...(plan as LessonPlanRow), current: version as LessonPlanVersionRow };
  });

export const renameLessonPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(200) }).parse(data),
  )
  .handler(async ({ context, data }): Promise<LessonPlanRow> => {
    const { data: plan, error } = await context.supabase
      .from("lesson_plans")
      .update({ title: data.title })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error || !plan) throw new Error(error?.message ?? "Failed to rename");
    return plan as LessonPlanRow;
  });

export const renameVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ versionId: z.string().uuid(), label: z.string().trim().max(120).nullable() })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<LessonPlanVersionRow> => {
    const { data: ver, error } = await context.supabase
      .from("lesson_plan_versions")
      .update({ label: data.label })
      .eq("id", data.versionId)
      .select("*")
      .single();
    if (error || !ver) throw new Error(error?.message ?? "Failed to label version");
    return ver as LessonPlanVersionRow;
  });

export const deleteLessonPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.from("lesson_plans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ versionId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    // Guard: don't delete the version currently marked as current.
    const { data: ver } = await context.supabase
      .from("lesson_plan_versions")
      .select("id, lesson_plan_id")
      .eq("id", data.versionId)
      .maybeSingle();
    if (ver) {
      const { data: plan } = await context.supabase
        .from("lesson_plans")
        .select("current_version_id")
        .eq("id", ver.lesson_plan_id)
        .maybeSingle();
      if (plan?.current_version_id === data.versionId) {
        throw new Error("Cannot delete the current version. Restore another version first.");
      }
    }
    const { error } = await context.supabase
      .from("lesson_plan_versions")
      .delete()
      .eq("id", data.versionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
