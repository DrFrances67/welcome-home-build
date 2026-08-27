import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import { getWorksheet, saveWorksheet } from "@/lib/worksheets.functions";
import { isWorksheetConflict } from "@/lib/worksheets.impl";

const WS_ID_PREFIX = "tts.worksheetCloudId.v1";

/** Per-user key so a second account on the same browser never reuses a row it cannot see. */
function storageKey(userId: string): string {
  return `${WS_ID_PREFIX}:${userId}`;
}

function readStoredId(userId: string | undefined): string | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    return window.localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

function isMissingWorksheet(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /worksheet not found/i.test(msg);
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

  const [worksheetId, setWorksheetId] = useState<string | null>(null);
  const [cloudSavedAt, setCloudSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  // Kept in refs: these must not re-arm the debounce timer, otherwise a
  // successful save (which bumps the version) would schedule the next one and
  // the worksheet would keep versioning itself forever with unchanged content.
  const baseVersionNoRef = useRef<number | null>(null);
  const worksheetIdRef = useRef<string | null>(null);
  const lastSyncedSnapshotRef = useRef<string | null>(null);

  const dataRef = useRef(data);
  const titleRef = useRef(title);
  dataRef.current = data;
  titleRef.current = title;

  const rememberId = useCallback(
    (id: string | null) => {
      worksheetIdRef.current = id;
      setWorksheetId(id);
      if (!user) return;
      try {
        if (id) window.localStorage.setItem(storageKey(user.id), id);
        else window.localStorage.removeItem(storageKey(user.id));
      } catch {
        /* private mode — in-memory id still works for this session */
      }
    },
    [user],
  );

  // Rehydrate (and reset) the remembered id whenever the signed-in user changes.
  useEffect(() => {
    const id = readStoredId(user?.id);
    worksheetIdRef.current = id;
    setWorksheetId(id);
    baseVersionNoRef.current = null;
    lastSyncedSnapshotRef.current = null;
    setCloudSavedAt(null);
    setConflict(null);
  }, [user?.id]);

  const snapshotOf = useCallback(
    () => JSON.stringify({ t: titleRef.current ?? "", d: dataRef.current }),
    [],
  );

  const runSave = useCallback(
    async (status: "draft" | "saved", label: string | undefined, force: boolean) => {
      const snapshot = snapshotOf();
      const id = worksheetIdRef.current;
      const base = baseVersionNoRef.current;
      const payload = {
        id: id ?? undefined,
        title: titleRef.current?.trim() || "Untitled worksheet",
        form: dataRef.current,
        status,
        ...(label ? { label } : {}),
        ...(id && base !== null && !force ? { expectedVersionNo: base } : {}),
      };

      let res;
      try {
        res = await saveFn({ data: payload });
      } catch (e: unknown) {
        // The remembered row is gone or belongs to another account: start a new one.
        if (id && isMissingWorksheet(e)) {
          rememberId(null);
          baseVersionNoRef.current = null;
          res = await saveFn({ data: { ...payload, id: undefined, expectedVersionNo: undefined } });
        } else {
          throw e;
        }
      }

      rememberId(res.id);
      baseVersionNoRef.current = res.current?.version_no ?? null;
      lastSyncedSnapshotRef.current = snapshot;
      setCloudSavedAt(Date.now());
      setConflict(null);
    },
    [saveFn, rememberId, snapshotOf],
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
          baseVersionNoRef.current = null;
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
    baseVersionNoRef.current = res.current?.version_no ?? null;
    lastSyncedSnapshotRef.current = null;
    setConflict(null);
    return (res.current?.form as T | undefined) ?? null;
  }, [user, worksheetId, getFn]);

  const dismissConflict = useCallback(() => setConflict(null), []);

  // Debounced cloud auto-draft. Only content changes (data/title) re-arm it, and
  // an unchanged snapshot is never re-saved.
  const currentSnapshot = JSON.stringify({ t: title ?? "", d: data });
  useEffect(() => {
    if (!user) return;
    if (isEmpty(data)) return;
    if (conflict) return; // wait for explicit user resolution
    if (lastSyncedSnapshotRef.current === currentSnapshot) return;
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
            baseVersionNoRef.current = null;
          }
          /* other transient errors: the local draft still holds the work */
        }
      })();
    }, debounceMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSnapshot, user?.id, conflict, debounceMs]);

  return { worksheetId, cloudSavedAt, saving, conflict, save, pull, dismissConflict };
}
