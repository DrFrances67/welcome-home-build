import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Shared cloud-draft engine used by both the worksheet builder and the lesson
 * plan generator. Both features mirror in-progress work to the user's account
 * as append-only version snapshots with the same optimistic-concurrency guard,
 * so the logic lives here once:
 *
 *  - debounced auto-draft that only fires when the content actually changed
 *    (a successful save must never re-arm the timer, or the document would
 *    version itself forever while sitting idle),
 *  - a per-user localStorage key so a second account on the same browser never
 *    reuses a row it cannot see,
 *  - recovery when the remembered row was deleted or belongs to another user,
 *  - conflict detection with "load newest" / "overwrite" resolution,
 *  - local drafts keep working when the network or server rejects a save.
 */

export interface CloudVersion {
  version_no?: number | null;
  form?: unknown;
  result?: unknown;
}

export interface CloudSaveResult {
  id: string;
  current?: CloudVersion | null;
}

export interface CloudDraftOptions<T> {
  /** Content being mirrored. */
  data: T;
  /** Human title for the row. */
  title: string;
  /** Skip auto-save while the document is still an untouched default. */
  isEmpty: (data: T) => boolean;
  /** Recognises this feature's optimistic-concurrency error. */
  isConflict: (err: unknown) => boolean;
  /** Server function that writes a new version. */
  save: (payload: {
    id?: string;
    title: string;
    form: T;
    status: "draft" | "saved";
    label?: string;
    expectedVersionNo?: number | null;
    [k: string]: unknown;
  }) => Promise<CloudSaveResult>;
  /** Server function that reads the row with its current version. */
  load: (args: { id: string }) => Promise<{ current?: CloudVersion | null }>;
  /** localStorage key prefix; the signed-in user id is appended. */
  storagePrefix: string;
  /** Extra fields merged into every save payload (e.g. a generated result). */
  extraPayload?: () => Record<string, unknown>;
  /** Message shown when an explicit save loses the race. */
  conflictMessage?: string;
  /** Message shown when the auto-draft loses the race. */
  autoConflictMessage?: string;
  /** Matches the server's "row is gone" error. */
  missingPattern?: RegExp;
  debounceMs?: number;
}

export interface CloudDraft<T> {
  /** Row id in the account, once one exists. */
  documentId: string;
  /** Timestamp of the last successful cloud save. */
  cloudSavedAt: number | null;
  /** True while a cloud save is in flight. */
  saving: boolean;
  /** Set when another device saved a newer version; auto-save pauses. */
  conflict: string | null;
  /** Explicit save. `force` overwrites the server copy. */
  save: (status: "draft" | "saved", opts?: { force?: boolean }) => Promise<CloudSaveResult>;
  /** Pull the newest server version and hand it to the caller. */
  pull: () => Promise<CloudVersion | null>;
  /** Dismiss the conflict banner and resume auto-save. */
  dismissConflict: () => void;
}

// documentId is typed as string | null at runtime; the alias keeps the public
// shape readable above.
type Id = string | null;

function storageKey(prefix: string, userId: string): string {
  return `${prefix}:${userId}`;
}

function readStoredId(prefix: string, userId: string | undefined): Id {
  if (typeof window === "undefined" || !userId) return null;
  try {
    return window.localStorage.getItem(storageKey(prefix, userId));
  } catch {
    return null;
  }
}

