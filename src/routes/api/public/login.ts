import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Public sign-in resolver.
//
// Security: username -> email resolution must NEVER be exposed to unauthenticated
// callers (it would let anyone enumerate user emails). This endpoint resolves the
// email server-side using the service role and performs the password sign-in on
// the server, so the email address is only ever returned when the caller already
// proved knowledge of the correct password (success or "email not confirmed").
const BodySchema = z.object({
  identifier: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(200),
});

export const Route = createFileRoute("/api/public/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!supabaseUrl || !serviceKey || !publishableKey) {
          return Response.json({ ok: false, code: "server_error" }, { status: 500 });
        }

        let body: z.infer<typeof BodySchema>;
        try {
          body = BodySchema.parse(await request.json());
        } catch {
          return Response.json({ ok: false, code: "invalid_input" }, { status: 400 });
        }

        const identifier = body.identifier.trim();
        const admin = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        // Resolve to an email address.
        let email: string | null = null;
        if (identifier.includes("@")) {
          email = identifier.toLowerCase();
        } else {
          const { data } = await admin.rpc("get_email_by_username", { _username: identifier });
          email = (data as string | null) ?? null;
        }
        if (!email) {
          return Response.json({ ok: false, code: "no_account" });
        }

        // Perform the actual sign-in server-side with the publishable key.
        const authClient = createClient(supabaseUrl, publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: signInData, error } = await authClient.auth.signInWithPassword({
          email,
          password: body.password,
        });

        if (error) {
          // A "not confirmed" error implies the password was correct, so it is
          // safe to return the email (needed for the resend-verification flow).
          const unverified = /confirm|verif/i.test(error.message);
          if (unverified) {
            const { data: recent } = await admin.rpc("get_recent_verification_resends", {
              _email: email,
            });
            return Response.json({
              ok: false,
              code: "unverified",
              email,
              message: error.message,
              recent: recent ?? [],
            });
          }
          // Wrong credentials: do NOT leak the email address.
          return Response.json({ ok: false, code: "invalid", message: error.message });
        }

        const session = signInData.session;
        if (!session) {
          return Response.json({ ok: false, code: "invalid", message: "No session returned" });
        }

        return Response.json({
          ok: true,
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          email,
        });
      },
    },
  },
});
