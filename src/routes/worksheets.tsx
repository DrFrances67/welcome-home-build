import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import {
  listWorksheets,
  listWorksheetVersions,
  getWorksheet,
  restoreWorksheetVersion,
  renameWorksheet,
  deleteWorksheet,
  deleteWorksheetVersion,
  type WorksheetRow,
  type WorksheetVersionRow,
} from "@/lib/worksheets.functions";

const WS_DRAFT_KEY = "tts.worksheetDraft.v1";
const WS_ID_PREFIX = "tts.worksheetCloudId.v1";

export const Route = createFileRoute("/worksheets")({
  head: () => ({
    meta: [
      { title: "Saved Worksheets — The Tech Savvy Teacher" },
      {
        name: "description",
        content:
          "Your saved worksheets and draft version history. Reopen a worksheet, restore an earlier draft, or clear versions you no longer need.",
      },
      { property: "og:title", content: "Saved Worksheets — The Tech Savvy Teacher" },
      {
        property: "og:description",
        content: "Manage saved worksheets and draft versions on The Tech Savvy Teacher.",
      },
      { property: "og:url", content: "https://techsavvyteacher.app/worksheets" },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://techsavvyteacher.app/worksheets" }],
  }),
  component: WorksheetsPage,
});

type Tab = "saved" | "draft";

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const s = Math.max(1, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function WorksheetsPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const list = useServerFn(listWorksheets);
  const getOne = useServerFn(getWorksheet);
  const del = useServerFn(deleteWorksheet);
  const rename = useServerFn(renameWorksheet);

  const [tab, setTab] = useState<Tab>("saved");
  const [sheets, setSheets] = useState<WorksheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user)
      navigate({ to: "/auth", search: { mode: "signin", next: "/worksheets" } });
  }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await list({ data: { status: tab } });
      setSheets(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load worksheets.");
    } finally {
      setLoading(false);
    }
  }, [list, tab]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const openForEditing = async (id: string, form?: Record<string, unknown> | null) => {
    let formToUse = form;
    if (!formToUse) {
      const ws = await getOne({ data: { id } });
      formToUse = (ws.current?.form as Record<string, unknown>) ?? null;
    }
    if (formToUse) {
      try {
        window.localStorage.setItem(WS_DRAFT_KEY, JSON.stringify(formToUse));
        if (user) window.localStorage.setItem(`${WS_ID_PREFIX}:${user.id}`, id);
      } catch {
        /* private mode — the worksheet still opens with server data next time */
      }
    }
    navigate({ to: "/" });
  };

  const handleRename = async (ws: WorksheetRow) => {
    const next = window.prompt("Rename worksheet", ws.title);
    if (next == null || !next.trim() || next.trim() === ws.title) return;
    try {
      await rename({ data: { id: ws.id, title: next.trim() } });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed.");
    }
  };

  const handleDelete = async (ws: WorksheetRow) => {
    if (!window.confirm(`Delete "${ws.title}"? This removes all its draft versions.`)) return;
    try {
      await del({ data: { id: ws.id } });
      setExpanded((x) => (x === ws.id ? null : x));
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    }
  };

  if (authLoading || !user) return null;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "80px 20px 60px" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>
          Saved Worksheets
        </h1>
        <Link to="/" style={{ fontSize: 13, color: "#7c3aed", fontWeight: 600 }}>
          ← Back to tools
        </Link>
      </div>
      <p style={{ color: "#64748b", marginBottom: 20, fontSize: 14 }}>
        Reopen a worksheet to keep editing, restore an earlier draft, or delete versions you no
        longer need.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["saved", "draft"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => {
              setExpanded(null);
              setTab(t);
            }}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: tab === t ? "#7c3aed" : "white",
              color: tab === t ? "white" : "#0f172a",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {t === "saved" ? "Saved" : "Drafts"}
          </button>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
            background: "#fef2f2",
            color: "#991b1b",
            border: "1px solid #fecaca",
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: "#64748b" }}>Loading…</p>
      ) : sheets.length === 0 ? (
        <div
          style={{
            background: "white",
            padding: 32,
            borderRadius: 12,
            border: "1px dashed #cbd5e1",
            textAlign: "center",
            color: "#64748b",
          }}
        >
          <p style={{ marginBottom: 12 }}>
            {tab === "saved" ? "No saved worksheets yet." : "No drafts yet."}
          </p>
          <Link to="/" style={{ color: "#7c3aed", fontWeight: 700 }}>
            Create a worksheet →
          </Link>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
          {sheets.map((ws) => (
            <li
              key={ws.id}
              style={{
                background: "white",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15 }}>{ws.title}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                    Updated {timeAgo(ws.updated_at)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button style={btnPrimary} onClick={() => openForEditing(ws.id)}>
                    Open & edit
                  </button>
                  <button
                    style={btn}
                    onClick={() => setExpanded((x) => (x === ws.id ? null : ws.id))}
                    aria-expanded={expanded === ws.id}
                  >
                    {expanded === ws.id ? "Hide drafts" : "Draft history"}
                  </button>
                  <button style={btn} onClick={() => handleRename(ws)}>
                    Rename
                  </button>
                  <button style={btnDanger} onClick={() => handleDelete(ws)}>
                    Delete
                  </button>
                </div>
              </div>

              {expanded === ws.id && (
                <WorksheetDraftList worksheetId={ws.id} onOpen={openForEditing} onChanged={load} />
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function WorksheetDraftList({
  worksheetId,
  onOpen,
  onChanged,
}: {
  worksheetId: string;
  onOpen: (id: string, form: Record<string, unknown>) => void;
  onChanged: () => void;
}) {
  const versionsFn = useServerFn(listWorksheetVersions);
  const restoreFn = useServerFn(restoreWorksheetVersion);
  const deleteVersionFn = useServerFn(deleteWorksheetVersion);

  const [versions, setVersions] = useState<WorksheetVersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await versionsFn({ data: { worksheetId } });
      setVersions(rows);
      setSelected(rows[0]?.id ?? "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load versions.");
    } finally {
      setLoading(false);
    }
  }, [versionsFn, worksheetId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const restore = async () => {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    try {
      await restoreFn({ data: { worksheetId, versionId: selected } });
      await reload();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Restore failed.");
    } finally {
      setBusy(false);
    }
  };

  const removeVersion = async (v: WorksheetVersionRow) => {
    if (!window.confirm(`Delete version v${v.version_no}? This cannot be undone.`)) return;
    setErr(null);
    try {
      await deleteVersionFn({ data: { versionId: v.id } });
      await reload();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not delete that version.");
    }
  };

  return (
    <div style={{ borderTop: "1px solid #eef2f7", background: "#f8fafc", padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 10 }}>
        DRAFT VERSIONS
      </div>

      {err && (
        <p role="alert" style={{ color: "#991b1b", fontSize: 13, marginBottom: 10 }}>
          {err}
        </p>
      )}

      {loading ? (
        <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading versions…</p>
      ) : versions.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: 13 }}>No versions yet.</p>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 12,
              flexWrap: "wrap",
            }}
          >
            <label
              htmlFor={`ws-restore-${worksheetId}`}
              style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}
            >
              Restore version:
            </label>
            <select
              id={`ws-restore-${worksheetId}`}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              style={{
                padding: "7px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: 13,
                background: "white",
                color: "#0f172a",
              }}
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version_no}
                  {v.label ? ` · ${v.label}` : ""} — {timeAgo(v.created_at)}
                </option>
              ))}
            </select>
            <button style={btnPrimary} onClick={restore} disabled={busy || !selected}>
              {busy ? "Restoring…" : "Restore this version"}
            </button>
          </div>

          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
            {versions.map((v) => (
              <li
                key={v.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "white",
                  border: "1px solid #e2e8f0",
                  fontSize: 13,
                }}
              >
                <span style={{ color: "#0f172a" }}>
                  <strong>v{v.version_no}</strong>
                  {v.label ? <span style={{ color: "#64748b" }}> · {v.label}</span> : null}
                  <span style={{ color: "#94a3b8" }}> — {timeAgo(v.created_at)}</span>
                </span>
                <span style={{ display: "flex", gap: 6 }}>
                  <button
                    style={btn}
                    onClick={() => onOpen(worksheetId, v.form as Record<string, unknown>)}
                  >
                    Open & edit
                  </button>
                  <button
                    style={btnDanger}
                    onClick={() => removeVersion(v)}
                    aria-label={`Delete version ${v.version_no}`}
                  >
                    Delete
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  background: "white",
  border: "1px solid #cbd5e1",
  color: "#0f172a",
  padding: "6px 11px",
  borderRadius: 7,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};
const btnPrimary: React.CSSProperties = {
  ...btn,
  background: "#7c3aed",
  border: "1px solid #7c3aed",
  color: "white",
  fontWeight: 700,
};
const btnDanger: React.CSSProperties = {
  ...btn,
  color: "#b91c1c",
  border: "1px solid #fecaca",
};
