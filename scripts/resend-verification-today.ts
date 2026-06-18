/**
 * ONE-TIME SCRIPT
 * ---------------
 * Resends signup verification (confirm-email) emails to every user who signed
 * up TODAY (UTC) and has not yet confirmed their email address.
 *
 * - Mints a fresh, valid confirmation link via the Auth Admin API
 *   (generateLink type 'signup') — does NOT change the user's password.
 * - Renders the branded SignupEmail template and enqueues it into the
 *   `auth_emails` queue (auth-purpose payload carries a run_id, so the email
 *   provider does not require an unsubscribe token).
 * - Skips users who already received a 'sent' verification email today, so it
 *   is safe to run more than once.
 *
 * Sending is performed by the existing email queue + cron processor.
 *
 * Run from the project root:
 *   bun scripts/resend-verification-today.ts
 */
import { createClient } from "@supabase/supabase-js";
import { render } from "@react-email/components";
import * as React from "react";
import { SignupEmail } from "../src/lib/email-templates/signup";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SITE_NAME = "thetechsavvyteacher";
const SITE_URL = "https://thetechsavvyteacher.lovable.app";
const SENDER_DOMAIN = "notify.techsavvyteacher.app";
const FROM_DOMAIN = "notify.techsavvyteacher.app";
const SUBJECT = "Confirm your email";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function listTodaysUnconfirmedUsers() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const result: { id: string; email: string }[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data.users ?? [];
    for (const u of users) {
      if (!u.email) continue;
      if (new Date(u.created_at) < start) continue;
      if (u.email_confirmed_at) continue; // already confirmed
      result.push({ id: u.id, email: u.email });
    }
    if (users.length < 1000) break;
  }
  return result;
}

async function alreadySentToday(email: string): Promise<boolean> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { data } = await sb
    .from("email_send_log")
    .select("id")
    .eq("template_name", "signup")
    .eq("recipient_email", email)
    .eq("status", "sent")
    .gte("created_at", start.toISOString())
    .maybeSingle();
  return !!data;
}

async function main() {
  const users = await listTodaysUnconfirmedUsers();
  console.log(`Found ${users.length} unconfirmed signup(s) from today.`);
  if (users.length === 0) return;

  let queued = 0;
  for (const user of users) {
    if (await alreadySentToday(user.email)) {
      console.log(`  skip ${user.email}: verification already sent today`);
      continue;
    }

    const { data: linkData, error: linkErr } = await sb.auth.admin.generateLink({
      type: "signup",
      email: user.email,
      options: { redirectTo: SITE_URL },
    });
    if (linkErr || !linkData?.properties?.action_link) {
      console.error(`  FAIL ${user.email}: could not generate link`, linkErr?.message);
      continue;
    }

    const confirmationUrl = linkData.properties.action_link;
    const element = React.createElement(SignupEmail, {
      siteName: SITE_NAME,
      siteUrl: SITE_URL,
      recipient: user.email,
      confirmationUrl,
    });
    const html = await render(element);
    const text = await render(element, { plainText: true });

    const messageId = crypto.randomUUID();
    const runId = crypto.randomUUID();

    await sb.from("email_send_log").insert({
      message_id: messageId,
      template_name: "signup",
      recipient_email: user.email,
      status: "pending",
    });

    const { error: enqueueError } = await sb.rpc("enqueue_email", {
      queue_name: "auth_emails",
      payload: {
        run_id: runId,
        message_id: messageId,
        to: user.email,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: SUBJECT,
        html,
        text,
        purpose: "transactional",
        label: "signup",
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error(`  FAIL ${user.email}:`, enqueueError.message);
      continue;
    }
    queued++;
    console.log(`  queued verification for ${user.email}`);
  }

  console.log(`\nDone. Enqueued ${queued}/${users.length}. The cron processor will deliver them.`);
}

main().catch((e) => {
  console.error("Resend failed:", e);
  process.exit(1);
});
