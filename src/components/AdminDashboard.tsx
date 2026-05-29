import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { endAllActiveSessions } from "@/lib/admin-sessions.functions";
import { isBillableAction } from "@/lib/billable-actions";

interface ProfileRow {
  id: string;
  full_name: string;
  username: string;
  email: string;
  created_at: string;
}
interface SessionRow {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
}
interface UsageRow {
  id: string;
  user_id: string;
  session_id: string | null;
  feature: string;
  action: string | null;
  duration_ms: number | null;
  created_at: string;
}
interface ToolUsageRow {
  id: string;
  user_id: string;
  session_id: string | null;
  tool_name: string;
  used_at: string;
}
interface AiUsageRow {
  id: string;
  user_id: string;
  session_id: string | null;
  tool_name: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  endpoint: string | null;
  created_at: string;
}

export function AdminDashboard() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [toolUsage, setToolUsage] = useState<ToolUsageRow[]>([]);
  const [aiUsage, setAiUsage] = useState<AiUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [endingSessions, setEndingSessions] = useState(false);
  const [endMessage, setEndMessage] = useState<string | null>(null);
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);
  const [detailRows, setDetailRows] = useState<UsageRow[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const endAll = useServerFn(endAllActiveSessions);

  async function openSessionDetails(sessionId: string) {
    setDetailSessionId(sessionId);
    setDetailRows(null);
    setDetailLoading(true);
    const { data } = await supabase
      .from("feature_usage")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    setDetailRows((data as UsageRow[]) ?? []);
    setDetailLoading(false);
  }

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [u, s, f, t, ai] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_sessions").select("*").order("started_at", { ascending: false }).limit(500),
        supabase.from("feature_usage").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("tool_usage").select("*").order("used_at", { ascending: false }).limit(2000),
        supabase.from("ai_usage_log").select("*").order("created_at", { ascending: false }).limit(2000),
      ]);
      setUsers((u.data as ProfileRow[]) ?? []);
      setSessions((s.data as SessionRow[]) ?? []);
      setUsage((f.data as UsageRow[]) ?? []);
      setToolUsage((t.data as ToolUsageRow[]) ?? []);
      setAiUsage((ai.data as AiUsageRow[]) ?? []);
      setLoading(false);
    })();
  }, [isAdmin]);

  if (authLoading) return <div style={pageStyle}>Loading…</div>;
  if (!isAdmin) return <div style={pageStyle}>Access denied. Admins only.</div>;

  const totalUsers = users.length;
  const activeSessions = sessions.filter((s) => !s.ended_at).length;
  const totalActions = usage.length;
  const featureCounts = usage.reduce<Record<string, number>>((acc, r) => {
    acc[r.feature] = (acc[r.feature] ?? 0) + 1;
    return acc;
  }, {});

  const userMap = new Map(users.map((u) => [u.id, u]));

  const FEATURE_LABELS: Record<string, string> = {
    lesson: "Lesson Plan Generator",
    danielson: "Danielson Review",
    worksheet: "Worksheet Builder",
    email: "Professional Communication",
  };

  // Aggregate per-session usage: app labels + billable credits consumed.
  // Only cloud/AI generation-style actions count toward credits.
  const sessionUsage = new Map<string, { apps: string[]; credits: number }>();
  for (const r of usage) {
    if (!r.session_id) continue;
    const entry = sessionUsage.get(r.session_id) ?? { apps: [], credits: 0 };
    const label = FEATURE_LABELS[r.feature] ?? r.feature;
    if (!entry.apps.includes(label)) entry.apps.push(label);
    if (isBillableAction(r.action)) entry.credits += 1;
    sessionUsage.set(r.session_id, entry);
  }

  // Per-user aggregates for the Users table.
  const userAgg = new Map<string, { lastActive: string | null; sessions: number; tools: Set<string>; total: number }>();
  for (const s of sessions) {
    const a = userAgg.get(s.user_id) ?? { lastActive: null, sessions: 0, tools: new Set<string>(), total: 0 };
    a.sessions += 1;
    if (!a.lastActive || +new Date(s.started_at) > +new Date(a.lastActive)) a.lastActive = s.started_at;
    userAgg.set(s.user_id, a);
  }
  for (const r of toolUsage) {
    const a = userAgg.get(r.user_id) ?? { lastActive: null, sessions: 0, tools: new Set<string>(), total: 0 };
    a.total += 1;
    a.tools.add(r.tool_name);
    if (!a.lastActive || +new Date(r.used_at) > +new Date(a.lastActive)) a.lastActive = r.used_at;
    userAgg.set(r.user_id, a);
  }

  // AI cost aggregates
  const aiPerUser = new Map<string, { calls: number; inTok: number; outTok: number; cost: number; lastAt: string | null }>();
  for (const r of aiUsage) {
    const a = aiPerUser.get(r.user_id) ?? { calls: 0, inTok: 0, outTok: 0, cost: 0, lastAt: null };
    a.calls += 1;
    a.inTok += r.input_tokens ?? 0;
    a.outTok += r.output_tokens ?? 0;
    a.cost += Number(r.cost_usd ?? 0);
    if (!a.lastAt || +new Date(r.created_at) > +new Date(a.lastAt)) a.lastAt = r.created_at;
    aiPerUser.set(r.user_id, a);
  }
  const totalAiCost = aiUsage.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  const fmt = (n: number) => `$${n.toFixed(n < 0.01 ? 6 : n < 1 ? 4 : 2)}`;


  return (
    <div style={pageStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800 }}>Admin Dashboard</h1>
        <Link to="/" style={{ color: "#4f46e5", fontSize: 14 }}>← Back to app</Link>
      </div>

      {loading ? (
        <p>Loading data…</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
            <Stat label="Total users" value={totalUsers} />
            <Stat label="Active sessions" value={activeSessions} />
            <Stat label="Total sessions" value={sessions.length} />
            <Stat label="Tracked actions" value={totalActions} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 32 }}>
            <Stat label="AI calls" value={aiUsage.length} />
            <Stat label="AI cost (USD)" value={totalAiCost} format={fmt} />
          </div>


          <Section title="AI cost per user">
            {aiUsage.length === 0 ? (
              <p style={muted}>No AI usage tracked yet.</p>
            ) : (
              <Table headers={["User", "Calls", "Input tokens", "Output tokens", "Total cost", "Last call"]}>
                {users
                  .map((u) => ({ u, a: aiPerUser.get(u.id) }))
                  .filter((x) => x.a)
                  .sort((a, b) => (b.a!.cost - a.a!.cost))
                  .map(({ u, a }) => (
                    <tr key={u.id}>
                      <td style={td}>{u.username}</td>
                      <td style={td}>{a!.calls}</td>
                      <td style={td}>{a!.inTok.toLocaleString()}</td>
                      <td style={td}>{a!.outTok.toLocaleString()}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{fmt(a!.cost)}</td>
                      <td style={td}>{a!.lastAt ? new Date(a!.lastAt).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
              </Table>
            )}
          </Section>

          <Section title="Recent AI calls">
            {aiUsage.length === 0 ? (
              <p style={muted}>No AI calls logged.</p>
            ) : (
              <Table headers={["When", "User", "Tool", "Model", "Session", "In", "Out", "Cost"]}>
                {aiUsage.slice(0, 200).map((r) => {
                  const u = userMap.get(r.user_id);
                  return (
                    <tr key={r.id}>
                      <td style={td}>{new Date(r.created_at).toLocaleString()}</td>
                      <td style={td}>{u?.username ?? r.user_id.slice(0, 8)}</td>
                      <td style={td}>{r.tool_name ?? r.endpoint ?? "—"}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{r.model}</td>
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 11 }}>{r.session_id ? r.session_id.slice(0, 8) : "—"}</td>
                      <td style={td}>{r.input_tokens.toLocaleString()}</td>
                      <td style={td}>{r.output_tokens.toLocaleString()}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{fmt(Number(r.cost_usd))}</td>
                    </tr>
                  );
                })}
              </Table>
            )}
          </Section>

          <Section title="Feature usage breakdown">
            {Object.keys(featureCounts).length === 0 ? (
              <p style={muted}>No usage yet.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(featureCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([f, c]) => (
                    <li key={f} style={row}>
                      <span>{f}</span>
                      <span style={{ fontWeight: 600 }}>{c}</span>
                    </li>
                  ))}
              </ul>
            )}
          </Section>


          <Section title={`Users (${totalUsers})`}>
            <Table headers={["Username", "Name", "Email", "Joined", "Last Active", "Sessions", "Tools Used", "Total Uses"]}>
              {users.map((u) => {
                const a = userAgg.get(u.id);
                const tools = a ? Array.from(a.tools) : [];
                return (
                  <tr key={u.id}>
                    <td style={td}>{u.username}</td>
                    <td style={td}>{u.full_name || "—"}</td>
                    <td style={td}>{u.email}</td>
                    <td style={td}>{new Date(u.created_at).toLocaleString()}</td>
                    <td style={td}>{a?.lastActive ? new Date(a.lastActive).toLocaleString() : "—"}</td>
                    <td style={td}>{a?.sessions ?? 0}</td>
                    <td style={td}>{tools.length === 0 ? "—" : tools.join(", ")}</td>
                    <td style={td}>{a?.total ?? 0}</td>
                  </tr>
                );
              })}
            </Table>
          </Section>

          <Section title="Recent sessions">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <button
                onClick={async () => {
                  if (endingSessions) return;
                  if (!confirm("End all active sessions?")) return;
                  setEndingSessions(true);
                  setEndMessage(null);
                  try {
                    const res = await endAll();
                    setEndMessage(`All sessions terminated.${res?.ended != null ? ` (${res.ended})` : ""}`);
                    const { data } = await supabase
                      .from("user_sessions")
                      .select("*")
                      .order("started_at", { ascending: false })
                      .limit(500);
                    setSessions((data as SessionRow[]) ?? []);
                  } catch (e) {
                    setEndMessage(`Failed: ${(e as Error).message}`);
                  } finally {
                    setEndingSessions(false);
                  }
                }}
                disabled={endingSessions}
                style={{
                  background: "#dc2626",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: endingSessions ? "not-allowed" : "pointer",
                  opacity: endingSessions ? 0.7 : 1,
                }}
              >
                {endingSessions ? "Ending…" : "End All Active Sessions"}
              </button>
              {endMessage && <span style={{ fontSize: 13, color: "#475569" }}>{endMessage}</span>}
            </div>
            <Table headers={["User", "Started", "Ended", "Duration", "Applications Used", "Credits Used", "Details"]}>
              {sessions.slice(0, 100).map((s) => {
                const dur = s.ended_at ? Math.round((+new Date(s.ended_at) - +new Date(s.started_at)) / 1000) : null;
                const u = userMap.get(s.user_id);
                const usageEntry = sessionUsage.get(s.id);
                const apps = usageEntry?.apps ?? [];
                const appsLabel = apps.length === 0 ? "—" : apps.length === 1 ? apps[0] : apps.join(", ");
                const credits = usageEntry?.credits ?? 0;
                return (
                  <tr key={s.id}>
                    <td style={td}>{u?.username ?? s.user_id.slice(0, 8)}</td>
                    <td style={td}>{new Date(s.started_at).toLocaleString()}</td>
                    <td style={td}>{s.ended_at ? new Date(s.ended_at).toLocaleString() : "active"}</td>
                    <td style={td}>{dur != null ? `${dur}s` : "—"}</td>
                    <td style={td}>{appsLabel}</td>
                    <td style={td}>{credits}</td>
                    <td style={td}>
                      <button
                        onClick={() => openSessionDetails(s.id)}
                        style={{
                          background: "transparent",
                          border: "1px solid #cbd5e1",
                          borderRadius: 6,
                          padding: "4px 10px",
                          fontSize: 12,
                          color: "#4f46e5",
                          cursor: "pointer",
                        }}
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </Table>
          </Section>

          {detailSessionId && (
            <div
              role="dialog"
              aria-modal="true"
              onClick={() => setDetailSessionId(null)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(15, 23, 42, 0.55)",
                display: "flex",
                justifyContent: "flex-end",
                zIndex: 50,
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: "min(640px, 100%)",
                  height: "100%",
                  background: "white",
                  boxShadow: "-8px 0 24px rgba(0,0,0,0.12)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>Session activity</div>
                    <div style={{ fontSize: 12, color: "#64748b", fontFamily: "monospace" }}>{detailSessionId}</div>
                  </div>
                  <button
                    onClick={() => setDetailSessionId(null)}
                    style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: "#475569" }}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>
                <div style={{ padding: 20, overflow: "auto" }}>
                  {detailLoading ? (
                    <p style={muted}>Loading…</p>
                  ) : !detailRows || detailRows.length === 0 ? (
                    <p style={muted}>No activity recorded for this session.</p>
                  ) : (
                    <>
                      <div style={{ marginBottom: 12, fontSize: 13, color: "#475569" }}>
                        {detailRows.length} event{detailRows.length === 1 ? "" : "s"} •{" "}
                        {detailRows.filter((r) => isBillableAction(r.action)).length} billable
                      </div>
                      <Table headers={["Feature", "Action", "Billable", "Duration", "When"]}>
                        {detailRows.map((r) => (
                          <tr key={r.id}>
                            <td style={td}>{FEATURE_LABELS[r.feature] ?? r.feature}</td>
                            <td style={td}>{r.action ?? "—"}</td>
                            <td style={td}>{isBillableAction(r.action) ? "Yes" : "No"}</td>
                            <td style={td}>{r.duration_ms != null ? `${Math.round(r.duration_ms / 1000)}s` : "—"}</td>
                            <td style={td}>{new Date(r.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </Table>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

        </>
      )}
    </div>
  );
}

const pageStyle: React.CSSProperties = { maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px" };
const muted: React.CSSProperties = { color: "#64748b" };
const td: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 13 };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f8fafc", borderRadius: 6 };

function Stat({ label, value, format }: { label: string; value: number; format?: (n: number) => string }) {
  return (
    <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{format ? format(value) : value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>{title}</h2>
      {children}
    </div>
  );
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "#f8fafc" }}>
          <tr>
            {headers.map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "10px", fontSize: 12, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
