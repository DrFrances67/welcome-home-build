import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Public verification-email resend endpoint.
//
// Security: the verification resend audit log must not be writable directly by
// the anon role (it would let anyone forge log entries for any email). This
// endpoint performs the real GoTrue resend AND logs the result server-side with
// the service role, so the log write is always a side effect of a genuine resend.
const BodySchema = z.object({
  email: z.string().trim().email().max(320),
  redirectTo: z.string().url().max(500).optional(),
});

export const Route = createFileRoute("/api/public/resend-verification")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!supabaseUrl || !serviceKey || !publishableKey) {
          return Response.json(
            { ok: false, message: "Server configuration error" },
            { status: 500 },
          );
        }

        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch {
          return Response.json({ ok: false, message: "Invalid email" }, { status: 400 });
        }

        const email = body.email.trim().toLowerCase();
        const admin = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const authClient = createClient(supabaseUrl, publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { error } = await authClient.auth.resend({
          type: "signup",
          email,
          options: body.redirectTo ? { emailRedirectTo: body.redirectTo } : undefined,
        });

        const status = error ? "failed" : "sent";
        // Log the attempt server-side (service role) — never from the browser.
        await admin.rpc("log_verification_resend", {
          _email: email,
          _status: status,
          _error_message: error?.message ?? undefined,
          _message_id: undefined,
        });

        const { data: recent } = await admin.rpc("get_recent_verification_resends", {
          _email: email,
        });

        return Response.json({
          ok: !error,
          message: error?.message ?? null,
          recent: recent ?? [],
        });
      },
    },
  },
});
