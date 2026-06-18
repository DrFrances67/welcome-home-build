import * as React from "react";
import { render } from "@react-email/components";
import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "thetechsavvyteacher";
const SENDER_DOMAIN = "notify.techsavvyteacher.app";
const FROM_DOMAIN = "notify.techsavvyteacher.app";
const TEMPLATE_NAME = "admin-new-signup";

const PayloadSchema = z.object({
  user_id: z.string().min(1).max(100),
  username: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  timestamp: z.string().min(1).max(64),
});

function redactEmail(email: string | null | undefined): string {
  if (!email) return "***";
  const [l, d] = email.split("@");
  if (!l || !d) return "***";
  return `${l[0]}***@${d}`;
}

// Generate a cryptographically random 32-byte hex token
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const Route = createFileRoute("/api/public/notify-admin-signup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        let parsed;
        try {
          parsed = PayloadSchema.parse(await request.json());
        } catch {
          return Response.json({ error: "Invalid payload" }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, serviceKey);

        // Verify the referenced user actually exists — otherwise this endpoint
        // could be abused to flood the admin inbox with fake signup
        // notifications using arbitrary UUIDs.
        const { data: profileRow } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", parsed.user_id)
          .maybeSingle();
        if (!profileRow) {
          return Response.json({ error: "Unknown user" }, { status: 403 });
        }

        // Idempotency: one notification per new user.
        const idempotencyKey = `admin-new-signup-${parsed.user_id}`;
        const { data: existing } = await supabase
          .from("email_send_log")
          .select("id")
          .eq("message_id", idempotencyKey)
          .maybeSingle();
        if (existing) {
          return Response.json({ success: true, deduplicated: true });
        }

        const entry = TEMPLATES[TEMPLATE_NAME];
        if (!entry) {
          return Response.json({ error: "Template not registered" }, { status: 500 });
        }
        const recipient = entry.to;
        if (!recipient) {
          return Response.json({ error: "Template missing fixed recipient" }, { status: 500 });
        }

        const templateData = {
          username: parsed.username,
          name: parsed.name,
          email: parsed.email,
          timestamp: parsed.timestamp,
        };
        const element = React.createElement(entry.component, templateData);
        const html = await render(element);
        const text = await render(element, { plainText: true });
        const subject =
          typeof entry.subject === "function" ? entry.subject(templateData) : entry.subject;

        await supabase.from("email_send_log").insert({
          message_id: idempotencyKey,
          template_name: TEMPLATE_NAME,
          recipient_email: recipient,
          status: "pending",
        });

        const { error: enqueueError } = await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            message_id: idempotencyKey,
            idempotency_key: idempotencyKey,
            to: recipient,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject,
            html,
            text,
            purpose: "transactional",
            label: TEMPLATE_NAME,
            queued_at: new Date().toISOString(),
          },
        });

        if (enqueueError) {
          console.error("Failed to enqueue admin signup notification", {
            error: enqueueError,
            user_redacted: redactEmail(parsed.email),
          });
          await supabase.from("email_send_log").insert({
            message_id: idempotencyKey,
            template_name: TEMPLATE_NAME,
            recipient_email: recipient,
            status: "failed",
            error_message: "Failed to enqueue email",
          });
          return Response.json({ error: "Failed to enqueue email" }, { status: 500 });
        }

        console.log("Admin signup notification enqueued", {
          user_redacted: redactEmail(parsed.email),
          username: parsed.username,
        });
        return Response.json({ success: true });
      },
    },
  },
});
