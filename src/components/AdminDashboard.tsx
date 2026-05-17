import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { endAllActiveSessions } from "@/lib/admin-sessions.functions";

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
  feature: string;
  action: string | null;
  duration_ms: number | null;
  created_at: string;
}

export function AdminDashboard() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<ProfileRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [endingSessions, setEndingSessions] = useState(false);
  const [endMessage, setEndMessage] = useState<string | null>(null);
  const endAll = useServerFn(endAllActiveSessions);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [u, s, f] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_sessions").select("*").order("started_at", { ascending: false }).limit(500),
        supabase.from("feature_usage").select("*").order("created_at", { ascending: false }).limit(500),
      ]);
      setUsers((u.data as ProfileRow[]) ?? []);
      setSessions((s.data as SessionRow[]) ?? []);
      setUsage((f.data as UsageRow[]) ?? []);
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
            <Table headers={["Username", "Full name", "Email", "Joined"]}>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={td}>{u.username}</td>
                  <td style={td}>{u.full_name}</td>
                  <td style={td}>{u.email}</td>
                  <td style={td}>{new Date(u.created_at).toLocaleString()}</td>
                </tr>
              ))}
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
            <Table headers={["User", "Started", "Ended", "Duration"]}>
              {sessions.slice(0, 100).map((s) => {
                const dur = s.ended_at ? Math.round((+new Date(s.ended_at) - +new Date(s.started_at)) / 1000) : null;
                const u = userMap.get(s.user_id);
                return (
                  <tr key={s.id}>
                    <td style={td}>{u?.username ?? s.user_id.slice(0, 8)}</td>
                    <td style={td}>{new Date(s.started_at).toLocaleString()}</td>
                    <td style={td}>{s.ended_at ? new Date(s.ended_at).toLocaleString() : "active"}</td>
                    <td style={td}>{dur != null ? `${dur}s` : "—"}</td>
                  </tr>
                );
              })}
            </Table>
          </Section>

          <Section title="Recent activity">
            <Table headers={["User", "Feature", "Action", "Duration", "When"]}>
              {usage.slice(0, 200).map((r) => {
                const u = userMap.get(r.user_id);
                return (
                  <tr key={r.id}>
                    <td style={td}>{u?.username ?? r.user_id.slice(0, 8)}</td>
                    <td style={td}>{r.feature}</td>
                    <td style={td}>{r.action ?? "—"}</td>
                    <td style={td}>{r.duration_ms != null ? `${Math.round(r.duration_ms / 1000)}s` : "—"}</td>
                    <td style={td}>{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                );
              })}
            </Table>
          </Section>
        </>
      )}
    </div>
  );
}

const pageStyle: React.CSSProperties = { maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px" };
const muted: React.CSSProperties = { color: "#64748b" };
const td: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #f1f5f9", fontSize: 13 };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f8fafc", borderRadius: 6 };

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{value}</div>
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
