import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface AuthUserRow {
  id: string;
  email: string;
  confirmed: boolean;
  created_at: string;
  confirmation_sent_at: string | null;
  last_sign_in_at: string | null;
}

export interface SearchUsersResult {
  users: AuthUserRow[];
  total: number;
  truncated: boolean;
}

export interface ResendResult {
  email: string;
  ok: boolean;
  detail?: string;
}

/**
 * Verify the authenticated caller is an admin using the service-role client.
 * Throws a 403 Response when the caller lacks the admin role.
 */
async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: isAdmin, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !isAdmin) {
    throw new Response("Forbidden", { status: 403 });
  }
  return supabaseAdmin;
}

const MAX_RESULTS = 200;
const MAX_PAGES = 20;
const PER_PAGE = 1000;

/**
 * Search auth users by email substring and confirmation status.
 * Admin-only. Returns up to MAX_RESULTS matching users.
 */
export const searchAuthUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        query: z.string().trim().max(200).optional().default(""),
        status: z.enum(["all", "confirmed", "unconfirmed"]).optional().default("all"),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<SearchUsersResult> => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const needle = data.query.toLowerCase();

    const matches: AuthUserRow[] = [];
    let truncated = false;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data: pageData, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: PER_PAGE,
      });
      if (error) throw new Response(error.message, { status: 500 });
      const users = pageData.users ?? [];

      for (const u of users) {
        if (!u.email) continue;
        if (needle && !u.email.toLowerCase().includes(needle)) continue;
        const confirmed = !!u.email_confirmed_at;
        if (data.status === "confirmed" && !confirmed) continue;
        if (data.status === "unconfirmed" && confirmed) continue;
        matches.push({
          id: u.id,
          email: u.email,
          confirmed,
          created_at: u.created_at,
          confirmation_sent_at: u.confirmation_sent_at ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
        });
      }

      if (users.length < PER_PAGE) break;
      if (matches.length >= MAX_RESULTS) {
        truncated = true;
        break;
      }
    }

    matches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      total: matches.length,
      truncated,
      users: matches.slice(0, MAX_RESULTS),
    };
  });

/**
 * Trigger a signup verification resend for the given emails through the GoTrue
 * resend endpoint (the same hook -> webhook -> queue -> cron pipeline used by
 * normal signups). Each attempt is logged to verification_resend_log.
 * Admin-only.
 */
export const resendVerificationEmails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        emails: z.array(z.string().email()).min(1).max(50),
      })
      .parse(data),
  )
  .handler(async ({ context, data }): Promise<ResendResult[]> => {
    const supabaseAdmin = await assertAdmin(context.userId);

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
      throw new Response("Email resend is not configured", { status: 500 });
    }

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const results: ResendResult[] = [];

    for (let i = 0; i < data.emails.length; i++) {
      const email = data.emails[i];
      let result: ResendResult;
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/resend`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: PUBLISHABLE_KEY,
            Authorization: `Bearer ${PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ type: "signup", email }),
        });
        if (res.ok) {
          result = { email, ok: true };
        } else {
          const body = await res.text();
          result = { email, ok: false, detail: `${res.status} ${body.slice(0, 200)}` };
        }
      } catch (e) {
        result = { email, ok: false, detail: e instanceof Error ? e.message : "Request failed" };
      }

      // Best-effort logging so attempts surface in the resends dashboard.
      try {
        await supabaseAdmin.rpc("log_verification_resend", {
          _email: email,
          _status: result.ok ? "sent" : "failed",
          _error_message: result.ok ? undefined : (result.detail ?? undefined),
        });
      } catch {
        // ignore logging failures
      }

      results.push(result);

      // Be gentle with auth rate limits between sends.
      if (i < data.emails.length - 1) await sleep(1200);
    }

    return results;
  });
