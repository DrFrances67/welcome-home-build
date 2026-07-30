import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

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
// Schemas — exported so tests and any other callers can validate inputs.
// ---------------------------------------------------------------------------
const jsonRecord = z.record(z.string(), z.unknown());

export const saveInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  form: jsonRecord,
  result: z.unknown().optional(),
  status: z.enum(["draft", "saved"]).default("draft"),
  label: z.string().trim().max(120).optional(),
  // Optimistic-concurrency guard. When provided together with `id`, the save
  // is rejected if the plan's latest version_no on the server no longer
  // matches this value — i.e. another device saved in the meantime. Use
  // `null` to assert "no versions exist yet". Omit to skip the check.
  expectedVersionNo: z.number().int().nonnegative().nullable().optional(),
});
export type SaveInput = z.infer<typeof saveInputSchema>;

/**
 * Thrown when a save loses an optimistic-concurrency race against another
 * device. Callers should surface a "reload to continue" prompt rather than
 * silently overwriting the newer version.
 */
export class LessonPlanConflictError extends Error {
  readonly code = "LESSON_PLAN_CONFLICT" as const;
  constructor(
    public readonly planId: string,
    public readonly latestVersionNo: number | null,
    public readonly expectedVersionNo: number | null | undefined,
  ) {
    super(
      `LESSON_PLAN_CONFLICT: Lesson plan was updated on another device (latest v${
        latestVersionNo ?? 0
      }, expected v${expectedVersionNo ?? 0}).`,
    );
    this.name = "LessonPlanConflictError";
  }
}

/** True when an error crossed the RPC boundary carrying our conflict marker. */
export function isLessonPlanConflict(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof LessonPlanConflictError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return msg.startsWith("LESSON_PLAN_CONFLICT");
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return e.code === "23505" || /duplicate key|unique constraint/i.test(e.message ?? "");
}

export const listInputSchema = z.object({
  status: z.enum(["draft", "saved"]).optional(),
});
export const getInputSchema = z.object({ id: z.string().uuid() });
export const listVersionsInputSchema = z.object({ planId: z.string().uuid() });
export const restoreInputSchema = z.object({
  planId: z.string().uuid(),
  versionId: z.string().uuid(),
});
export const renamePlanInputSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
});
export const renameVersionInputSchema = z.object({
  versionId: z.string().uuid(),
  label: z.string().trim().max(120).nullable(),
});

// ---------------------------------------------------------------------------
// Pure implementations — all DB access goes through a Supabase client passed
// in by the caller. The createServerFn wrappers in lesson-plans.functions.ts
// hand these the user-scoped client from requireSupabaseAuth; tests hand in
// an in-memory fake. Keeping the logic here makes it directly unit-testable.
// ---------------------------------------------------------------------------
type SB = SupabaseClient<Database>;

export async function listLessonPlansImpl(
  supabase: SB,
  input: z.infer<typeof listInputSchema>,
): Promise<LessonPlanRow[]> {
  let query = supabase.from("lesson_plans").select("*").order("updated_at", { ascending: false });
  if (input.status) query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as unknown as LessonPlanRow[]) ?? [];
}

export async function getLessonPlanImpl(
  supabase: SB,
  input: z.infer<typeof getInputSchema>,
): Promise<LessonPlanWithCurrent> {
  const { data: plan, error } = await supabase
    .from("lesson_plans")
    .select("*")
    .eq("id", input.id)
    .single();
  if (error || !plan) throw new Error(error?.message ?? "Lesson plan not found");
  const row = plan as unknown as LessonPlanRow;
  let current: LessonPlanVersionRow | null = null;
  if (row.current_version_id) {
    const { data: ver } = await supabase
      .from("lesson_plan_versions")
      .select("*")
      .eq("id", row.current_version_id)
      .maybeSingle();
    current = (ver as unknown as LessonPlanVersionRow) ?? null;
  }
  return { ...row, current };
}

export async function listVersionsImpl(
  supabase: SB,
  input: z.infer<typeof listVersionsInputSchema>,
): Promise<LessonPlanVersionRow[]> {
  const { data, error } = await supabase
    .from("lesson_plan_versions")
    .select("*")
    .eq("lesson_plan_id", input.planId)
    .order("version_no", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as LessonPlanVersionRow[]) ?? [];
}

