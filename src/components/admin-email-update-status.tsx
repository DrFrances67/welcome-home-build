import { ShieldCheck, CirclePause, MailCheck } from "lucide-react";

/** Informational snapshot only: never reads or changes email/update state. */
export function AdminEmailUpdateStatus() {
  return (
    <section
      aria-label="Email update status"
      className="my-6 border-y border-border bg-muted/40 py-5 text-foreground"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <CirclePause aria-hidden="true" className="mt-1 size-5 shrink-0 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold">Email update: paused</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Last reported update status · Not a live status check
            </p>
          </div>
        </div>
        <p className="flex items-center gap-2 text-sm font-medium">
          <MailCheck aria-hidden="true" className="size-4 shrink-0 text-primary" />
          Current email version remains active
        </p>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="font-semibold">Why resuming is blocked</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The update flagged an older email setup file that also defines the former retry and
            removal controls. That setup has already been applied and is protected history. It
            cannot safely be rewritten or deleted just to clear the restart check.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This is a setup-history blocker, not evidence that recipient records or delivery history
            are damaged. The admin controls have already been adapted to request fresh verification
            and dismiss entries from this view only.
          </p>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-medium">Reported setup file</summary>
            <code className="mt-2 block break-all text-xs text-muted-foreground">
              supabase/migrations/20260911004427_5f80170c-3aaa-4822-8bfa-841f8bb8409e.sql
            </code>
            <p className="mt-2 text-muted-foreground">
              The restart check still needs a supported way to recognize the adapted controls
              without altering this already-applied file.
            </p>
          </details>
        </div>
        <div>
          <h3 className="font-semibold">Safe next steps</h3>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              Keep the current email version and all existing history unchanged. Do not delete
              records, rewrite applied setup history, or retire live email functions to bypass the
              check.
            </li>
            <li>
              Have the email update workflow resolve its protected-history check while preserving
              the already-applied setup. This panel cannot clear that blocker.
            </li>
            <li>
              Once the blocker is resolved, request the free email update again in chat and approve
              it there. No restart or approval happens on this page.
            </li>
            <li>
              Review the updated version before publishing. The current version stays active until
              then; publishing completes the email switch and cannot be undone.
            </li>
          </ol>
        </div>
      </div>
      <p className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
        Read-only notice. No email records are changed or deleted, no update is restarted, and
        nothing is published. Delivery history contains private recipient and error details; keep
        this page restricted to admins.
      </p>
    </section>
  );
}
