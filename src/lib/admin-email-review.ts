import type { Database } from "@/integrations/supabase/types";

export type EmailReviewRow = Pick<
  Database["public"]["Tables"]["email_send_log"]["Row"],
  | "id"
  | "message_id"
  | "created_at"
  | "recipient_email"
  | "status"
  | "template_name"
  | "error_message"
>;

export function reviewFailedEmails(rows: EmailReviewRow[]): EmailReviewRow[] {
  const latest = new Map<string, EmailReviewRow>();
  for (const row of [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const key = row.message_id ? `message:${row.message_id}` : `row:${row.id}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  return [...latest.values()].filter((row) => row.status === "failed" || row.status === "dlq");
}

/** Request fresh verification only; never replay old links or HTML. */
export function canRequestVerification(row: EmailReviewRow): boolean {
  return row.template_name === "signup" && ["failed", "dlq"].includes(row.status);
}

/** Local view operation only: history and delivery remain unchanged. */
export function visibleEmailReviews(rows: EmailReviewRow[], dismissed: ReadonlySet<string>) {
  return rows.filter((row) => !dismissed.has(row.id));
}
