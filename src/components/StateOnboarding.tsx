import { useEffect, useRef, useState } from "react";
import { STATES, type StateCode } from "@/data/state-standards";
import { useAppState } from "@/contexts/app-state-context";

/**
 * First-run welcome that asks the teacher which state's standards to use.
 * Only shown when no choice has ever been stored; the picker in the app
 * header remains the way to change it later.
 */
export function StateOnboarding({ storageKey = "tst-selected-state" }: { storageKey?: string }) {
  // Skipping is remembered under its own key so the welcome only ever shows
  // once; the header picker remains the way to set a state later.
  const dismissedKey = `${storageKey}:dismissed`;
  const { stateCode, setStateCode } = useAppState();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<StateCode>(stateCode);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(storageKey) && !window.localStorage.getItem(dismissedKey))
        setOpen(true);
    } catch {
      /* storage blocked — skip onboarding */
    }
  }, [storageKey, dismissedKey]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const confirm = () => {
    setStateCode(choice);
    try {
      window.localStorage.removeItem(dismissedKey);
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  const skip = () => {
    try {
      window.localStorage.setItem(dismissedKey, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="state-onboarding-title"
        aria-describedby="state-onboarding-desc"
        className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
      >
        <h2 id="state-onboarding-title" className="text-lg font-bold text-foreground">
          Welcome! Which state do you teach in?
        </h2>
        <p id="state-onboarding-desc" className="mt-1 text-sm text-muted-foreground">
          We'll match lesson plans and worksheets to your state's learning standards. You can change
          this any time from the picker at the top of the app.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {STATES.map((s) => (
            <button
              key={s.code}
              type="button"
              onClick={() => setChoice(s.code)}
              aria-pressed={choice === s.code}
              className={`rounded-lg border px-3 py-3 text-left text-sm font-semibold transition ${
                choice === s.code
                  ? "border-primary bg-muted text-foreground"
                  : "border-border bg-background text-foreground hover:bg-muted/50"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={skip}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={confirm}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Start teaching
          </button>
        </div>
      </div>
    </div>
  );
}
