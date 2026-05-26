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

const PayloadSchema = z.object({
  firstName: z.string().trim().max(100).optional().default(''),
  lastName: z.string().trim().max(100).optional().default(''),
  email: z.string().trim().email().max(320),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
  hasScreenshot: z.boolean().optional().default(false),
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

        const templateData = {
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          email: parsed.email,
          subject: parsed.subject,
          message: parsed.message,
          hasScreenshot: parsed.hasScreenshot,
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
