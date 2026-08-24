import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

// ---------------------------------------------------------------------------
// Types — mirrors the lesson_plans / lesson_plan_versions pattern.
// ---------------------------------------------------------------------------
export type WorksheetStatus = "draft" | "saved";

export interface WorksheetRow {
  id: string;
  user_id: string;
  title: string;
  status: WorksheetStatus;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorksheetVersionRow {
  id: string;
  worksheet_id: string;
  user_id: string;
  version_no: number;
  label: string | null;
  form: Json;
  result: Json | null;
  created_at: string;
}

export interface WorksheetWithCurrent extends WorksheetRow {
  current: WorksheetVersionRow | null;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const jsonRecord = z.record(z.string(), z.unknown());

export const wsSaveInputSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  form: jsonRecord,
  result: z.unknown().optional(),
  status: z.enum(["draft", "saved"]).default("draft"),
  label: z.string().trim().max(120).optional(),
  /**
   * Optimistic-concurrency guard. With `id`, the save is rejected when the
   * worksheet's latest version_no on the server no longer matches this value
   * (another device saved in the meantime). `null` asserts "no versions yet".
   */
  expectedVersionNo: z.number().int().nonnegative().nullable().optional(),
});
export type WorksheetSaveInput = z.infer<typeof wsSaveInputSchema>;

export const wsListInputSchema = z.object({
  status: z.enum(["draft", "saved"]).optional(),
});
export const wsGetInputSchema = z.object({ id: z.string().uuid() });
export const wsListVersionsInputSchema = z.object({ worksheetId: z.string().uuid() });
export const wsRestoreInputSchema = z.object({
  worksheetId: z.string().uuid(),
  versionId: z.string().uuid(),
});
export const wsRenameInputSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
});

/** Thrown when a save loses an optimistic-concurrency race against another device. */
export class WorksheetConflictError extends Error {
  readonly code = "WORKSHEET_CONFLICT" as const;
  constructor(
    public readonly worksheetId: string,
    public readonly latestVersionNo: number | null,
    public readonly expectedVersionNo: number | null | undefined,
  ) {
    super(
      `WORKSHEET_CONFLICT: Worksheet was updated on another device (latest v${
        latestVersionNo ?? 0
      }, expected v${expectedVersionNo ?? 0}).`,
    );
    this.name = "WorksheetConflictError";
  }
}

/** True when an error crossed the RPC boundary carrying our conflict marker. */
export function isWorksheetConflict(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof WorksheetConflictError) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return msg.startsWith("WORKSHEET_CONFLICT");
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return e.code === "23505" || /duplicate key|unique constraint/i.test(e.message ?? "");
}

// ---------------------------------------------------------------------------
// Implementations — the Supabase client is injected so these stay unit-testable.
// ---------------------------------------------------------------------------
type SB = SupabaseClient<Database>;

export async function listWorksheetsImpl(
  supabase: SB,
  input: z.infer<typeof wsListInputSchema>,
): Promise<WorksheetRow[]> {
  let query = supabase.from("worksheets").select("*").order("updated_at", { ascending: false });
  if (input.status) query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as unknown as WorksheetRow[]) ?? [];
}

export async function getWorksheetImpl(
  supabase: SB,
  input: z.infer<typeof wsGetInputSchema>,
): Promise<WorksheetWithCurrent> {
  const { data: sheet, error } = await supabase
    .from("worksheets")
    .select("*")
    .eq("id", input.id)
    .single();
  if (error || !sheet) throw new Error(error?.message ?? "Worksheet not found");
  const row = sheet as unknown as WorksheetRow;
  let current: WorksheetVersionRow | null = null;
  if (row.current_version_id) {
    const { data: ver } = await supabase
      .from("worksheet_versions")
      .select("*")
      .eq("id", row.current_version_id)
      .maybeSingle();
    current = (ver as unknown as WorksheetVersionRow) ?? null;
  }
  return { ...row, current };
}

export async function listWorksheetVersionsImpl(
  supabase: SB,
  input: z.infer<typeof wsListVersionsInputSchema>,
): Promise<WorksheetVersionRow[]> {
  const { data, error } = await supabase
    .from("worksheet_versions")
    .select("*")
    .eq("worksheet_id", input.worksheetId)
    .order("version_no", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as unknown as WorksheetVersionRow[]) ?? [];
}

async function latestVersionNo(supabase: SB, worksheetId: string): Promise<number> {
  const { data } = await supabase
    .from("worksheet_versions")
    .select("version_no")
    .eq("worksheet_id", worksheetId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data as { version_no?: number } | null)?.version_no ?? 0) as number;
}

