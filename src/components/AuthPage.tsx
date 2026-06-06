import React, { useRef, useState } from "react";

export function strengthExplanation(label: string): string {
  switch (label) {
    case "Very weak":
      return "Easy to guess. Add length and a mix of upper, lower, numbers, and symbols.";
    case "Weak":
      return "Still risky. Aim for 12+ characters with at least 3 character types.";
    case "Fair":
      return "Acceptable but not great. Add length or a missing character type to reach Good.";
    case "Good":
      return "Solid: 12+ characters with a healthy mix of upper, lower, numbers, and symbols. Hard to guess in normal attacks.";
    case "Strong":
      return "Excellent: long (14+) and uses all 4 character types with no obvious patterns.";
    default:
      return "Type a password to see strength.";
  }
}
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
    .max(100)
    .regex(/^[a-zA-Z0-9_.@+-]+$/, "Letters, numbers, _ . @ + - only"),
  email: z.string().trim().email("Invalid email").max(255),
  password: passwordSchema,
  agreedPrivacy: z.literal(true, {
    errorMap: () => ({ message: "You must accept the privacy notice" }),
  }),
});

const themeCss = `
.auth-page {
  --auth-bg: rgba(30, 8, 45, 0.45);
  --auth-card: #ffffff;
  --auth-card-shadow: 0 25px 70px rgba(139, 10, 176, 0.35), 0 0 0 1px rgba(207, 39, 245, 0.15);
  --auth-border-top: #8B0AB0;
  --auth-title: #8B0AB0;
  --auth-subtle: #6B7280;
  --auth-label: #374151;
  --auth-input-bg: #ffffff;
  --auth-input-border: #D1D5DB;
  --auth-input-text: #111827;
  --auth-primary: #8B0AB0;
  --auth-primary-hover: #6E0789;
  --auth-link: #8B0AB0;
  --auth-notice-bg: #FDF4FF;
  --auth-notice-border: #F5D0FE;
  --auth-notice-text: #4B5563;
  --auth-notice-strong: #8B0AB0;
  --auth-error-bg: #fef2f2;
  --auth-error-text: #b91c1c;
  --auth-info-bg: #ecfdf5;
  --auth-info-text: #047857;
}
.auth-page input::placeholder { color: var(--auth-subtle); }
.auth-page input:focus { border-color: var(--auth-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--auth-primary) 20%, transparent); }
.auth-btn-primary { background: var(--auth-primary); transition: background 0.15s; }
.auth-btn-primary:hover:not(:disabled) { background: var(--auth-primary-hover); }
`;

