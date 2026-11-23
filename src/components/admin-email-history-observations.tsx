import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, ClipboardCheck, CirclePause, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import {
  getEmailHistoryObservations,
  reportEmailHistoryObservation,
  type HistoryObservation,
} from "@/lib/admin-email-history.functions";

export function AdminEmailHistoryObservations() {
  const { user, isAdmin } = useAuth();
  const load = useServerFn(getEmailHistoryObservations);
  const report = useServerFn(reportEmailHistoryObservation);
  const [rows, setRows] = useState<HistoryObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await load());
    } catch {
      setError("Could not load blocker observations. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    setRows([]);
    setNotice(null);
    setConfirmed(false);
    if (isAdmin) void refresh();
  }, [user?.id, isAdmin, refresh]);

  async function record(state: "restriction_present" | "restriction_cleared") {
    if (!confirmed || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await report({ data: { state, confirmed: true } });
      setNotice(
        result.recorded
          ? "Observation recorded. Email records and the update itself are unchanged."
          : "This status is already the latest observation; no duplicate was added.",
      );
      setConfirmed(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record the observation.");
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) return null;
  const latest = rows[0];
  return (
    <section
      aria-label="Protected-history audit trail"
      className="my-6 border-y border-border py-5 text-foreground"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Protected-history audit trail</h2>
        <Button
          variant="outline"
          size="icon"
          className="min-h-11 min-w-11"
          aria-label="Refresh blocker observations"
          title="Refresh blocker observations"
          disabled={loading || busy}
          onClick={() => void refresh()}
        >
          <RefreshCw />
        </Button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Admin-confirmed observations only, not automatic detection or live update status. Record a
        change only after checking the latest email-update message in chat. Marking a restriction
        cleared does not remove it, approve a restart, or publish anything.
      </p>
      <p className="mt-3 flex items-center gap-2 text-sm font-medium">
        <ClipboardCheck aria-hidden="true" className="size-4 shrink-0 text-primary" />
        Latest observation:{" "}
        {loading
          ? "Loading…"
          : latest
            ? latest.state === "restriction_present"
              ? "Restriction present"
              : "Restriction cleared (admin reported)"
            : "None recorded"}
      </p>
      <label className="mt-4 flex min-h-11 items-start gap-3 text-sm leading-relaxed">
        <Checkbox
          className="mt-1"
          checked={confirmed}
          disabled={busy}
          onCheckedChange={(value) => setConfirmed(value === true)}
        />
        I checked the latest update message and am recording the status it confirms.
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="min-h-11"
          disabled={!confirmed || busy || loading}
          onClick={() => void record("restriction_present")}
        >
          <CirclePause />
          Record restriction present
        </Button>
        <Button
          variant="outline"
          className="min-h-11"
          disabled={!confirmed || busy || loading}
          onClick={() => void record("restriction_cleared")}
        >
          <CheckCircle2 />
          Record confirmed clearance
        </Button>
      </div>
      {notice && (
        <p role="status" className="mt-3 text-sm text-primary">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <details className="mt-4" open>
        <summary className="cursor-pointer text-sm font-medium">
          Observation history (latest 100)
        </summary>
        <ul className="mt-2 divide-y divide-border text-sm">
          {!loading && !error && rows.length === 0 && (
            <li className="py-3 text-muted-foreground">
              No observations recorded. Earlier update attempts have not been backfilled.
            </li>
          )}
          {rows.map((row) => (
            <li key={row.id} className="py-3">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">
                  {row.state === "restriction_present"
                    ? "Restriction appeared / present"
                    : "Restriction cleared"}
                </span>
                <time dateTime={row.created_at}>{new Date(row.created_at).toLocaleString()}</time>
              </div>
              <p className="mt-1 break-all text-muted-foreground">
                Reported by admin account: {row.actor_user_id}
              </p>
            </li>
          ))}
        </ul>
      </details>
      <p className="mt-3 text-sm text-muted-foreground">
        Observations are permanent audit entries. No email addresses, contents, or error details are
        stored here.
      </p>
    </section>
  );
}
