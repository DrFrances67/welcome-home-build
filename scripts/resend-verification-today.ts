/**
 * ONE-TIME SCRIPT
 * ---------------
 * Resends signup verification (confirm-email) emails to every user who signed
 * up TODAY (UTC) and has not yet confirmed their email address.
 *
 * Verification emails MUST flow through Supabase's auth "Send Email" hook so the
 * Lovable email API receives a valid `run_id` (a self-generated run is rejected
 * with `run_not_found`). This script therefore calls the GoTrue `resend`
 * endpoint, which re-triggers the confirmation email through the normal hook ->
 * webhook -> queue -> cron pipeline.
 *
 * - Skips users who already received a 'sent' verification email today, so it is
 *   safe to run more than once.
 * - Verifies each resend actually enqueued by checking for a fresh signup log
 *   row, and reports any that did not (which indicates the auth email hook is
 *   not live yet — publish the app, then re-run).
 *
 * Run from the project root:
 *   bun scripts/resend-verification-today.ts
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLISHABLE_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !PUBLISHABLE_KEY) {
  console.error(
    "Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or a publishable/anon key in env.",
  );
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
      if (u.email_confirmed_at) continue;
      result.push({ id: u.id, email: u.email });
    }
    if (users.length < 1000) break;
  }
  return result;
}

async function sentToday(email: string): Promise<boolean> {
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

async function enqueuedSince(email: string, sinceIso: string): Promise<boolean> {
  const { data } = await sb
    .from("email_send_log")
    .select("id")
    .eq("template_name", "signup")
    .eq("recipient_email", email)
    .gte("created_at", sinceIso)
    .limit(1);
  return !!(data && data.length);
}

async function resend(email: string): Promise<{ ok: boolean; detail?: string }> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/resend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: PUBLISHABLE_KEY as string,
      Authorization: `Bearer ${PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ type: "signup", email }),
  });
  if (res.ok) return { ok: true };
  const body = await res.text();
  return { ok: false, detail: `${res.status} ${body.slice(0, 200)}` };
}

async function main() {
  const users = await listTodaysUnconfirmedUsers();
  console.log(`Found ${users.length} unconfirmed signup(s) from today.`);
  if (users.length === 0) return;

  let triggered = 0;
  let enqueued = 0;
  for (const user of users) {
    if (await sentToday(user.email)) {
      console.log(`  skip ${user.email}: verification already sent today`);
      continue;
    }

    const since = new Date().toISOString();
    const r = await resend(user.email);
    if (!r.ok) {
      console.error(`  FAIL ${user.email}: resend rejected -> ${r.detail}`);
      continue;
    }
    triggered++;

    // Give the hook -> webhook -> enqueue path a moment, then verify it landed.
    let landed = false;
    for (let i = 0; i < 5; i++) {
      await sleep(2000);
      if (await enqueuedSince(user.email, since)) {
        landed = true;
        break;
      }
    }
    if (landed) {
      enqueued++;
      console.log(`  resent + enqueued for ${user.email}`);
    } else {
      console.warn(
        `  WARN ${user.email}: resend accepted but no email was enqueued -> the auth email hook is not live yet. Publish the app, then re-run.`,
      );
    }

    // Be gentle with auth rate limits.
    await sleep(1500);
  }

  console.log(
    `\nDone. Triggered ${triggered}/${users.length}; confirmed enqueued ${enqueued}. The cron processor delivers enqueued emails.`,
  );
}

main().catch((e) => {
  console.error("Resend failed:", e);
  process.exit(1);
});
