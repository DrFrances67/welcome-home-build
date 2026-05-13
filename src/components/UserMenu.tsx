import { useAuth } from "@/hooks/useAuth";
import { Link } from "@tanstack/react-router";

export function UserMenu() {
  const { user, profile, isAdmin, signOut, loading } = useAuth();

  if (loading) return null;

  const wrap: React.CSSProperties = {
    position: "fixed",
    top: 12,
    right: 12,
    zIndex: 9999,
    display: "flex",
    gap: 8,
    alignItems: "center",
  };
  const btn: React.CSSProperties = {
    background: "white",
    border: "1px solid #e2e8f0",
    color: "#0f172a",
    padding: "7px 12px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    textDecoration: "none",
  };
  const primary: React.CSSProperties = { ...btn, background: "#4f46e5", color: "white", border: "1px solid #4f46e5" };

  if (!user) {
    return (
      <div style={wrap}>
        <Link to="/auth" search={{ mode: "signin" }} style={btn}>Sign in</Link>
        <Link to="/auth" search={{ mode: "signup" }} style={primary}>Sign up</Link>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <Link
        to="/account"
        title="Account settings"
        style={{ fontSize: 12, color: "#475569", background: "white", padding: "6px 10px", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", textDecoration: "none", fontWeight: 600 }}
      >
        {profile?.username ?? user.email}
      </Link>
      {isAdmin && <Link to="/admin" style={btn}>Admin</Link>}
      <button onClick={signOut} style={btn}>Sign out</button>
    </div>
  );
}
