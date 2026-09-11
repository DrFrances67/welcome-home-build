import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/useAuth";
import {
  getDlqOverview,
  getDlqMessages,
  actOnDlqMessage,
  type DlqQueueSummary,
  type DlqMessage,
} from "@/lib/admin-dlq.functions";

const QUEUES = ["auth_emails_dlq", "transactional_emails_dlq"] as const;
type QueueName = (typeof QUEUES)[number];

const QUEUE_LABELS: Record<QueueName, string> = {
  auth_emails_dlq: "Sign-in & verification emails",
  transactional_emails_dlq: "Other app emails",
};

export const Route = createFileRoute("/admin/dlq")({
  head: () => ({
    meta: [
      { title: "Undelivered Emails — Admin" },
      {
        name: "description",
        content: "Internal admin view of emails that failed delivery and are waiting for review.",
      },
      { property: "og:title", content: "Undelivered Emails — Admin" },
      {
        property: "og:description",
        content: "Internal admin view of emails that failed delivery and are waiting for review.",
      },
      { property: "og:url", content: "https://techsavvyteacher.app/admin/dlq" },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://techsavvyteacher.app/admin/dlq" }],
  }),
  component: DlqAdminPage,
});

function DlqAdminPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const overviewFn = useServerFn(getDlqOverview);
  const messagesFn = useServerFn(getDlqMessages);
  const actFn = useServerFn(actOnDlqMessage);

  const [overview, setOverview] = useState<DlqQueueSummary[]>([]);
  const [queue, setQueue] = useState<QueueName>("auth_emails_dlq");
  const [messages, setMessages] = useState<DlqMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, m] = await Promise.all([
        overviewFn({ data: undefined }),
        messagesFn({ data: { queue, limit: 100 } }),
      ]);
      setOverview(o);
      setMessages(m);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load the queue.");
    } finally {
      setLoading(false);
    }
  }, [overviewFn, messagesFn, queue]);

  useEffect(() => {
    if (!isAdmin) return;
    void refresh();
  }, [isAdmin, refresh]);

  if (authLoading) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }
  if (!isAdmin) {
    return <Navigate to="/" />;
  }

  const act = async (msgId: number, action: "requeue" | "discard") => {
    setBusyId(msgId);
    setNotice(null);
    try {
      await actFn({ data: { queue, msgId, action } });
      setNotice(action === "requeue" ? "Message sent for another try." : "Message removed.");
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "That action did not work.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="mx-auto max-w-5xl p-6">
      <nav className="mb-4 text-sm">
        <Link to="/admin" className="text-primary hover:underline">
          ← Back to admin
        </Link>
      </nav>
      <h1 className="text-2xl font-bold text-foreground">Undelivered emails</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Emails that failed repeatedly are parked here. Try them again or remove them.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {QUEUES.map((q) => {
          const row = overview.find((o) => o.queue_name === q);
          const active = q === queue;
          return (
            <button
              key={q}
              type="button"
              onClick={() => setQueue(q)}
              aria-pressed={active}
              className={`rounded-lg border p-4 text-left transition ${
                active ? "border-primary bg-muted" : "border-border bg-background hover:bg-muted/50"
              }`}
            >
              <div className="text-sm font-semibold text-foreground">{QUEUE_LABELS[q]}</div>
              <div className="mt-1 text-2xl font-bold text-foreground">
                {row?.message_count ?? 0}
              </div>
              <div className="text-xs text-muted-foreground">
                {row?.oldest_at
                  ? `Oldest: ${new Date(row.oldest_at).toLocaleString()}`
                  : "None waiting"}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
        >
          Refresh
        </button>
        {loading && <span className="text-sm text-muted-foreground">Loading…</span>}
        {notice && <span className="text-sm text-primary">{notice}</span>}
        {error && (
          <span role="alert" className="text-sm text-destructive">
            {error}
          </span>
        )}
      </div>

      <ul className="mt-4 space-y-3">
        {!loading && messages.length === 0 && (
          <li className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            Nothing waiting in this queue.
          </li>
        )}
        {messages.map((m) => (
          <li key={m.msg_id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                #{m.msg_id} · {new Date(m.enqueued_at).toLocaleString()} · tries {m.read_ct}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyId === m.msg_id}
                  onClick={() => void act(m.msg_id, "requeue")}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Try again
                </button>
                <button
                  type="button"
                  disabled={busyId === m.msg_id}
                  onClick={() => void act(m.msg_id, "discard")}
                  className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-xs text-foreground">
              {m.message}
            </pre>
          </li>
        ))}
      </ul>
    </main>
  );
}
