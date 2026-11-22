import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Mail, X, Undo2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getEmailReview } from "@/lib/admin-dlq.functions";
import { resendVerificationEmails } from "@/lib/admin-users.functions";
import {
  canRequestVerification,
  visibleEmailReviews,
  type EmailReviewRow,
} from "@/lib/admin-email-review";

export const Route = createFileRoute("/admin/dlq")({
  head: () => ({
    meta: [
      { title: "Email Review — Tech Savvy Teacher Admin" },
      {
        name: "description",
        content:
          "Review unsuccessful email delivery and request fresh account verification emails.",
      },
      { property: "og:title", content: "Email Review — Tech Savvy Teacher Admin" },
      {
        property: "og:description",
        content: "Private email delivery review for Tech Savvy Teacher administrators.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EmailReviewPage,
});

function EmailReviewPage() {
  const { isAdmin, loading: authLoading, user } = useAuth();
  const review = useServerFn(getEmailReview);
  const resend = useServerFn(resendVerificationEmails);
  const [rows, setRows] = useState<EmailReviewRow[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setDismissed(new Set());
    setRows([]);
    setNotice(null);
  }, [user?.id]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await review());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load email history.");
    } finally {
      setLoading(false);
    }
  }, [review]);

  useEffect(() => {
    if (isAdmin) void refresh();
  }, [isAdmin, refresh]);

  async function requestVerification(row: EmailReviewRow) {
    if (!canRequestVerification(row) || busyId) return;
    setBusyId(row.id);
    setError(null);
    setNotice(null);
    try {
      const results = await resend({ data: { emails: [row.recipient_email] } });
      const result = results[0];
      if (!result?.ok) throw new Error(result?.detail ?? "Verification request failed.");
      setNotice("A fresh verification email was requested. Delivery is not yet confirmed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not request verification.");
    } finally {
      setBusyId(null);
    }
  }

  if (authLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!isAdmin) return <Navigate to="/" />;

  const visibleRows = visibleEmailReviews(rows, dismissed);
  return (
    <main className="mx-auto max-w-5xl p-6">
      <nav className="mb-4 flex flex-wrap gap-4 text-sm">
        <Link to="/admin" className="text-primary hover:underline">
          ← Back to admin
        </Link>
        <Link to="/admin/users" className="text-primary hover:underline">
          Account verification
        </Link>
      </nav>
      <h1 className="text-2xl font-bold text-foreground">Email review</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Recent unsuccessful deliveries · {visibleRows.length} entries
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          className="min-h-11"
          disabled={loading}
          onClick={() => void refresh()}
        >
          <RefreshCw />
          Refresh
        </Button>
        {dismissed.size > 0 && (
          <Button variant="ghost" className="min-h-11" onClick={() => setDismissed(new Set())}>
            <Undo2 />
            Show dismissed ({dismissed.size})
          </Button>
        )}
        {loading && <span className="text-sm text-muted-foreground">Loading…</span>}
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
      <ul className="mt-4 space-y-3">
        {!loading && !error && visibleRows.length === 0 && (
          <li className="p-4 text-sm text-muted-foreground">
            No unsuccessful deliveries in the recent history.
          </li>
        )}
        {visibleRows.map((row) => (
          <li key={row.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                <p className="break-all font-medium text-foreground">{row.recipient_email}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {row.template_name} · {row.status} · {new Date(row.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canRequestVerification(row) && (
                  <Button
                    className="min-h-11"
                    disabled={busyId !== null}
                    onClick={() => void requestVerification(row)}
                  >
                    <Mail />
                    {busyId === row.id ? "Requesting…" : "Request verification"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="icon"
                  className="min-h-11 min-w-11"
                  title="Dismiss from this view; keep delivery history"
                  aria-label={`Dismiss ${row.recipient_email} from this view`}
                  onClick={() => {
                    setDismissed((current) => new Set([...current, row.id]));
                    setNotice(
                      "Entry dismissed from this view only. Delivery and history are unchanged.",
                    );
                  }}
                >
                  <X />
                </Button>
              </div>
            </div>
            {row.error_message && (
              <p className="mt-2 break-words text-sm text-muted-foreground">{row.error_message}</p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
