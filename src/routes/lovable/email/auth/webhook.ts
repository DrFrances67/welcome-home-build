import * as React from "react";
import { render } from "@react-email/components";
import { parseEmailWebhookPayload } from "@lovable.dev/email-js";
import { WebhookError, verifyWebhookRequest } from "@lovable.dev/webhooks-js";
import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { SignupEmail } from "@/lib/email-templates/signup";
import { InviteEmail } from "@/lib/email-templates/invite";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { EmailChangeEmail } from "@/lib/email-templates/email-change";
import { ReauthenticationEmail } from "@/lib/email-templates/reauthentication";

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: "Confirm your email",
  invite: "You've been invited",
  magiclink: "Your login link",
  recovery: "Reset your password",
  email_change: "Confirm your new email",
  reauthentication: "Your verification code",
};

// Shared prop surface across all auth email templates. Each template consumes
// a subset; requiring the full set keeps the component map type-safe.
type AuthEmailTemplateProps = {
  siteName: string;
  siteUrl: string;
  recipient: string;
  confirmationUrl: string;
  oldEmail: string;
  email: string;
  newEmail: string;
  token: string;
};

interface AuthWebhookPayload {
  run_id: string;
  version: string;
  type: string;
  data: {
    action_type: string;
    email: string;
    url: string;
    token: string;
    old_email: string;
    new_email: string;
  };
}

// Template mapping
const EMAIL_TEMPLATES: Record<string, React.ComponentType<AuthEmailTemplateProps>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
};

// Configuration
const SITE_NAME = "thetechsavvyteacher";
const SENDER_DOMAIN = "notify.techsavvyteacher.app";
const ROOT_DOMAIN = "techsavvyteacher.app";
const FROM_DOMAIN = "notify.techsavvyteacher.app";

function redactEmail(email: string | null | undefined): string {
  if (!email) return "***";
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return "***";
  return `${localPart[0]}***@${domain}`;
}

// Rewrite Supabase's server-side verify link into a direct link to our own
// reset-password page carrying the token_hash.
//
// Supabase's default confirmation URL points at `/auth/v1/verify`, which
// consumes the one-time recovery token on ANY plain GET request. Email
// security scanners (Outlook SafeLinks, corporate mail proxies, antivirus
// link-checkers) prefetch links before delivery, burning the token — so by
// the time the user clicks, Supabase returns "Email link is invalid or has
// expired". Landing on our own page instead means the token is only consumed
// by client-side `verifyOtp`, which requires JS that scanners don't run.
function toDirectRecoveryUrl(rawUrl: string, actionType: string): string {
  try {
    const verifyUrl = new URL(rawUrl);
    const tokenHash =
      verifyUrl.searchParams.get("token") || verifyUrl.searchParams.get("token_hash");
    const redirectTo = verifyUrl.searchParams.get("redirect_to");
    const type = verifyUrl.searchParams.get("type") || actionType;

    if (!tokenHash || !redirectTo) return rawUrl;

    const dest = new URL(redirectTo);
    dest.searchParams.set("token_hash", tokenHash);
    dest.searchParams.set("type", type);
    return dest.toString();
  } catch (error) {
    console.warn("Failed to rewrite recovery confirmation URL; using original", { error });
    return rawUrl;
  }
}

export const Route = createFileRoute("/lovable/email/auth/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;

        if (!apiKey) {
          console.error("LOVABLE_API_KEY not configured");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        // Verify signature + timestamp, then parse payload.
        let payload: AuthWebhookPayload;
        let run_id = "";
        try {
          const verified = await verifyWebhookRequest({
            req: request,
            secret: apiKey,
            parser: parseEmailWebhookPayload,
          });
          payload = verified.payload as AuthWebhookPayload;
          run_id = payload.run_id;
        } catch (error) {
          if (error instanceof WebhookError) {
            switch (error.code) {
              case "invalid_signature":
              case "missing_timestamp":
              case "invalid_timestamp":
              case "stale_timestamp":
                console.error("Invalid webhook signature", { error: error.message });
                return Response.json({ error: "Invalid signature" }, { status: 401 });
              case "invalid_payload":
              case "invalid_json":
                console.error("Invalid webhook payload", { error: error.message });
                return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
            }
          }

          console.error("Webhook verification failed", { error });
          return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
        }

        if (!run_id) {
          console.error("Webhook payload missing run_id");
          return Response.json({ error: "Invalid webhook payload" }, { status: 400 });
        }

        if (payload.version !== "1") {
          console.error("Unsupported payload version", { version: payload.version, run_id });
          return Response.json(
            { error: `Unsupported payload version: ${payload.version}` },
            { status: 400 },
          );
        }

        // The email action type is in payload.data.action_type (e.g., "signup", "recovery")
        // payload.type is the hook event type ("auth")
        const emailType = payload.data.action_type;
        console.log("Received auth event", {
          emailType,
          email_redacted: redactEmail(payload.data.email),
          run_id,
        });

        const EmailTemplate = EMAIL_TEMPLATES[emailType];
        if (!EmailTemplate) {
          console.error("Unknown email type", { emailType, run_id });
          return Response.json({ error: `Unknown email type: ${emailType}` }, { status: 400 });
        }

        // Build template props from payload.data (HookData structure)
        const templateProps = {
          siteName: SITE_NAME,
          siteUrl: `https://${ROOT_DOMAIN}`,
          recipient: payload.data.email,
          confirmationUrl: payload.data.url,
          token: payload.data.token,
          email: payload.data.email,
          oldEmail: payload.data.old_email,
          newEmail: payload.data.new_email,
        };

        // Render React Email to HTML and plain text
        const element = React.createElement(EmailTemplate, templateProps);
        const html = await render(element);
        const text = await render(element, { plainText: true });

        // Enqueue email for async processing by the dispatcher (process-email-queue).
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
          console.error("Missing Supabase environment variables");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const messageId = crypto.randomUUID();

        // Log pending BEFORE enqueue so we have a record even if enqueue crashes
        await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: emailType,
          recipient_email: payload.data.email,
          status: "pending",
        });

        const { error: enqueueError } = await supabase.rpc("enqueue_email", {
          queue_name: "auth_emails",
          payload: {
            run_id,
            message_id: messageId,
            to: payload.data.email,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject: EMAIL_SUBJECTS[emailType] || "Notification",
            html,
            text,
            purpose: "transactional",
            label: emailType,
            queued_at: new Date().toISOString(),
          },
        });

        if (enqueueError) {
          console.error("Failed to enqueue auth email", { error: enqueueError, run_id, emailType });
          await supabase.from("email_send_log").insert({
            message_id: messageId,
            template_name: emailType,
            recipient_email: payload.data.email,
            status: "failed",
            error_message: "Failed to enqueue email",
          });
          return Response.json({ error: "Failed to enqueue email" }, { status: 500 });
        }

        console.log("Auth email enqueued", {
          emailType,
          email_redacted: redactEmail(payload.data.email),
          run_id,
        });

        return Response.json({ success: true, queued: true });
      },
    },
  },
});
