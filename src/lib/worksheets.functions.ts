import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  deleteWorksheetImpl,
  getWorksheetImpl,
  listWorksheetVersionsImpl,
  listWorksheetsImpl,
  renameWorksheetImpl,
  restoreWorksheetVersionImpl,
  saveWorksheetImpl,
  wsGetInputSchema,
  wsListInputSchema,
  wsListVersionsInputSchema,
  wsRenameInputSchema,
  wsRestoreInputSchema,
  wsSaveInputSchema,
} from "./worksheets.impl";

export type {
  WorksheetRow,
  WorksheetStatus,
  WorksheetVersionRow,
  WorksheetWithCurrent,
} from "./worksheets.impl";

export const listWorksheets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => wsListInputSchema.parse(data ?? {}))
  .handler(({ context, data }) => listWorksheetsImpl(context.supabase, data));

export const getWorksheet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => wsGetInputSchema.parse(data))
  .handler(({ context, data }) => getWorksheetImpl(context.supabase, data));

export const listWorksheetVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => wsListVersionsInputSchema.parse(data))
  .handler(({ context, data }) => listWorksheetVersionsImpl(context.supabase, data));

export const saveWorksheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => wsSaveInputSchema.parse(data))
  .handler(({ context, data }) => saveWorksheetImpl(context.supabase, context.userId, data));

export const restoreWorksheetVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => wsRestoreInputSchema.parse(data))
  .handler(({ context, data }) =>
    restoreWorksheetVersionImpl(context.supabase, context.userId, data),
  );

export const renameWorksheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => wsRenameInputSchema.parse(data))
  .handler(({ context, data }) => renameWorksheetImpl(context.supabase, data));

export const deleteWorksheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => wsGetInputSchema.parse(data))
  .handler(({ context, data }) => deleteWorksheetImpl(context.supabase, data));
