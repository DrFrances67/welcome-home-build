import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { getWorksheet, saveWorksheet } from "@/lib/worksheets.functions";
import { isWorksheetConflict } from "@/lib/worksheets.impl";
import { useCloudDraft, type CloudSaveResult } from "@/hooks/useCloudDraft";

const WS_ID_PREFIX = "tts.worksheetCloudId.v1";

export interface WorksheetCloudDraft<T> {
  /** Worksheet row id in the account, once one exists. */
  worksheetId: string | null;
  /** Timestamp of the last successful cloud save. */
  cloudSavedAt: number | null;
  /** True while a cloud save is in flight. */
  saving: boolean;
  /** Set when another device saved a newer version; auto-save pauses. */
  conflict: string | null;
  /** Explicit save (e.g. a "Save to account" button). `force` overwrites. */
  save: (status: "draft" | "saved", opts?: { force?: boolean }) => Promise<void>;
  /** Pull the newest server version and hand it to the caller. */
  pull: () => Promise<T | null>;
  /** Dismiss the conflict banner and resume auto-save from the server state. */
  dismissConflict: () => void;
}

/**
 * Worksheet-specific binding of the shared cloud-draft engine
 * (`useCloudDraft`): mirrors the in-progress worksheet to the user's account as
 * `worksheet_versions` snapshots with optimistic concurrency, while the local
 * draft keeps working regardless.
 */
export function useWorksheetCloudDraft<T extends Record<string, unknown>>(opts: {
  data: T;
  title: string;
  /** Skip auto-save while the worksheet is still an untouched default. */
  isEmpty: (data: T) => boolean;
  debounceMs?: number;
}): WorksheetCloudDraft<T> {
  const { data, title, isEmpty, debounceMs = 5000 } = opts;
  const { user } = useAuth();
  const saveFn = useServerFn(saveWorksheet);
  const getFn = useServerFn(getWorksheet);

  const draft = useCloudDraft<T>({
    data,
    title,
    isEmpty,
    isConflict: isWorksheetConflict,
    storagePrefix: WS_ID_PREFIX,
    debounceMs,
    missingPattern: /worksheet not found/i,
    conflictMessage:
      "A newer version of this worksheet was saved on another device. " +
      "Load it, or save again to overwrite it with your changes.",
    autoConflictMessage:
      "Cloud auto-save paused: a newer version exists on another device. " +
      "Load it, or save again to overwrite it.",
    save: (payload) => saveFn({ data: payload }) as Promise<CloudSaveResult>,
    load: (args) => getFn({ data: args }) as Promise<{ current?: { version_no?: number } | null }>,
  });

  const save = useCallback(
    async (status: "draft" | "saved", o?: { force?: boolean }) => {
      if (!user) return;
      try {
        await draft.save(status, o);
      } catch (e: unknown) {
        // Conflicts surface through `conflict`; anything else is a real error.
        if (!isWorksheetConflict(e)) throw e;
      }
    },
    [user, draft],
  );

  const pull = useCallback(async (): Promise<T | null> => {
    const current = await draft.pull();
    return ((current?.form as T | undefined) ?? null) as T | null;
  }, [draft]);

  return {
    worksheetId: draft.documentId,
    cloudSavedAt: draft.cloudSavedAt,
    saving: draft.saving,
    conflict: draft.conflict,
    save,
    pull,
    dismissConflict: draft.dismissConflict,
  };
}