export async function saveWorksheetImpl(
  supabase: SB,
  userId: string,
  input: WorksheetSaveInput,
): Promise<WorksheetWithCurrent> {
  let worksheetId = input.id;
  if (worksheetId) {
    const { data: existing, error } = await supabase
      .from("worksheets")
      .select("id")
      .eq("id", worksheetId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!existing) throw new Error("Worksheet not found");
  } else {
    const { data: created, error } = await supabase
      .from("worksheets")
      .insert({
        user_id: userId,
        title: input.title ?? "Untitled worksheet",
        status: input.status,
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Failed to create worksheet");
    worksheetId = (created as { id: string }).id;
  }

  const latestNo = await latestVersionNo(supabase, worksheetId!);

  // Only enforced when the caller supplied a baseline (i.e. an existing
  // worksheet loaded from the server). Brand-new sheets skip the check.
  if (
    input.id &&
    input.expectedVersionNo !== undefined &&
    (input.expectedVersionNo ?? 0) !== latestNo
  ) {
    throw new WorksheetConflictError(worksheetId!, latestNo, input.expectedVersionNo);
  }

  const nextNo = latestNo + 1;

  const { data: version, error: verErr } = await supabase
    .from("worksheet_versions")
    .insert({
      worksheet_id: worksheetId,
      user_id: userId,
      version_no: nextNo,
      label: input.label ?? null,
      form: input.form as Json,
      result: (input.result ?? null) as Json,
    })
    .select("*")
    .single();
  if (verErr || !version) {
    // A concurrent save won the version_no race; the unique constraint
    // (worksheet_id, version_no) rejected our insert.
    if (isUniqueViolation(verErr)) {
      const nowLatest = (await latestVersionNo(supabase, worksheetId!)) || nextNo;
      throw new WorksheetConflictError(
        worksheetId!,
        nowLatest,
        input.expectedVersionNo ?? latestNo,
      );
    }
    throw new Error(verErr?.message ?? "Failed to save worksheet version");
  }

  const patch: { current_version_id: string; status: WorksheetStatus; title?: string } = {
    current_version_id: (version as { id: string }).id,
    status: input.status,
  };
  if (input.title) patch.title = input.title;
  const { data: sheet, error: updErr } = await supabase
    .from("worksheets")
    .update(patch)
    .eq("id", worksheetId)
    .select("*")
    .single();
  if (updErr || !sheet) throw new Error(updErr?.message ?? "Failed to update worksheet");

  return {
    ...(sheet as unknown as WorksheetRow),
    current: version as unknown as WorksheetVersionRow,
  };
}

export async function restoreWorksheetVersionImpl(
  supabase: SB,
  userId: string,
  input: z.infer<typeof wsRestoreInputSchema>,
): Promise<WorksheetWithCurrent> {
  const { data: source, error } = await supabase
    .from("worksheet_versions")
    .select("*")
    .eq("id", input.versionId)
    .eq("worksheet_id", input.worksheetId)
    .single();
  if (error || !source) throw new Error(error?.message ?? "Version not found");

  const nextNo = (await latestVersionNo(supabase, input.worksheetId)) + 1;
  const src = source as unknown as WorksheetVersionRow;
  const { data: version, error: verErr } = await supabase
    .from("worksheet_versions")
    .insert({
      worksheet_id: input.worksheetId,
      user_id: userId,
      version_no: nextNo,
      label: `Restored from v${src.version_no}`,
      form: src.form,
      result: src.result,
    })
    .select("*")
    .single();
  if (verErr || !version) throw new Error(verErr?.message ?? "Failed to restore version");

  const { data: sheet, error: updErr } = await supabase
    .from("worksheets")
    .update({ current_version_id: (version as { id: string }).id })
    .eq("id", input.worksheetId)
    .select("*")
    .single();
  if (updErr || !sheet) throw new Error(updErr?.message ?? "Failed to update worksheet");

  return {
    ...(sheet as unknown as WorksheetRow),
    current: version as unknown as WorksheetVersionRow,
  };
}

export async function renameWorksheetImpl(
  supabase: SB,
  input: z.infer<typeof wsRenameInputSchema>,
): Promise<WorksheetRow> {
  const { data, error } = await supabase
    .from("worksheets")
    .update({ title: input.title })
    .eq("id", input.id)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to rename");
  return data as unknown as WorksheetRow;
}

export async function deleteWorksheetImpl(
  supabase: SB,
  input: z.infer<typeof wsGetInputSchema>,
): Promise<{ ok: true }> {
  const { error } = await supabase.from("worksheets").delete().eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
