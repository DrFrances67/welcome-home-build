import { describe, expect, it } from "vitest";
import {
  canRequestVerification,
  reviewFailedEmails,
  visibleEmailReviews,
  type EmailReviewRow,
} from "@/lib/admin-email-review";

function row(overrides: Partial<EmailReviewRow> = {}): EmailReviewRow {
  return {
    id: "failure",
    message_id: "message-1",
    created_at: "2026-11-22T01:00:00Z",
    recipient_email: "teacher@example.com",
    template_name: "signup",
    status: "failed",
    error_message: "Delivery failed",
    ...overrides,
  };
}

describe("transport-independent admin email review", () => {
  it("removes earlier failures when the same message later succeeds", () => {
    expect(
      reviewFailedEmails([
        row(),
        row({ id: "success", status: "sent", created_at: "2026-11-22T02:00:00Z" }),
      ]),
    ).toEqual([]);
  });
  it("keeps only the latest failed outcome per message", () => {
    const latest = row({ id: "rejection", status: "dlq", created_at: "2026-11-22T02:00:00Z" });
    expect(reviewFailedEmails([row(), latest])).toEqual([latest]);
  });
  it("does not collapse unrelated managed-era rows with null message IDs", () => {
    expect(
      reviewFailedEmails([row({ message_id: null }), row({ id: "other", message_id: null })]),
    ).toHaveLength(2);
  });
  it("only offers fresh verification for failed signup messages, not stale recovery links", () => {
    expect(canRequestVerification(row())).toBe(true);
    expect(canRequestVerification(row({ status: "dlq" }))).toBe(true);
    for (const template_name of [
      "recovery",
      "magiclink",
      "invite",
      "contact-message",
      "admin-new-signup",
    ]) {
      expect(canRequestVerification(row({ template_name }))).toBe(false);
    }
    expect(canRequestVerification(row({ status: "sent" }))).toBe(false);
  });
  it("dismisses from the view without changing history and can restore the view", () => {
    const history = [row()];
    expect(visibleEmailReviews(history, new Set(["failure"]))).toEqual([]);
    expect(history).toEqual([row()]);
    expect(visibleEmailReviews(history, new Set())).toEqual(history);
  });
});