export function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<null | {
    state: "verified" | "unverified" | "unknown";
    email: string;
    checkedAt: Date;
  }>(null);
  const [resendHistory, setResendHistory] = useState<
    Array<{ requested_at: string; status: string; error_message: string | null }>
  >([]);
  const [weakAttempt, setWeakAttempt] = useState(false);
  const requirementsRef = useRef<HTMLDivElement | null>(null);

  const loadResendHistory = async (addr: string) => {
    const { data } = await supabase.rpc("get_recent_verification_resends", { _email: addr });
    setResendHistory((data as typeof resendHistory) ?? []);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setUnverifiedEmail(null);
    setVerificationStatus(null);
    setBusy(true);
    try {
      let loginEmail = identifier.trim();
      if (!loginEmail.includes("@")) {
        const { data, error: rpcErr } = await supabase.rpc("get_email_by_username", {
          _username: loginEmail,
        });
        if (rpcErr || !data) {
          setError("No account found with that username.");
          setBusy(false);
          return;
        }
        loginEmail = data as string;
      }
      // Clear any stale local session before attempting a fresh sign-in
      try {
        await supabase.auth.signOut({ scope: "local" } as never);
      } catch {
        /* ignore */
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });
      if (error) {
        const isUnverified = /confirm|verif/i.test(error.message);
        setError(error.message);
        setVerificationStatus({
          state: isUnverified ? "unverified" : "unknown",
          email: loginEmail,
          checkedAt: new Date(),
        });
        if (isUnverified) {
          setUnverifiedEmail(loginEmail);
          await loadResendHistory(loginEmail);
        }
      } else if (data?.session) {
        // Remember-me: when unchecked, mark this session as tab-scoped so the
        // app signs the user out on the next cold load (after the tab closes).
        try {
          if (rememberMe) {
            localStorage.removeItem("tst-session-only");
          } else {
            localStorage.setItem("tst-session-only", "1");
            sessionStorage.setItem("tst-session-alive", "1");
          }
        } catch {
          /* storage unavailable */
        }
        setInfo("Signed in. Loading your account…");
        window.location.assign("/");
      } else {
        setError("Sign-in returned no session. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async (target?: string) => {
    const addr = (target ?? unverifiedEmail ?? email).trim();
    if (!addr) {
      setError("Enter your email so we can resend the verification link.");
      return;
    }
    setError(null);
    setInfo(null);
    setBusy(true);
    const startedAt = new Date();
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: addr,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      const status = error ? "failed" : "sent";
      const errMsg = error?.message ?? null;
      // Backend log
      await supabase.rpc("log_verification_resend", {
        _email: addr,
        _status: status,
        _error_message: errMsg ?? undefined,
        _message_id: undefined,
      });
      // UI feedback
      const ts = startedAt.toLocaleString();
      if (error) {
        setError(`Resend failed at ${ts}: ${error.message}`);
      } else {
        setInfo(
          `Verification email resent to ${addr} at ${ts}. Allow up to a few minutes; also check spam/junk and any quarantine folder.`,
        );
      }
      await loadResendHistory(addr);
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
    const strength = scorePassword(parsed.data.password);
    if (strength.score < 3) {
      setError(
        `Password is too weak (${strength.label}). Please choose a stronger password — aim for "Good" or "Strong".`,
      );
      setWeakAttempt(true);
      // Scroll the live checklist into view so the user sees what's missing.
      requirementsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setWeakAttempt(false);
    setBusy(true);
    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
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
        // Fire-and-forget admin notification — don't block signup UX on failures.
        try {
          const userId = signUpData?.user?.id ?? parsed.data.email;
          fetch("/api/public/notify-admin-signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: userId,
              username: parsed.data.username,
              name: parsed.data.full_name,
              email: parsed.data.email,
              timestamp: new Date().toISOString(),
            }),
          }).catch(() => {
            /* ignore */
          });
        } catch {
          /* ignore */
        }
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
    <div
      className="auth-page"
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "24px 16px",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
        background: "var(--auth-bg)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        fontFamily: "Inter, 'Segoe UI', sans-serif",
      }}
    >
      <style>{themeCss}</style>
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "var(--auth-card)",
          borderRadius: 16,
          padding: "clamp(20px, 4vw, 32px)",
          boxShadow: "var(--auth-card-shadow)",
          borderTop: "6px solid var(--auth-border-top)",
          margin: "auto 0",
          flexShrink: 0,
        }}
      >
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6, color: "var(--auth-title)" }}>
          The Tech Savvy Teacher
        </h1>
        <p style={{ color: "var(--auth-subtle)", marginBottom: 24, fontSize: 14 }}>
          {mode === "signup"
            ? "Create your account"
            : mode === "reset"
              ? "Reset your password"
              : "Sign in to continue"}
        </p>

        {error && (
          <div
            style={{
              background: "var(--auth-error-bg)",
              color: "var(--auth-error-text)",
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            {error}
          </div>
        )}
        {info && (
          <div
            style={{
              background: "var(--auth-info-bg)",
              color: "var(--auth-info-text)",
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            {info}
          </div>
        )}

        {verificationStatus && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 13,
              border: "1px solid",
              borderColor:
                verificationStatus.state === "verified"
                  ? "#A7F3D0"
                  : verificationStatus.state === "unverified"
                    ? "#FDE68A"
                    : "#E5E7EB",
              background:
                verificationStatus.state === "verified"
                  ? "#ECFDF5"
                  : verificationStatus.state === "unverified"
                    ? "#FFFBEB"
                    : "#F9FAFB",
              color:
                verificationStatus.state === "verified"
                  ? "#047857"
                  : verificationStatus.state === "unverified"
                    ? "#92400E"
                    : "#374151",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 2 }}>
              {verificationStatus.state === "verified" && "✓ Email verified"}
              {verificationStatus.state === "unverified" && "⚠ Email not verified"}
              {verificationStatus.state === "unknown" && "Verification status unknown"}
            </div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              {verificationStatus.email} · checked{" "}
              {verificationStatus.checkedAt.toLocaleTimeString()}
            </div>
          </div>
        )}

        {resendHistory.length > 0 && (
          <div
            style={{
              marginBottom: 16,
              padding: 10,
              borderRadius: 8,
              background: "#F9FAFB",
              border: "1px solid #E5E7EB",
              fontSize: 12,
              color: "#374151",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              Recent verification email resends
            </div>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {resendHistory.map((r, i) => (
                <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span>{new Date(r.requested_at).toLocaleString()}</span>
                  <span
                    style={{ fontWeight: 600, color: r.status === "sent" ? "#047857" : "#B91C1C" }}
                  >
                    {r.status}
                    {r.error_message ? ` — ${r.error_message}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {mode === "signin" && (
          <form
            onSubmit={handleSignIn}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <Field
              label="Username or email"
              value={identifier}
              onChange={setIdentifier}
              autoComplete="username"
              required
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              required
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--auth-label)",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ accentColor: "var(--auth-primary)" }}
              />
              <span>Remember me — keep me signed in on this device</span>
            </label>
            <button type="submit" disabled={busy} className="auth-btn-primary" style={primaryBtn}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            {unverifiedEmail && (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleResendVerification(unverifiedEmail)}
                style={{
                  ...primaryBtn,
                  background: "transparent",
                  color: "var(--auth-primary)",
                  border: "1px solid var(--auth-primary)",
                  marginTop: 0,
                }}
              >
                Resend verification email
              </button>
            )}
            <div style={linkRow}>
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setInfo(null);
                  setUnverifiedEmail(null);
                }}
                style={linkBtn}
              >
                Create account
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("reset");
                  setError(null);
                  setInfo(null);
                  setUnverifiedEmail(null);
                }}
                style={linkBtn}
              >
                Forgot password?
              </button>
            </div>
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <button
                type="button"
                onClick={() =>
                  handleResendVerification(identifier.includes("@") ? identifier : undefined)
                }
                disabled={busy}
                style={linkBtn}
              >
                Didn't get the verification email? Resend
              </button>
            </div>
          </form>
        )}

        {mode === "signup" && (
          <form
            onSubmit={handleSignUp}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <Field
              label="Full name"
              value={fullName}
              onChange={setFullName}
              autoComplete="name"
              required
            />
            <Field
              label="Username"
              value={username}
              onChange={setUsername}
              autoComplete="username"
              required
            />
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              required
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              required
            />
            <PasswordStrength password={password} />
            <PasswordRequirements
              password={password}
              highlightUnmet={weakAttempt}
              ref={requirementsRef}
            />
            <p style={{ fontSize: 12, color: "var(--auth-subtle)", marginTop: -2 }}>
              Min 10 characters with upper, lower, number, and symbol.
            </p>

            <div
              style={{
                background: "var(--auth-notice-bg)",
                border: "1px solid var(--auth-notice-border)",
                padding: 12,
                borderRadius: 8,
                fontSize: 12,
                color: "var(--auth-notice-text)",
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: "var(--auth-notice-strong)" }}>Privacy notice.</strong> By
              creating an account you agree we may store your full name, email, username, and
              account timestamp, and that we record your sign-in sessions, the features you use
              (Lesson Plan Generator, Danielson Review, Worksheet Builder, Professional
              Communication Support), the actions you take, and time spent per feature. This data is
              used to operate the service and is visible to the site owner. Read the full{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--auth-link)" }}
              >
                privacy statement
              </a>
              .
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                fontSize: 13,
                color: "var(--auth-label)",
              }}
            >
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{ marginTop: 3, accentColor: "var(--auth-primary)" }}
              />
              <span>I have read and agree to the privacy notice above.</span>
            </label>

            <button type="submit" disabled={busy} className="auth-btn-primary" style={primaryBtn}>
              {busy ? "Creating…" : "Create account"}
            </button>
            <div style={linkRow}>
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setInfo(null);
                }}
                style={linkBtn}
              >
                Already have an account? Sign in
              </button>
            </div>
          </form>
        )}

        {mode === "reset" && (
          <form
            onSubmit={handleReset}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              required
            />
            <button type="submit" disabled={busy} className="auth-btn-primary" style={primaryBtn}>
              {busy ? "Sending…" : "Send reset link"}
            </button>
            <div style={linkRow}>
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setInfo(null);
                }}
                style={linkBtn}
              >
                Back to sign in
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const effectiveType = isPassword && show ? "text" : type;
  return (
    <label
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        fontSize: 13,
        color: "var(--auth-label)",
      }}
    >
      {label}
      <div style={{ position: "relative" }}>
        <input
          type={effectiveType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          autoComplete={autoComplete}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: isPassword ? "10px 44px 10px 12px" : "10px 12px",
            border: "1px solid var(--auth-input-border)",
            borderRadius: 8,
            fontSize: 14,
            outline: "none",
            background: "var(--auth-input-bg)",
            color: "var(--auth-input-text)",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            tabIndex={-1}
            style={{
              position: "absolute",
              top: "50%",
              right: 8,
              transform: "translateY(-50%)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 6,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--auth-subtle)",
            }}
          >
            {show ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>
    </label>
  );
}

const primaryBtn: React.CSSProperties = {
  color: "white",
  border: "none",
  padding: "12px 16px",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  marginTop: 4,
  letterSpacing: 0.2,
};
const linkRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: 4,
};
const linkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--auth-link)",
  cursor: "pointer",
  fontSize: 13,
  padding: 0,
  fontWeight: 600,
};

export function scorePassword(pw: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
} {
  if (!pw) return { score: 0, label: "Empty", color: "#E5E7EB" };
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 14) score++;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes >= 3) score++;
  if (classes === 4 && pw.length >= 12) score++;
  // Penalize common patterns
  if (/(.)\1\1/.test(pw) || /^(?:password|qwerty|12345|letmein|welcome)/i.test(pw))
    score = Math.max(0, score - 1);
  const s = Math.min(4, Math.max(0, score)) as 0 | 1 | 2 | 3 | 4;
  const map = [
    { label: "Very weak", color: "#DC2626" },
    { label: "Weak", color: "#EA580C" },
    { label: "Fair", color: "#D97706" },
    { label: "Good", color: "#65A30D" },
    { label: "Strong", color: "#059669" },
  ];
  return { score: s, label: map[s].label, color: map[s].color };
}

export function PasswordStrength({ password }: { password: string }) {
  const { score, label, color } = scorePassword(password);
  const segments = 4;
  const filled = score; // 0..4
  return (
    <div style={{ marginTop: -6 }} aria-live="polite">
      <div style={{ display: "flex", gap: 4 }}>
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            data-testid={`pw-strength-segment-${i}`}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              background: i < filled ? color : "#E5E7EB",
              transition: "background 0.15s",
            }}
          />
        ))}
      </div>
      {password && (
        <div
          style={{
            fontSize: 12,
            color,
            marginTop: 4,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>Password strength: {label}</span>
          <span
            tabIndex={0}
            role="tooltip"
            aria-label={`What does ${label} mean?`}
            title={strengthExplanation(label)}
            data-testid="pw-strength-tooltip"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: `1px solid ${color}`,
              color,
              fontSize: 10,
              fontWeight: 700,
              cursor: "help",
              background: "transparent",
              userSelect: "none",
            }}
          >
            ?
          </span>
        </div>
      )}
      {password && (
        <div
          data-testid="pw-strength-explanation"
          style={{ fontSize: 11, color: "var(--auth-subtle)", marginTop: 4, lineHeight: 1.4 }}
        >
          {strengthExplanation(label)}
        </div>
      )}
    </div>
  );
}

export type PasswordRequirement = {
  id: string;
  label: string;
  met: boolean;
  /** True when this unmet item is one the user still needs to reach "Good". */
  neededForGood: boolean;
};

/** Compute the live password requirements list. Exported for tests. */
export function getPasswordRequirements(pw: string): PasswordRequirement[] {
  const items: Array<{ id: string; label: string; met: boolean }> = [
    { id: "len10", label: "At least 10 characters", met: pw.length >= 10 },
    { id: "len12", label: "12+ characters (recommended for Good)", met: pw.length >= 12 },
    { id: "lower", label: "A lowercase letter", met: /[a-z]/.test(pw) },
    { id: "upper", label: "An uppercase letter", met: /[A-Z]/.test(pw) },
    { id: "number", label: "A number", met: /[0-9]/.test(pw) },
    { id: "symbol", label: "A symbol (e.g. !@#$%)", met: /[^A-Za-z0-9]/.test(pw) },
    {
      id: "no-pattern",
      label: "No repeating triples or common words",
      met:
        pw.length > 0 &&
        !/(.)\1\1/.test(pw) &&
        !/^(?:password|qwerty|12345|letmein|welcome)/i.test(pw),
    },
  ];
  const reachedGood = scorePassword(pw).score >= 3;
  return items.map((it) => ({ ...it, neededForGood: !it.met && !reachedGood }));
}

type PasswordRequirementsProps = {
  password: string;
  /** When true, all unmet items are styled as failure (red) — set after a weak signup attempt. */
  highlightUnmet?: boolean;
};

export const PasswordRequirements = React.forwardRef<HTMLDivElement, PasswordRequirementsProps>(
  function PasswordRequirements({ password, highlightUnmet = false }, ref) {
    const reqs = getPasswordRequirements(password);
    const reachedGood = scorePassword(password).score >= 3;
    const failing = highlightUnmet && !reachedGood;
    return (
      <div
        ref={ref}
        aria-label="Password requirements"
        aria-live="polite"
        data-testid="pw-requirements"
        data-failing={failing ? "true" : "false"}
        style={{
          marginTop: 4,
          padding: 10,
          borderRadius: 8,
          border: failing ? "2px solid #DC2626" : "1px solid var(--auth-input-border)",
          background: failing ? "#FEF2F2" : "#FAFAFA",
          scrollMarginTop: 80,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 6,
            color: failing ? "#B91C1C" : "var(--auth-label)",
          }}
        >
          {failing
            ? "Fix these to reach Good:"
            : `Password requirements ${reachedGood ? "✓ Good or better" : "— items needed for Good are highlighted"}`}
        </div>
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {reqs.map((r) => {
            const failedItem = failing && !r.met;
            const itemColor = r.met
              ? "#047857"
              : failedItem
                ? "#B91C1C"
                : r.neededForGood
                  ? "#B45309"
                  : "var(--auth-subtle)";
            return (
              <li
                key={r.id}
                data-testid={`pw-req-${r.id}`}
                data-met={r.met ? "true" : "false"}
                data-needed={r.neededForGood ? "true" : "false"}
                data-failed={failedItem ? "true" : "false"}
                style={{
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  color: itemColor,
                  fontWeight: failedItem || r.neededForGood ? 700 : 500,
                }}
              >
                <span aria-hidden="true">
                  {r.met ? "✓" : failedItem ? "✕" : r.neededForGood ? "●" : "○"}
                </span>
                <span>{r.label}</span>
                {failedItem ? (
                  <span style={{ fontSize: 10, color: "#B91C1C", fontWeight: 700 }}>(missing)</span>
                ) : r.neededForGood ? (
                  <span style={{ fontSize: 10, color: "#B45309", fontWeight: 700 }}>
                    (needed for Good)
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    );
  },
);
