import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import {
  searchAuthUsers,
  resendVerificationEmails,
  type AuthUserRow,
  type ResendResult,
} from "@/lib/admin-users.functions";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "User Search — Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminUsersPage,
});

type StatusFilter = "all" | "confirmed" | "unconfirmed";

function AdminUsersPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const search = useServerFn(searchAuthUsers);
  const resend = useServerFn(resendVerificationEmails);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [rows, setRows] = useState<AuthUserRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<ResendResult[] | null>(null);

  async function runSearch() {
    setLoading(true);
    setError(null);
    setResults(null);
    setSelected(new Set());
    try {
      const res = await search({ data: { query: query.trim(), status } });
      setRows(res.users);
      setTruncated(res.truncated);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function toggle(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  }

  const unconfirmedEmails = useMemo(
    () => rows.filter((r) => !r.confirmed).map((r) => r.email),
    [rows],
  );

  function selectAllUnconfirmed() {
    setSelected(new Set(unconfirmedEmails));
  }

  async function sendResends() {
    const emails = Array.from(selected);
    if (emails.length === 0) return;
    setSending(true);
    setResults(null);
    setError(null);
    try {
      const res = await resend({ data: { emails } });
      setResults(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resend failed");
    } finally {
      setSending(false);
    }
  }

  if (authLoading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!isAdmin) return <Navigate to="/" />;

  const resultByEmail = new Map((results ?? []).map((r) => [r.email.toLowerCase(), r]));

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
          User search &amp; verification
        </h1>
        <div style={{ display: "flex", gap: 12 }}>
          <Link to="/admin/resends" style={linkStyle}>
            Resend log →
          </Link>
          <Link to="/admin" style={linkStyle}>
            ← Back to admin
          </Link>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch();
        }}
        style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "center" }}
      >
        <input
          placeholder="Search by email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ ...inputStyle, minWidth: 260, flex: "1 1 260px" }}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          style={inputStyle}
        >
          <option value="all">All users</option>
          <option value="unconfirmed">Unconfirmed only</option>
          <option value="confirmed">Confirmed only</option>
        </select>
        <button type="submit" disabled={loading} style={primaryBtn}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && (
        <div style={errorBox}>{error}</div>
      )}

      {searched && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 13, color: "#374151" }}>
            {rows.length} user{rows.length === 1 ? "" : "s"}
            {truncated ? " (showing first 200)" : ""} · {selected.size} selected
          </span>
          {unconfirmedEmails.length > 0 && (
            <button type="button" onClick={selectAllUnconfirmed} style={secondaryBtn}>
              Select all unconfirmed ({unconfirmedEmails.length})
            </button>
          )}
          <button
            type="button"
            onClick={sendResends}
            disabled={sending || selected.size === 0}
            style={{ ...primaryBtn, opacity: sending || selected.size === 0 ? 0.5 : 1 }}
          >
            {sending ? "Sending…" : `Resend verification (${selected.size})`}
          </button>
        </div>
      )}

      {results && (
        <div style={resultsBox}>
          <strong>Resend results:</strong>{" "}
          {results.filter((r) => r.ok).length} sent, {results.filter((r) => !r.ok).length} failed.
          {results.some((r) => !r.ok) && (
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {results
                .filter((r) => !r.ok)
                .map((r) => (
                  <li key={r.email} style={{ color: "#B91C1C", fontSize: 12 }}>
                    {r.email}: {r.detail}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {searched && (
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
                <th style={{ ...th, width: 40 }}></th>
                <th style={th}>Email</th>
                <th style={th}>Status</th>
                <th style={th}>Signed up</th>
                <th style={th}>Last sign-in</th>
                <th style={th}>Resend</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 16, textAlign: "center", color: "#6B7280" }}>
                    No matching users.
                  </td>
                </tr>
              ) : (
                rows.map((u) => {
                  const r = resultByEmail.get(u.email.toLowerCase());
                  return (
                    <tr key={u.id} style={{ borderTop: "1px solid #F3F4F6" }}>
                      <td style={td}>
                        <input
                          type="checkbox"
                          checked={selected.has(u.email)}
                          onChange={() => toggle(u.email)}
                          aria-label={`Select ${u.email}`}
                        />
                      </td>
                      <td style={td}>{u.email}</td>
                      <td style={td}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontWeight: 700,
                            fontSize: 11,
                            background: u.confirmed ? "#ECFDF5" : "#FEF3C7",
                            color: u.confirmed ? "#047857" : "#92400E",
                          }}
                        >
                          {u.confirmed ? "confirmed" : "unconfirmed"}
                        </span>
                      </td>
                      <td style={td}>{new Date(u.created_at).toLocaleString()}</td>
                      <td style={td}>
                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "—"}
                      </td>
                      <td style={td}>
                        {r ? (
                          <span style={{ color: r.ok ? "#047857" : "#B91C1C", fontWeight: 600 }}>
                            {r.ok ? "sent" : "failed"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
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
const primaryBtn: React.CSSProperties = {
  padding: "8px 14px",
  border: "none",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  background: "#8B0AB0",
  color: "white",
  cursor: "pointer",
};
const secondaryBtn: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid #D1D5DB",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  background: "white",
  color: "#374151",
  cursor: "pointer",
};
const linkStyle: React.CSSProperties = { color: "#8B0AB0", fontSize: 13, fontWeight: 600 };
const errorBox: React.CSSProperties = {
  background: "#fef2f2",
  color: "#b91c1c",
  padding: 12,
  borderRadius: 8,
  marginBottom: 12,
};
const resultsBox: React.CSSProperties = {
  background: "#F9FAFB",
  border: "1px solid #E5E7EB",
  color: "#111827",
  padding: 12,
  borderRadius: 8,
  marginBottom: 12,
  fontSize: 13,
};
const th: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 700,
  color: "#374151",
};
const td: React.CSSProperties = { padding: "10px 12px", verticalAlign: "top" };
