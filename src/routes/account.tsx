import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { scorePassword } from "@/components/AuthPage";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Your Account — The Tech Savvy Teacher" },
      {
        name: "description",
        content:
          "Manage your Tech Savvy Teacher profile: update your name, username, password, school details, and home address.",
      },
      { property: "og:title", content: "Your Account — The Tech Savvy Teacher" },
      {
        property: "og:description",
        content: "Update your profile, password, and school details on The Tech Savvy Teacher.",
      },
      { property: "og:url", content: "https://techsavvyteacher.app/account" },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://techsavvyteacher.app/account" }],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolAddress, setSchoolAddress] = useState("");
  const [schoolInfo, setSchoolInfo] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setUsername(profile.username ?? "");
    const p = profile as unknown as Record<string, string | null>;
    setHomeAddress(p.home_address ?? "");
    setSchoolName(p.school_name ?? "");
    setSchoolAddress(p.school_address ?? "");
    setSchoolInfo(p.school_info ?? "");
  }, [profile]);

  if (loading || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!fullName.trim()) return setMsg({ type: "err", text: "Name is required." });
    if (!username.trim() || username.trim().length < 3)
      return setMsg({ type: "err", text: "Username must be at least 3 characters." });

    if (password) {
      if (password.length < 8)
        return setMsg({ type: "err", text: "Password must be at least 8 characters." });
      if (scorePassword(password).score < 3)
        return setMsg({ type: "err", text: "Password is too weak — reach at least Good." });
    }

    setSaving(true);
    try {
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          username: username.trim(),
          home_address: homeAddress.trim() || null,
          school_name: schoolName.trim() || null,
          school_address: schoolAddress.trim() || null,
          school_info: schoolInfo.trim() || null,
        })
        .eq("id", user.id);
      if (profErr) throw profErr;

      if (password) {
        const { error: pwErr } = await supabase.auth.updateUser({ password });
        if (pwErr) throw pwErr;
        setPassword("");
      }

      await refreshProfile();
      setMsg({ type: "ok", text: "Changes saved." });
    } catch (err) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to save." });
    } finally {
      setSaving(false);
    }
  };

  const label: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#0f172a",
    marginBottom: 6,
  };
  const input: React.CSSProperties = {
    width: "100%",
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    fontSize: 14,
    background: "white",
    color: "#0f172a",
    boxSizing: "border-box",
  };
  const field: React.CSSProperties = { marginBottom: 16 };
  const sectionTitle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#64748b",
    margin: "24px 0 12px",
  };

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "80px 20px 60px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>Account</h1>
      <p style={{ color: "#64748b", marginBottom: 24, fontSize: 14 }}>
        Update your profile information.
      </p>

      <form
        onSubmit={handleSave}
        style={{
          background: "white",
          padding: 24,
          borderRadius: 12,
          boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={sectionTitle}>Required</div>

        <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 12px" }}>
          Fields marked with{" "}
          <span style={{ color: "#dc2626" }} aria-hidden="true">
            *
          </span>{" "}
          are required.
        </p>

        <div style={field}>
          <label style={label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            style={{ ...input, background: "#f1f5f9", color: "#475569", cursor: "not-allowed" }}
            value={profile?.email ?? user.email ?? ""}
            readOnly
            aria-readonly="true"
          />
        </div>

        <div style={field}>
          <label style={label} htmlFor="fullName">
            Name
          </label>
          <span style={{ color: "#dc2626", marginLeft: 4 }} aria-hidden="true">
            *
          </span>
          <input
            id="fullName"
            style={input}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

        <div style={field}>
          <label style={label} htmlFor="username">
            Username
          </label>
          <span style={{ color: "#dc2626", marginLeft: 4 }} aria-hidden="true">
            *
          </span>
          <input
            id="username"
            style={input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
          />
        </div>

        <div style={field}>
          <label style={label} htmlFor="password">
            Password
          </label>
          <span style={{ color: "#dc2626", marginLeft: 4 }} aria-hidden="true">
            *
          </span>
          <input
            id="password"
            type="password"
            style={input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep current password"
            autoComplete="new-password"
          />
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
            Only fill in to change your password (must reach &ldquo;Good&rdquo; strength).
          </p>
        </div>

        <div style={sectionTitle}>Optional</div>

        <div style={field}>
          <label style={label} htmlFor="homeAddress">
            Home address
          </label>
          <input
            id="homeAddress"
            style={input}
            value={homeAddress}
            onChange={(e) => setHomeAddress(e.target.value)}
          />
        </div>

        <div style={field}>
          <label style={label} htmlFor="schoolName">
            School name
          </label>
          <input
            id="schoolName"
            style={input}
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
          />
        </div>

        <div style={field}>
          <label style={label} htmlFor="schoolAddress">
            School address
          </label>
          <input
            id="schoolAddress"
            style={input}
            value={schoolAddress}
            onChange={(e) => setSchoolAddress(e.target.value)}
          />
        </div>

        <div style={field}>
          <label style={label} htmlFor="schoolInfo">
            Additional school info
          </label>
          <textarea
            id="schoolInfo"
            style={{ ...input, minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
            value={schoolInfo}
            onChange={(e) => setSchoolInfo(e.target.value)}
          />
        </div>

        {msg && (
          <div
            role="status"
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 13,
              background: msg.type === "ok" ? "#ecfdf5" : "#fef2f2",
              color: msg.type === "ok" ? "#065f46" : "#991b1b",
              border: `1px solid ${msg.type === "ok" ? "#a7f3d0" : "#fecaca"}`,
            }}
          >
            {msg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            width: "100%",
            padding: "11px 16px",
            borderRadius: 8,
            border: "none",
            background: saving ? "#818cf8" : "#4f46e5",
            color: "white",
            fontWeight: 600,
            fontSize: 14,
            cursor: saving ? "wait" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </main>
  );
}
