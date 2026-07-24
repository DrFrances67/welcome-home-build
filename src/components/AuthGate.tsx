import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { AuthPage } from "@/components/AuthPage";
import { startTrackingSession, endTrackingSession } from "@/lib/tracking";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const IDLE_WARNING_MS = 60 * 1000; // warn 60s before sign-out

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const userId = user?.id;
  const [warning, setWarning] = useState(false);
  const secondsLeftRef = useRef(0);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (userId) {
      startTrackingSession(userId);
      return () => {
        endTrackingSession();
      };
    }
  }, [userId]);

  // Auto-logout after 30 minutes of inactivity, with a 60s warning.
  useEffect(() => {
    if (!userId) return;
    let warnTimer: ReturnType<typeof setTimeout>;
    let signOutTimer: ReturnType<typeof setTimeout>;
    let tickInterval: ReturnType<typeof setInterval> | null = null;

    const clearAll = () => {
      clearTimeout(warnTimer);
      clearTimeout(signOutTimer);
      if (tickInterval) {
        clearInterval(tickInterval);
        tickInterval = null;
      }
    };

    const reset = () => {
      clearAll();
      setWarning(false);
      warnTimer = setTimeout(() => {
        setWarning(true);
        secondsLeftRef.current = Math.round(IDLE_WARNING_MS / 1000);
        setSecondsLeft(secondsLeftRef.current);
        tickInterval = setInterval(() => {
          secondsLeftRef.current -= 1;
          setSecondsLeft(secondsLeftRef.current);
          if (secondsLeftRef.current <= 0 && tickInterval) {
            clearInterval(tickInterval);
            tickInterval = null;
          }
        }, 1000);
      }, IDLE_TIMEOUT_MS - IDLE_WARNING_MS);
      signOutTimer = setTimeout(() => {
        setWarning(false);
        toast.info("You've been signed out due to inactivity.");
        supabase.auth.signOut();
      }, IDLE_TIMEOUT_MS);
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
      "wheel",
      "click",
    ];
    const onActivity = () => {
      // Don't reset while the warning is showing; user must explicitly stay.
      if (!warningRef.current) reset();
    };
    const warningRef = { current: false };
    // Track warning state without re-binding listeners.
    const syncWarn = (v: boolean) => {
      warningRef.current = v;
    };

    // Sync initial + subscribe via state change through the outer setter.
    // Simpler: just always reset on activity; the warning toast has its own dismiss.
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    reset();

    // Expose a way for the Stay-signed-in button to reset.
    (window as unknown as { __idleReset?: () => void }).__idleReset = () => {
      syncWarn(false);
      reset();
    };

    return () => {
      clearAll();
      events.forEach((e) => window.removeEventListener(e, onActivity));
      delete (window as unknown as { __idleReset?: () => void }).__idleReset;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <>
      {children}
      {warning && (
        <div
          role="alertdialog"
          aria-labelledby="idle-warning-title"
          aria-describedby="idle-warning-desc"
          className="fixed bottom-4 right-4 z-[10000] w-[min(360px,calc(100vw-2rem))] rounded-lg border border-border bg-background p-4 shadow-lg"
        >
          <p id="idle-warning-title" className="text-sm font-semibold text-foreground">
            Still there?
          </p>
          <p id="idle-warning-desc" className="mt-1 text-sm text-muted-foreground">
            You'll be signed out in {Math.max(0, secondsLeft)}s due to inactivity.
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              Sign out
            </button>
            <button
              onClick={() => {
                setWarning(false);
                (
                  window as unknown as { __idleReset?: () => void }
                ).__idleReset?.();
              }}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Stay signed in
            </button>
          </div>
        </div>
      )}
    </>
  );
}
