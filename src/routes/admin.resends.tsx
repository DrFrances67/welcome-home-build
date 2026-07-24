import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ResendRow {
  id: string;
  email: string;
  status: string;
  error_message: string | null;
  message_id: string | null;
  requested_at: string;
}

export const Route = createFileRoute("/admin/resends")({
  head: () => ({
    meta: [
      { title: "Verification Resends — Admin" },
      {
        name: "description",
        content: "Internal admin view of verification email resend history.",
      },
      { property: "og:title", content: "Verification Resends — Admin" },
      {
        property: "og:description",
        content: "Internal admin view of verification email resend history.",
      },
      { property: "og:url", content: "https://techsavvyteacher.app/admin/resends" },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://techsavvyteacher.app/admin/resends" }],
  }),
  component: ResendsAdminPage,
});

function ResendsAdminPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<ResendRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailFilter, setEmailFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "sent" | "failed">("all");
  const [range, setRange] = useState<"24h" | "7d" | "30d" | "all">("7d");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      let q = supabase
        .from("verification_resend_log")
        .select("*")
        .order("requested_at", { ascending: false })
        .limit(500);
      if (range !== "all") {
        const hours = range === "24h" ? 24 : range === "7d" ? 24 * 7 : 24 * 30;
        const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
        q = q.gte("requested_at", since);
      }
      const { data, error } = await q;
      if (cancelled) return;
      if (error) setError(error.message);
      else setRows((data as ResendRow[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, range]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (emailFilter && !r.email.toLowerCase().includes(emailFilter.toLowerCase())) return false;
      return true;
    });
  }, [rows, statusFilter, emailFilter]);

  const stats = useMemo(() => {
    const sent = filtered.filter((r) => r.status === "sent").length;
    const failed = filtered.filter((r) => r.status === "failed").length;
    const uniqueEmails = new Set(filtered.map((r) => r.email.toLowerCase())).size;
    return { total: filtered.length, sent, failed, uniqueEmails };
  }, [filtered]);

  if (authLoading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!isAdmin) return <Navigate to="/" />;

  return (
    <div
      style={{
        padding: 24,
        maxWidth: 1100,
        margin: "0 auto",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#8B0AB0", margin: 0 }}>
          Verification email resends
        </h1>
        <Link to="/admin" style={{ color: "#8B0AB0", fontSize: 13, fontWeight: 600 }}>
          ← Back to admin
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <Stat label="Total attempts" value={stats.total} />
        <Stat label="Sent" value={stats.sent} color="#047857" />
        <Stat label="Failed" value={stats.failed} color="#B91C1C" />
        <Stat label="Unique emails" value={stats.uniqueEmails} />
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 12,
          alignItems: "center",
        }}
      >
        <input
          placeholder="Filter by email…"
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
          style={inputStyle}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as never)}
          style={inputStyle}
        >
          <option value="all">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as never)}
          style={inputStyle}
        >
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
      </div>

      {error && (
        <div
          style={{
            background: "#fef2f2",
            color: "#b91c1c",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      <div
        style={{
          background: "white",
          border: "1px solid #E5E7EB",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F9FAFB", textAlign: "left" }}>
              <th style={th}>When</th>
              <th style={th}>Email</th>
              <th style={th}>Status</th>
              <th style={th}>Error</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ padding: 16, textAlign: "center", color: "#6B7280" }}>
                  Loading…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 16, textAlign: "center", color: "#6B7280" }}>
                  No attempts in this range.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                  <td style={td}>{new Date(r.requested_at).toLocaleString()}</td>
                  <td style={td}>{r.email}</td>
                  <td style={td}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontWeight: 700,
                        fontSize: 11,
                        background: r.status === "sent" ? "#ECFDF5" : "#FEF2F2",
                        color: r.status === "sent" ? "#047857" : "#B91C1C",
                      }}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td style={{ ...td, color: "#B91C1C" }}>{r.error_message ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div
      style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: 14 }}
    >
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color ?? "#111827" }}>{value}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  fontSize: 13,
  background: "white",
  color: "#111827",
};
const th: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 700,
  color: "#374151",
};
const td: React.CSSProperties = { padding: "10px 12px", verticalAlign: "top" };
