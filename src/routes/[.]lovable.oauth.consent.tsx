import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Supabase auth.oauth is beta; declare only what we use here.
type OAuthAuthorizationDetails = {
  client?: { name?: string | null; redirect_uri?: string | null } | null;
  scope?: string | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};
type OAuthResult = { redirect_url?: string | null; redirect_to?: string | null };
type OAuthApi = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: OAuthAuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
};
function oauth(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // Browser-only: the Supabase session is in localStorage, absent during SSR.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { mode: "signin", next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId =
      new URLSearchParams(location.search).get("authorization_id") ?? "";
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={h1Style}>Could not load this authorization request</h1>
        <p style={{ color: "#4B5563", marginTop: 8 }}>
          {String((error as Error)?.message ?? error)}
        </p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";
  const redirectUri = details?.client?.redirect_uri;
  const scope = details?.scope ?? "";

  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={h1Style}>Connect {clientName} to your account</h1>
        <p style={{ color: "#4B5563", marginTop: 8, fontSize: 14 }}>
          This lets <strong>{clientName}</strong> use The Tech Savvy Teacher as you — reading
          your saved lesson plans, drafts, and profile through the app's MCP tools.
        </p>
        {redirectUri && (
          <p style={{ color: "#6B7280", marginTop: 12, fontSize: 12, wordBreak: "break-all" }}>
            Redirect: {redirectUri}
          </p>
        )}
        {scope && (
          <p style={{ color: "#6B7280", marginTop: 4, fontSize: 12 }}>Scopes: {scope}</p>
        )}
        <p style={{ color: "#6B7280", marginTop: 12, fontSize: 12 }}>
          This does not bypass this app's permissions or backend policies.
        </p>
        {error && (
          <p role="alert" style={{ color: "#B91C1C", marginTop: 12, fontSize: 13 }}>
            {error}
          </p>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button
            disabled={busy}
            onClick={() => decide(true)}
            style={{ ...btnStyle, background: "#8B0AB0", color: "white" }}
          >
            {busy ? "Working…" : "Approve"}
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            style={{ ...btnStyle, background: "#F3F4F6", color: "#111827" }}
          >
            Deny
          </button>
        </div>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  background: "#FDF4FF",
  fontFamily: "Inter, 'Segoe UI', sans-serif",
};
const cardStyle: React.CSSProperties = {
  maxWidth: 460,
  width: "100%",
  background: "white",
  borderRadius: 16,
  padding: 28,
  borderTop: "6px solid #8B0AB0",
  boxShadow: "0 25px 70px rgba(139, 10, 176, 0.25)",
};
const h1Style: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  color: "#8B0AB0",
  margin: 0,
};
const btnStyle: React.CSSProperties = {
  flex: 1,
  padding: "10px 14px",
  borderRadius: 10,
  border: "none",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};