export function useCloudDraft<T extends Record<string, unknown>>(
  opts: CloudDraftOptions<T>,
): Omit<CloudDraft<T>, "documentId"> & { documentId: Id } {
  const {
    data,
    title,
    isEmpty,
    isConflict,
    save: saveFn,
    load: loadFn,
    storagePrefix,
    extraPayload,
    conflictMessage = "A newer version was saved on another device. Load it, or save again to overwrite it with your changes.",
    autoConflictMessage = "Cloud auto-save paused: a newer version exists on another device. Load it, or save again to overwrite it.",
    missingPattern = /not found/i,
    debounceMs = 5000,
  } = opts;

  const { user } = useAuth();

  const [documentId, setDocumentId] = useState<Id>(null);
  const [cloudSavedAt, setCloudSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  // Refs, not state: these must not re-arm the debounce timer, otherwise a
  // successful save (which bumps the version) would schedule the next one.
  const baseVersionNoRef = useRef<number | null>(null);
  const documentIdRef = useRef<Id>(null);
  const lastSyncedSnapshotRef = useRef<string | null>(null);

  const dataRef = useRef(data);
  const titleRef = useRef(title);
  const extraRef = useRef(extraPayload);
  dataRef.current = data;
  titleRef.current = title;
  extraRef.current = extraPayload;

  const rememberId = useCallback(
    (id: Id) => {
      documentIdRef.current = id;
      setDocumentId(id);
      if (!user) return;
      try {
        if (id) window.localStorage.setItem(storageKey(storagePrefix, user.id), id);
        else window.localStorage.removeItem(storageKey(storagePrefix, user.id));
      } catch {
        /* private mode — the in-memory id still works for this session */
      }
    },
    [user, storagePrefix],
  );

  // Rehydrate (and reset) the remembered id whenever the signed-in user changes.
  useEffect(() => {
    const id = readStoredId(storagePrefix, user?.id);
    documentIdRef.current = id;
    setDocumentId(id);
    baseVersionNoRef.current = null;
    lastSyncedSnapshotRef.current = null;
    setCloudSavedAt(null);
    setConflict(null);
  }, [user?.id, storagePrefix]);

  const snapshotOf = useCallback(
    () => JSON.stringify({ t: titleRef.current ?? "", d: dataRef.current }),
    [],
  );

  const runSave = useCallback(
    async (status: "draft" | "saved", label: string | undefined, force: boolean) => {
      const snapshot = snapshotOf();
      const id = documentIdRef.current;
      const base = baseVersionNoRef.current;
      const payload = {
        id: id ?? undefined,
        title: titleRef.current?.trim() || "Untitled",
        form: dataRef.current,
        status,
        ...(extraRef.current?.() ?? {}),
        ...(label ? { label } : {}),
        ...(id && base !== null && !force ? { expectedVersionNo: base } : {}),
      };

      let res: CloudSaveResult;
      try {
        res = await saveFn(payload);
      } catch (e: unknown) {
        // The remembered row is gone or belongs to another account: start a new one.
        const msg = e instanceof Error ? e.message : String(e ?? "");
        if (id && !isConflict(e) && missingPattern.test(msg)) {
          rememberId(null);
          baseVersionNoRef.current = null;
          res = await saveFn({ ...payload, id: undefined, expectedVersionNo: undefined });
        } else {
          throw e;
        }
      }

      rememberId(res.id);
      baseVersionNoRef.current = res.current?.version_no ?? null;
      lastSyncedSnapshotRef.current = snapshot;
      setCloudSavedAt(Date.now());
      setConflict(null);
      return res;
    },
    [saveFn, rememberId, snapshotOf, isConflict, missingPattern],
  );

  const save = useCallback(
    async (status: "draft" | "saved", o?: { force?: boolean }) => {
      if (!user) throw new Error("Sign in to save to your account.");
      setSaving(true);
      try {
        return await runSave(status, undefined, Boolean(o?.force));
      } catch (e: unknown) {
        if (isConflict(e)) {
          setConflict(conflictMessage);
          // Next explicit save force-overwrites.
          baseVersionNoRef.current = null;
        }
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [user, runSave, isConflict, conflictMessage],
  );

  const pull = useCallback(async (): Promise<CloudVersion | null> => {
    const id = documentIdRef.current;
    if (!user || !id) return null;
    const res = await loadFn({ id });
    baseVersionNoRef.current = res.current?.version_no ?? null;
    lastSyncedSnapshotRef.current = null;
    setConflict(null);
    return res.current ?? null;
  }, [user, loadFn]);

  const dismissConflict = useCallback(() => setConflict(null), []);

  // Debounced cloud auto-draft. Only content changes re-arm it, and an
  // unchanged snapshot is never re-saved.
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
          if (isConflict(e)) {
            setConflict(autoConflictMessage);
            baseVersionNoRef.current = null;
          }
          /* other transient errors: the local draft still holds the work */
        }
      })();
    }, debounceMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSnapshot, user?.id, conflict, debounceMs]);

  return { documentId, cloudSavedAt, saving, conflict, save, pull, dismissConflict };
}
