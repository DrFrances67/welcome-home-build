import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthPage } from "@/components/AuthPage";
import { startTrackingSession, endTrackingSession } from "@/lib/tracking";
import { supabase } from "@/integrations/supabase/client";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user) {
      startTrackingSession(user.id);
      return () => {
        endTrackingSession();
      };
    }
  }, [user?.id]);

  // Auto-logout after 30 minutes of inactivity.
  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        supabase.auth.signOut();
      }, IDLE_TIMEOUT_MS);
    };
    const events: (keyof WindowEventMap)[] = [
      "mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel", "click",
    ];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [user?.id]);

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>Loading…</div>;
  }

  if (!user) {
    return (
      <>
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            overflow: "hidden",
            pointerEvents: "none",
            filter: "blur(6px)",
            transform: "scale(1.02)",
            opacity: 0.6,
          }}
        >
          {children}
        </div>
        <AuthPage />
      </>
    );
  }
  return <>{children}</>;
}
