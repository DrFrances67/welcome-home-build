import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset Password" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 10) return setError("Password must be at least 10 characters.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return setError(error.message);
    navigate({ to: "/" });
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <form onSubmit={submit} style={{ background: "white", padding: 28, borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.06)", width: "100%", maxWidth: 420 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Set a new password</h1>
        {error && <div style={{ background: "#fef2f2", color: "#b91c1c", padding: 10, borderRadius: 8, marginBottom: 12, fontSize: 14 }}>{error}</div>}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (10+ chars)"
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, marginBottom: 12 }}
          required
        />
        <button type="submit" disabled={busy} style={{ width: "100%", background: "#4f46e5", color: "white", border: "none", padding: "10px", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
