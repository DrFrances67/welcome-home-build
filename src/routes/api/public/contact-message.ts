import * as React from 'react'
import { render } from '@react-email/components'
import { createClient } from '@supabase/supabase-js'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { TEMPLATES } from '@/lib/email-templates/registry'

const SITE_NAME = 'thetechsavvyteacher'
const SENDER_DOMAIN = 'notify.techsavvyteacher.app'
const FROM_DOMAIN = 'notify.techsavvyteacher.app'
const TEMPLATE_NAME = 'contact-message'

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024
// base64 expands ~33%; cap encoded length accordingly with a small overhead allowance.
const MAX_BASE64_LEN = Math.ceil((MAX_SCREENSHOT_BYTES * 4) / 3) + 16
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365 // 1 year
const SCREENSHOT_BUCKET = 'contact-screenshots'

const PayloadSchema = z.object({
  firstName: z.string().trim().max(100).optional().default(''),
  lastName: z.string().trim().max(100).optional().default(''),
  email: z.string().trim().email().max(320),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
  screenshotBase64: z
    .string()
    .max(MAX_BASE64_LEN)
    .regex(/^[A-Za-z0-9+/=]+$/)
    .nullable()
    .optional(),
  screenshotName: z.string().max(255).nullable().optional(),
  screenshotType: z.enum(ALLOWED_IMAGE_TYPES).nullable().optional(),
})

export const Route = createFileRoute('/api/public/contact-message')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (!supabaseUrl || !serviceKey) {
          return Response.json({ error: 'Server configuration error' }, { status: 500 })
        }

        let parsed
        try {
          parsed = PayloadSchema.parse(await request.json())
        } catch {
          return Response.json({ error: 'Invalid payload' }, { status: 400 })
        }

        const supabase = createClient(supabaseUrl, serviceKey)

        const entry = TEMPLATES[TEMPLATE_NAME]
        if (!entry) {
          return Response.json({ error: 'Template not registered' }, { status: 500 })
        }
        const recipient = entry.to
        if (!recipient) {
          return Response.json({ error: 'Template missing fixed recipient' }, { status: 500 })
        }

        const timestamp = new Date().toISOString()
        const idempotencyKey = `contact-message-${crypto.randomUUID()}`

        // Server-side screenshot upload (private bucket + signed URL)
        let screenshotUrl: string | null = null
        let screenshotName: string | null = null
        if (parsed.screenshotBase64 && parsed.screenshotType) {
          try {
            const bytes = Uint8Array.from(atob(parsed.screenshotBase64), (c) => c.charCodeAt(0))
            if (bytes.byteLength > MAX_SCREENSHOT_BYTES) {
              return Response.json({ error: 'Screenshot too large' }, { status: 400 })
            }
            const extMap: Record<string, string> = {
              'image/png': 'png',
              'image/jpeg': 'jpg',
              'image/gif': 'gif',
              'image/webp': 'webp',
            }
            const ext = extMap[parsed.screenshotType]
            const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
            const { error: upErr } = await supabase.storage
              .from(SCREENSHOT_BUCKET)
              .upload(path, bytes, { contentType: parsed.screenshotType, upsert: false })
            if (upErr) {
              console.error('Screenshot upload failed', { error: upErr })
            } else {
              const { data: signed, error: signErr } = await supabase.storage
                .from(SCREENSHOT_BUCKET)
                .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
              if (signErr) {
                console.error('Signed URL generation failed', { error: signErr })
              } else {
                screenshotUrl = signed.signedUrl
                screenshotName = parsed.screenshotName?.slice(0, 255) ?? `screenshot.${ext}`
              }
            }
          } catch (err) {
            console.error('Screenshot decode failed', { error: err })
          }
        }

        const templateData = {
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          email: parsed.email,
          subject: parsed.subject,
          message: parsed.message,
          screenshotUrl,
          screenshotName,
          timestamp,
        }
        const element = React.createElement(entry.component, templateData)
        const html = await render(element)
        const text = await render(element, { plainText: true })
        const subjectLine =
          typeof entry.subject === 'function'
            ? entry.subject(templateData)
            : entry.subject

        await supabase.from('email_send_log').insert({
          message_id: idempotencyKey,
          template_name: TEMPLATE_NAME,
          recipient_email: recipient,
          status: 'pending',
        })

        const { error: enqueueError } = await supabase.rpc('enqueue_email', {
          queue_name: 'transactional_emails',
          payload: {
            message_id: idempotencyKey,
            to: recipient,
            from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
            reply_to: parsed.email,
            sender_domain: SENDER_DOMAIN,
            subject: subjectLine,
            html,
            text,
            purpose: 'transactional',
            label: TEMPLATE_NAME,
            queued_at: timestamp,
          },
        })

        if (enqueueError) {
          console.error('Failed to enqueue contact message', { error: enqueueError })
          await supabase.from('email_send_log').insert({
            message_id: idempotencyKey,
            template_name: TEMPLATE_NAME,
            recipient_email: recipient,
            status: 'failed',
            error_message: 'Failed to enqueue email',
          })
          return Response.json({ error: 'Failed to send message' }, { status: 500 })
        }

        return Response.json({ success: true })
      },
    },
  },
})
