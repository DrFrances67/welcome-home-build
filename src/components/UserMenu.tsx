import { useAuth } from "@/hooks/useAuth";
import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useId, useRef, useState } from "react";

export function UserMenu() {
  const { user, profile, isAdmin, signOut, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | HTMLButtonElement | null>>([]);
  const menuId = useId();

  const itemCount = 2; // My Account, Saved Lesson Plans

  const closeMenu = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) {
      // Defer to allow menu unmount before restoring focus.
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  // Outside click + Escape while open.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false); // click-away: don't steal focus
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeMenu(true);
      } else if (e.key === "Tab") {
        // Focus trap: cycle within menu items.
        e.preventDefault();
        setActiveIndex((i) => {
          const next = e.shiftKey ? (i - 1 + itemCount) % itemCount : (i + 1) % itemCount;
          return next;
        });
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, closeMenu]);

  // Move focus to the active menu item when open / activeIndex changes.
  useEffect(() => {
    if (!open) return;
    itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  const openMenu = (startIndex = 0) => {
    setActiveIndex(startIndex);
    setOpen(true);
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openMenu(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openMenu(itemCount - 1);
    }
  };

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % itemCount);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + itemCount) % itemCount);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(itemCount - 1);
    }
  };

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
    outline: "none",
  };
  const menuItemActive: React.CSSProperties = {
    ...menuItem,
    background: "#f1f5f9",
  };

  return (
    <div style={wrap}>
      <div style={{ position: "relative" }} ref={menuRef}>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => (open ? closeMenu(false) : openMenu(0))}
          onKeyDown={onTriggerKeyDown}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label="Account menu"
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
            id={menuId}
            role="menu"
            aria-label="Account"
            aria-orientation="vertical"
            onKeyDown={onMenuKeyDown}
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
              tabIndex={activeIndex === 0 ? 0 : -1}
              ref={(el) => {
                itemRefs.current[0] = el;
              }}
              style={activeIndex === 0 ? menuItemActive : menuItem}
              onMouseEnter={() => setActiveIndex(0)}
              onFocus={() => setActiveIndex(0)}
              onClick={() => closeMenu(false)}
            >
              My Account
            </Link>
            <Link
              to="/lesson-plans"
              role="menuitem"
              tabIndex={activeIndex === 1 ? 0 : -1}
              ref={(el) => {
                itemRefs.current[1] = el;
              }}
              style={{
                ...(activeIndex === 1 ? menuItemActive : menuItem),
                borderTop: "1px solid #f1f5f9",
              }}
              onMouseEnter={() => setActiveIndex(1)}
              onFocus={() => setActiveIndex(1)}
              onClick={() => closeMenu(false)}
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
