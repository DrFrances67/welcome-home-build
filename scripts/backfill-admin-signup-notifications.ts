/**
 * ONE-TIME BACKFILL SCRIPT
 * ------------------------
 * Resends admin "new signup" notifications that previously failed because the
 * enqueued payload was missing an unsubscribe token (`missing_unsubscribe`).
 *
 * - Targets only admin-new-signup emails whose failure was `missing_unsubscribe`.
 * - Skips any notification that has already been delivered (status = 'sent').
 * - Re-enqueues with the now-required unsubscribe_token, reusing the original
 *   idempotency_key (`admin-new-signup-<user_id>`) so the email provider and the
 *   queue processor both de-duplicate — safe to run more than once.
 *
 * Sending is performed by the existing email queue + cron processor, so this
 * works regardless of whether the latest code is published yet.
 *
 * Run from the project root:
 *   bun scripts/backfill-admin-signup-notifications.ts
 */
import { createClient } from "@supabase/supabase-js";
import { render } from "@react-email/components";
import * as React from "react";
import { template as adminNewSignup } from "../src/lib/email-templates/admin-new-signup";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SITE_NAME = "thetechsavvyteacher";
const SENDER_DOMAIN = "notify.techsavvyteacher.app";
const FROM_DOMAIN = "notify.techsavvyteacher.app";
const TEMPLATE_NAME = "admin-new-signup";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getOrCreateUnsubscribeToken(email: string): Promise<string> {
  const normalized = email.toLowerCase();
  const { data: existing } = await sb
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", normalized)
    .maybeSingle();
  if (existing?.token) return existing.token;

  const token = generateToken();
  await sb
    .from("email_unsubscribe_tokens")
    .upsert({ token, email: normalized }, { onConflict: "email", ignoreDuplicates: true });
  const { data: stored } = await sb
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", normalized)
    .maybeSingle();
  return stored?.token ?? token;
}

async function main() {
  // 1. Collect message_ids that failed due to missing_unsubscribe.
  const { data: failedRows, error: failedErr } = await sb
    .from("email_send_log")
    .select("message_id")
    .eq("template_name", TEMPLATE_NAME)
    .ilike("error_message", "%missing_unsubscribe%");
  if (failedErr) throw failedErr;

  // 2. Collect message_ids already sent (to skip).
  const { data: sentRows, error: sentErr } = await sb
    .from("email_send_log")
    .select("message_id")
    .eq("template_name", TEMPLATE_NAME)
    .eq("status", "sent");
  if (sentErr) throw sentErr;

  const sentSet = new Set((sentRows ?? []).map((r) => r.message_id));
  const targets = [...new Set((failedRows ?? []).map((r) => r.message_id))].filter(
    (id) => id && !sentSet.has(id),
  ) as string[];

  const recipient = adminNewSignup.to;
  if (!recipient) {
    console.error("admin-new-signup template has no fixed recipient.");
    process.exit(1);
  }

  console.log(`Found ${targets.length} admin notification(s) to backfill.`);
  if (targets.length === 0) return;

  const unsubscribeToken = await getOrCreateUnsubscribeToken(recipient);

  let queued = 0;
  for (const messageId of targets) {
    const userId = messageId.replace(/^admin-new-signup-/, "");
    const { data: profile } = await sb
      .from("profiles")
      .select("username, full_name, email, created_at")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      console.warn(`  skip ${messageId}: no matching profile (user deleted?)`);
      continue;
    }

    const templateData = {
      username: profile.username ?? "",
      name: profile.full_name ?? "",
      email: profile.email ?? "",
      timestamp: profile.created_at
        ? new Date(profile.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })
        : new Date().toLocaleString("en-US", { timeZone: "America/New_York" }),
    };

    const element = React.createElement(adminNewSignup.component, templateData);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject =
      typeof adminNewSignup.subject === "function"
        ? adminNewSignup.subject(templateData)
        : adminNewSignup.subject;

    // The queue processor derives retry count from prior `failed`/`dlq` log
    // rows for the same message_id. Clear the stale non-sent history so the
    // re-send starts with a clean attempt counter (and re-runs stay idempotent
    // on the original key).
    await sb
      .from("email_send_log")
      .delete()
      .eq("message_id", messageId)
      .neq("status", "sent");

    await sb.from("email_send_log").insert({
      message_id: messageId,
      template_name: TEMPLATE_NAME,
      recipient_email: recipient,
      status: "pending",
    });

    const { error: enqueueError } = await sb.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        idempotency_key: messageId,
        to: recipient,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: TEMPLATE_NAME,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error(`  FAIL ${messageId}:`, enqueueError.message);
      continue;
    }
    queued++;
    console.log(`  queued ${messageId} (${profile.email})`);
  }

  console.log(`\nDone. Enqueued ${queued}/${targets.length}. The cron processor will deliver them.`);
}

main().catch((e) => {
  console.error("Backfill failed:", e);
  process.exit(1);
});
