import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import {
  listLessonPlans,
  listVersions,
  getLessonPlan,
  restoreVersion,
  renameLessonPlan,
  deleteLessonPlan,
  saveLessonPlan,
  type LessonPlanRow,
  type LessonPlanVersionRow,
} from "@/lib/lesson-plans.functions";

const LP_DRAFT_KEY = "tts.lessonPlanDraft.v1";
const LP_PLAN_ID_KEY = "tts.lessonPlanId.v1";

export const Route = createFileRoute("/lesson-plans")({
  head: () => ({
    meta: [
      { title: "Saved Lesson Plans — The Tech Savvy Teacher" },
      {
        name: "description",
        content:
          "Your saved lesson plans and draft version history. Restore previous drafts and pick up where you left off.",
      },
      { property: "og:title", content: "Saved Lesson Plans — The Tech Savvy Teacher" },
      {
        property: "og:description",
        content: "Manage saved lesson plans and draft versions on The Tech Savvy Teacher.",
      },
      { property: "og:url", content: "https://techsavvyteacher.app/lesson-plans" },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://techsavvyteacher.app/lesson-plans" }],
  }),
  component: LessonPlansPage,
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

function LessonPlansPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const list = useServerFn(listLessonPlans);
  const getOne = useServerFn(getLessonPlan);
  const del = useServerFn(deleteLessonPlan);
  const rename = useServerFn(renameLessonPlan);

  const [tab, setTab] = useState<Tab>("saved");
  const [plans, setPlans] = useState<LessonPlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth", search: { mode: "signin" } });
  }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await list({ data: { status: tab } });
      setPlans(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load lesson plans.");
    } finally {
      setLoading(false);
    }
  }, [list, tab]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const openForEditing = async (planId: string, form?: Record<string, unknown> | null) => {
    let formToUse = form;
    if (!formToUse) {
      const plan = await getOne({ data: { id: planId } });
      formToUse = (plan.current?.form as Record<string, unknown>) ?? null;
    }
    if (formToUse) {
      try {
        window.localStorage.setItem(LP_DRAFT_KEY, JSON.stringify(formToUse));
        window.localStorage.setItem(LP_PLAN_ID_KEY, planId);
      } catch {
        /* ignore */
      }
    }
    navigate({ to: "/" });
  };

  const handleRename = async (plan: LessonPlanRow) => {
    const next = window.prompt("Rename lesson plan", plan.title);
    if (next == null || !next.trim() || next.trim() === plan.title) return;
    try {
      await rename({ data: { id: plan.id, title: next.trim() } });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rename failed.");
    }
  };

  const handleDelete = async (plan: LessonPlanRow) => {
    if (!window.confirm(`Delete "${plan.title}"? This removes all its draft versions.`)) return;
    try {
      await del({ data: { id: plan.id } });
      setExpanded((x) => (x === plan.id ? null : x));
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
          Saved Lesson Plans
        </h1>
        <Link to="/" style={{ fontSize: 13, color: "#7c3aed", fontWeight: 600 }}>
          ← Back to tools
        </Link>
      </div>
      <p style={{ color: "#64748b", marginBottom: 20, fontSize: 14 }}>
        Open a plan to keep editing, save finalized plans, and restore earlier draft versions.
      </p>

      {/* Tabs */}
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
      ) : plans.length === 0 ? (
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
            {tab === "saved" ? "No saved lesson plans yet." : "No drafts yet."}
          </p>
          <Link to="/" style={{ color: "#7c3aed", fontWeight: 700 }}>
            Create a lesson plan →
          </Link>
        </div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
          {plans.map((plan) => (
            <li
              key={plan.id}
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
                  <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 15 }}>{plan.title}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                    Updated {timeAgo(plan.updated_at)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button style={btnPrimary} onClick={() => openForEditing(plan.id)}>
                    Open & edit
                  </button>
                  <button
                    style={btn}
                    onClick={() => setExpanded((x) => (x === plan.id ? null : plan.id))}
                    aria-expanded={expanded === plan.id}
                  >
                    {expanded === plan.id ? "Hide drafts" : "Draft history"}
                  </button>
                  <button style={btn} onClick={() => handleRename(plan)}>
                    Rename
                  </button>
                  <button style={btnDanger} onClick={() => handleDelete(plan)}>
                    Delete
                  </button>
                </div>
              </div>

              {expanded === plan.id && (
                <DraftList planId={plan.id} onOpen={openForEditing} onChanged={load} />
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function DraftList({
  planId,
  onOpen,
  onChanged,
}: {
  planId: string;
  onOpen: (planId: string, form: Record<string, unknown>) => void;
  onChanged: () => void;
}) {
  const versionsFn = useServerFn(listVersions);
  const restoreFn = useServerFn(restoreVersion);

  const [versions, setVersions] = useState<LessonPlanVersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await versionsFn({ data: { planId } });
      setVersions(rows);
      setSelected(rows[0]?.id ?? "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load versions.");
    } finally {
      setLoading(false);
    }
  }, [versionsFn, planId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const restore = async () => {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    try {
      await restoreFn({ data: { planId, versionId: selected } });
      await reload();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Restore failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ borderTop: "1px solid #eef2f7", background: "#f8fafc", padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#64748b", marginBottom: 10 }}>
        DRAFT VERSIONS
      </div>

      {err && <p style={{ color: "#991b1b", fontSize: 13, marginBottom: 10 }}>{err}</p>}

      {loading ? (
        <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading versions…</p>
      ) : versions.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: 13 }}>No versions yet.</p>
      ) : (
        <>
          {/* Restore selector */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <label style={{ fontSize: 13, color: "#475569", fontWeight: 600 }}>
              Restore version:
            </label>
            <select
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

          {/* Version list */}
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
                <button
                  style={btn}
                  onClick={() => onOpen(planId, v.form as Record<string, unknown>)}
                >
                  Open & edit
                </button>
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
