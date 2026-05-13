import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthPage } from "@/components/AuthPage";
import { startTrackingSession, endTrackingSession } from "@/lib/tracking";

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

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>Loading…</div>;
  }

  if (!user) return <AuthPage />;
  return <>{children}</>;
}