export async function saveLessonPlanImpl(
  supabase: SB,
  userId: string,
  input: SaveInput,
): Promise<LessonPlanWithCurrent> {
  let planId = input.id;
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
        title: input.title ?? "Untitled lesson plan",
        status: input.status,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Failed to create lesson plan");
    planId = (created as { id: string }).id;
  }

  const { data: last } = await supabase
    .from("lesson_plan_versions")
    .select("version_no")
    .eq("lesson_plan_id", planId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestNo = ((last as { version_no?: number } | null)?.version_no ?? 0) as number;

  // Optimistic-concurrency check. Only enforced when the caller supplied a
  // baseline (existing plans that were loaded from the server); brand-new
  // plans and legacy callers skip it. `null` means "I saw zero versions".
  if (
    input.id &&
    input.expectedVersionNo !== undefined &&
    (input.expectedVersionNo ?? 0) !== latestNo
  ) {
    throw new LessonPlanConflictError(planId!, latestNo, input.expectedVersionNo);
  }

  const nextNo = latestNo + 1;

  const { data: version, error: verErr } = await supabase
    .from("lesson_plan_versions")
    .insert({
      lesson_plan_id: planId,
      user_id: userId,
      version_no: nextNo,
      label: input.label ?? null,
      form: input.form as Json,
      result: (input.result ?? null) as Json,
    })
    .select("*")
    .single();
  if (verErr || !version) {
    // A concurrent save on another device won the version_no race. The unique
    // constraint (lesson_plan_id, version_no) rejected our insert; re-read
    // the newest version_no so the caller can reconcile.
    if (isUniqueViolation(verErr)) {
      const { data: nowLast } = await supabase
        .from("lesson_plan_versions")
        .select("version_no")
        .eq("lesson_plan_id", planId)
        .order("version_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nowLatest = ((nowLast as { version_no?: number } | null)?.version_no ??
        nextNo) as number;
      throw new LessonPlanConflictError(planId!, nowLatest, input.expectedVersionNo ?? latestNo);
    }
    throw new Error(verErr?.message ?? "Failed to save version");
  }

  const patch: { current_version_id: string; status: LessonPlanStatus; title?: string } = {
    current_version_id: (version as { id: string }).id,
    status: input.status,
  };
  if (input.title) patch.title = input.title;
  const { data: plan, error: updErr } = await supabase
    .from("lesson_plans")
    .update(patch)
    .eq("id", planId)
    .select("*")
    .single();
  if (updErr || !plan) throw new Error(updErr?.message ?? "Failed to update lesson plan");

  return {
    ...(plan as unknown as LessonPlanRow),
    current: version as unknown as LessonPlanVersionRow,
  };
}

export async function restoreVersionImpl(
  supabase: SB,
  userId: string,
  input: z.infer<typeof restoreInputSchema>,
): Promise<LessonPlanWithCurrent> {
  const { data: source, error } = await supabase
    .from("lesson_plan_versions")
    .select("*")
    .eq("id", input.versionId)
    .eq("lesson_plan_id", input.planId)
    .single();
  if (error || !source) throw new Error(error?.message ?? "Version not found");

  const { data: last } = await supabase
    .from("lesson_plan_versions")
    .select("version_no")
    .eq("lesson_plan_id", input.planId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNo = (((last as { version_no?: number } | null)?.version_no ?? 0) as number) + 1;

  const src = source as unknown as LessonPlanVersionRow;
  const { data: version, error: verErr } = await supabase
    .from("lesson_plan_versions")
    .insert({
      lesson_plan_id: input.planId,
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
    .update({ current_version_id: (version as { id: string }).id })
    .eq("id", input.planId)
    .select("*")
    .single();
  if (updErr || !plan) throw new Error(updErr?.message ?? "Failed to update lesson plan");

  return {
    ...(plan as unknown as LessonPlanRow),
    current: version as unknown as LessonPlanVersionRow,
  };
}

export async function renameLessonPlanImpl(
  supabase: SB,
  input: z.infer<typeof renamePlanInputSchema>,
): Promise<LessonPlanRow> {
  const { data, error } = await supabase
    .from("lesson_plans")
    .update({ title: input.title })
    .eq("id", input.id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to rename");
  return data as unknown as LessonPlanRow;
}

export async function renameVersionImpl(
  supabase: SB,
  input: z.infer<typeof renameVersionInputSchema>,
): Promise<LessonPlanVersionRow> {
  const { data, error } = await supabase
    .from("lesson_plan_versions")
    .update({ label: input.label })
    .eq("id", input.versionId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to label version");
  return data as unknown as LessonPlanVersionRow;
}

export async function deleteLessonPlanImpl(
  supabase: SB,
  input: z.infer<typeof getInputSchema>,
): Promise<{ ok: true }> {
  const { error } = await supabase.from("lesson_plans").delete().eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteVersionImpl(
  supabase: SB,
  input: { versionId: string },
): Promise<{ ok: true }> {
  const { data: ver } = await supabase
    .from("lesson_plan_versions")
    .select("id, lesson_plan_id")
    .eq("id", input.versionId)
    .maybeSingle();
  if (ver) {
    const { lesson_plan_id } = ver as { id: string; lesson_plan_id: string };
    const { data: plan } = await supabase
      .from("lesson_plans")
      .select("current_version_id")
      .eq("id", lesson_plan_id)
      .maybeSingle();
    if ((plan as { current_version_id?: string } | null)?.current_version_id === input.versionId) {
      throw new Error("Cannot delete the current version. Restore another version first.");
    }
  }
  const { error } = await supabase.from("lesson_plan_versions").delete().eq("id", input.versionId);
  if (error) throw new Error(error.message);
  return { ok: true };
}
