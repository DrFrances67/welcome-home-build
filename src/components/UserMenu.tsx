import { useAuth } from "@/hooks/useAuth";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export function UserMenu() {
  const { user, profile, isAdmin, signOut, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
  const primary: React.CSSProperties = {
    ...btn,
    background: "#4f46e5",
    color: "white",
    border: "1px solid #4f46e5",
  };

  if (!user) {
    return (
      <div style={wrap}>
        <Link to="/auth" search={{ mode: "signin" }} style={btn}>
          Sign in
        </Link>
        <Link to="/auth" search={{ mode: "signup" }} style={primary}>
          Sign up
        </Link>
      </div>
    );
  }

  const menuItem: React.CSSProperties = {
    display: "block",
    padding: "9px 12px",
    fontSize: 13,
    fontWeight: 500,
    color: "#0f172a",
    textDecoration: "none",
    background: "white",
    border: "none",
    width: "100%",
    textAlign: "left",
    cursor: "pointer",
    boxSizing: "border-box",
  };

  return (
    <div style={wrap}>
      <div style={{ position: "relative" }} ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          title="Account menu"
          style={{
            ...btn,
            fontSize: 12,
            color: "#475569",
            padding: "6px 10px",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span>{profile?.username ?? user.email}</span>
          <span aria-hidden="true" style={{ fontSize: 10, color: "#94a3b8" }}>
            ▾
          </span>
        </button>
        {open && (
          <div
            role="menu"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              minWidth: 200,
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
              overflow: "hidden",
            }}
          >
            <Link
              to="/account"
              role="menuitem"
              style={menuItem}
              onClick={() => setOpen(false)}
            >
              My Account
            </Link>
            <Link
              to="/lesson-plans"
              role="menuitem"
              style={{ ...menuItem, borderTop: "1px solid #f1f5f9" }}
              onClick={() => setOpen(false)}
            >
              Saved Lesson Plans
            </Link>
          </div>
        )}
      </div>
      {isAdmin && (
        <Link to="/admin" style={btn}>
          Admin
        </Link>
      )}
      <button onClick={signOut} style={btn}>
        Sign out
      </button>
    </div>
  );
}
