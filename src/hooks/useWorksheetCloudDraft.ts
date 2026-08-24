import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { getWorksheet, saveWorksheet } from "@/lib/worksheets.functions";
import { isWorksheetConflict } from "@/lib/worksheets.impl";

const WS_ID_KEY = "tts.worksheetCloudId.v1";

function readStoredId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(WS_ID_KEY);
  } catch {
    return null;
  }
}

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
 * Mirrors an in-progress worksheet to the user's account as
 * `worksheet_versions` snapshots (debounced), with the same optimistic
 * concurrency guard used by lesson plans: each save carries the version_no we
 * last observed, so a newer version written on another device is detected
 * instead of silently overwritten. Local storage keeps working regardless, so
 * work is never lost when the network or the server rejects a save.
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

  const [worksheetId, setWorksheetId] = useState<string | null>(readStoredId);
  const [cloudSavedAt, setCloudSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [baseVersionNo, setBaseVersionNo] = useState<number | null>(null);

  // Latest values for the debounced effect without re-arming on every keystroke
  // of unrelated state.
  const dataRef = useRef(data);
  const titleRef = useRef(title);
  dataRef.current = data;
  titleRef.current = title;

  const rememberId = useCallback((id: string | null) => {
    setWorksheetId(id);
    try {
      if (id) window.localStorage.setItem(WS_ID_KEY, id);
      else window.localStorage.removeItem(WS_ID_KEY);
    } catch {
      /* private mode — in-memory id still works for this session */
    }
  }, []);

  const runSave = useCallback(
    async (status: "draft" | "saved", label: string | undefined, force: boolean) => {
      const res = await saveFn({
        data: {
          id: worksheetId ?? undefined,
          title: titleRef.current?.trim() || "Untitled worksheet",
          form: dataRef.current,
          status,
          ...(label ? { label } : {}),
          ...(worksheetId && baseVersionNo !== null && !force
            ? { expectedVersionNo: baseVersionNo }
            : {}),
        },
      });
      rememberId(res.id);
      setBaseVersionNo(res.current?.version_no ?? null);
      setCloudSavedAt(Date.now());
      setConflict(null);
    },
    [saveFn, worksheetId, baseVersionNo, rememberId],
  );

  const save = useCallback(
    async (status: "draft" | "saved", o?: { force?: boolean }) => {
      if (!user) return;
      setSaving(true);
      try {
        await runSave(status, undefined, Boolean(o?.force));
      } catch (e: unknown) {
        if (isWorksheetConflict(e)) {
          setConflict(
            "A newer version of this worksheet was saved on another device. " +
              "Load it, or save again to overwrite it with your changes.",
          );
          // Next explicit save force-overwrites.
          setBaseVersionNo(null);
        } else {
          throw e;
        }
      } finally {
        setSaving(false);
      }
    },
    [user, runSave],
  );

  const pull = useCallback(async (): Promise<T | null> => {
    if (!user || !worksheetId) return null;
    const res = await getFn({ data: { id: worksheetId } });
    setBaseVersionNo(res.current?.version_no ?? null);
    setConflict(null);
    return (res.current?.form as T | undefined) ?? null;
  }, [user, worksheetId, getFn]);

  const dismissConflict = useCallback(() => setConflict(null), []);

  // Debounced cloud auto-draft.
  useEffect(() => {
    if (!user) return;
    if (isEmpty(data)) return;
    if (conflict) return; // wait for explicit user resolution
    const t = setTimeout(() => {
      void (async () => {
        try {
          await runSave("draft", "Auto-saved draft", false);
        } catch (e: unknown) {
          if (isWorksheetConflict(e)) {
            setConflict(
              "Cloud auto-save paused: a newer version exists on another device. " +
                "Load it, or save again to overwrite it.",
            );
            setBaseVersionNo(null);
          }
          /* other transient errors: the local draft still holds the work */
        }
      })();
    }, debounceMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, user?.id, conflict, baseVersionNo, worksheetId, debounceMs]);

  return { worksheetId, cloudSavedAt, saving, conflict, save, pull, dismissConflict };
}
