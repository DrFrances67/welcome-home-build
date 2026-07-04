import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Reset Password" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);

  // Establish a session from the recovery link before allowing a password update.
  // Recovery links can arrive in a few shapes depending on the auth flow:
  //  - implicit:   #access_token=...&refresh_token=...&type=recovery  (in the hash)
  //  - PKCE:       ?code=...
  //  - token hash: ?token_hash=...&type=recovery  (or in the hash)
  useEffect(() => {
    let cancelled = false;

    const establishSession = async () => {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const code = url.searchParams.get("code");
        const tokenHash =
          url.searchParams.get("token_hash") || hash.get("token_hash") || url.searchParams.get("token");
        const type = (url.searchParams.get("type") || hash.get("type") || "recovery") as
          | "recovery"
          | "email";
        const errorDescription =
          url.searchParams.get("error_description") || hash.get("error_description");

        if (errorDescription) {
          if (!cancelled) setError(errorDescription);
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
          if (error) throw error;
        }

        // Clean the token out of the URL bar.
        window.history.replaceState(null, "", window.location.pathname);

        const { data } = await supabase.auth.getSession();
        if (!cancelled) {
          if (data.session) {
            setReady(true);
            setError(null);
          } else if (!errorDescription) {
            setError("This password reset link is invalid or has expired. Please request a new one.");
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not verify the reset link.");
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    // Also react to the recovery event fired when Supabase auto-detects the link.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session && !cancelled) {
        setReady(true);
        setError(null);
        setChecking(false);
      }
    });

    establishSession();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!ready) return setError("Please open this page from the reset link in your email.");
    if (password.length < 10) return setError("Password must be at least 10 characters.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    navigate({ to: "/" });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          background: "white",
          padding: 28,
          borderRadius: 12,
          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          width: "100%",
          maxWidth: 420,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Set a new password</h1>
        {checking && (
          <div style={{ color: "#64748b", fontSize: 14, marginBottom: 12 }}>
            Verifying your reset link…
          </div>
        )}
        {error && (
          <div
            style={{
              background: "#fef2f2",
              color: "#b91c1c",
              padding: 10,
              borderRadius: 8,
              marginBottom: 12,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (10+ chars)"
          disabled={!ready}
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            fontSize: 14,
            marginBottom: 12,
            background: ready ? "white" : "#f8fafc",
          }}
          required
        />
        <button
          type="submit"
          disabled={busy || !ready}
          style={{
            width: "100%",
            background: ready ? "#4f46e5" : "#a5b4fc",
            color: "white",
            border: "none",
            padding: "10px",
            borderRadius: 8,
            fontWeight: 600,
            cursor: ready ? "pointer" : "not-allowed",
          }}
        >
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
