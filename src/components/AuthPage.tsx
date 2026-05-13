import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .regex(/[A-Z]/, "Must include an uppercase letter")
  .regex(/[a-z]/, "Must include a lowercase letter")
  .regex(/[0-9]/, "Must include a number")
  .regex(/[^A-Za-z0-9]/, "Must include a symbol");

const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Full name required").max(100),
  username: z
    .string()
    .trim()
    .min(3, "Username must be 3+ characters")
    .max(30)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Letters, numbers, _ . - only"),
  email: z.string().trim().email("Invalid email").max(255),
  password: passwordSchema,
  agreedPrivacy: z.literal(true, { errorMap: () => ({ message: "You must accept the privacy notice" }) }),
});

export function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      let loginEmail = identifier.trim();
      // If user typed a username, look up email via profiles
      if (!loginEmail.includes("@")) {
        const { data } = await supabase
          .from("profiles")
          .select("email")
          .eq("username", loginEmail)
          .maybeSingle();
        if (!data?.email) {
          setError("No account found with that username.");
          setBusy(false);
          return;
        }
        loginEmail = data.email;
      }
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
      if (error) setError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const parsed = signupSchema.safeParse({
      full_name: fullName,
      username,
      email,
      password,
      agreedPrivacy: agreed,
    });
    if (!parsed.success) {
      setError(parsed.error.errors[0].message);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: parsed.data.full_name,
            username: parsed.data.username,
          },
        },
      });
      if (error) {
        setError(error.message);
      } else {
        setInfo("Check your email to verify your account, then sign in.");
        setMode("signin");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) setError(error.message);
      else setInfo("Password reset email sent. Check your inbox.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "linear-gradient(135deg, #f8fafc, #eef2ff)" }}>
      <div style={{ width: "100%", maxWidth: 460, background: "white", borderRadius: 16, padding: 32, boxShadow: "0 10px 40px rgba(0,0,0,0.08)" }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>The Tech Savvy Teacher</h1>
        <p style={{ color: "#64748b", marginBottom: 24, fontSize: 14 }}>
          {mode === "signup" ? "Create your account" : mode === "reset" ? "Reset your password" : "Sign in to continue"}
        </p>

        {error && <div style={{ background: "#fef2f2", color: "#b91c1c", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{error}</div>}
        {info && <div style={{ background: "#ecfdf5", color: "#047857", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{info}</div>}

        {mode === "signin" && (
          <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Username or email" value={identifier} onChange={setIdentifier} autoComplete="username" required />
            <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" required />
            <button type="submit" disabled={busy} style={primaryBtn}>{busy ? "Signing in…" : "Sign in"}</button>
            <div style={linkRow}>
              <button type="button" onClick={() => { setMode("signup"); setError(null); setInfo(null); }} style={linkBtn}>Create account</button>
              <button type="button" onClick={() => { setMode("reset"); setError(null); setInfo(null); }} style={linkBtn}>Forgot password?</button>
            </div>
          </form>
        )}

        {mode === "signup" && (
          <form onSubmit={handleSignUp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Full name" value={fullName} onChange={setFullName} autoComplete="name" required />
            <Field label="Username" value={username} onChange={setUsername} autoComplete="username" required />
            <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
            <Field label="Password" type="password" value={password} onChange={setPassword} autoComplete="new-password" required />
            <p style={{ fontSize: 12, color: "#64748b", marginTop: -6 }}>
              Min 10 characters with upper, lower, number, and symbol.
            </p>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: 12, borderRadius: 8, fontSize: 12, color: "#475569", lineHeight: 1.5 }}>
              <strong style={{ color: "#0f172a" }}>Privacy notice.</strong> By creating an account you agree we may store
              your full name, email, username, and account timestamp, and that we record your sign-in sessions, the
              features you use (Lesson Plan Generator, Danielson Review, Worksheet Builder, Professional Communication
              Support), the actions you take, and time spent per feature. This data is used to operate the service and
              is visible to the site owner. Read the full{" "}
              <a href="/privacy" target="_blank" rel="noreferrer" style={{ color: "#4f46e5" }}>privacy statement</a>.
            </div>

            <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#334155" }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 3 }} />
              <span>I have read and agree to the privacy notice above.</span>
            </label>

            <button type="submit" disabled={busy} style={primaryBtn}>{busy ? "Creating…" : "Create account"}</button>
            <div style={linkRow}>
              <button type="button" onClick={() => { setMode("signin"); setError(null); setInfo(null); }} style={linkBtn}>Already have an account? Sign in</button>
            </div>
          </form>
        )}

        {mode === "reset" && (
          <form onSubmit={handleReset} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Field label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" required />
            <button type="submit" disabled={busy} style={primaryBtn}>{busy ? "Sending…" : "Send reset link"}</button>
            <div style={linkRow}>
              <button type="button" onClick={() => { setMode("signin"); setError(null); setInfo(null); }} style={linkBtn}>Back to sign in</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, autoComplete }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; autoComplete?: string }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#334155" }}>
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        style={{ padding: "10px 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, outline: "none" }}
      />
    </label>
  );
}

const primaryBtn: React.CSSProperties = {
  background: "#4f46e5",
  color: "white",
  border: "none",
  padding: "11px 16px",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  marginTop: 4,
};
const linkRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginTop: 4 };
const linkBtn: React.CSSProperties = { background: "none", border: "none", color: "#4f46e5", cursor: "pointer", fontSize: 13, padding: 0 };
