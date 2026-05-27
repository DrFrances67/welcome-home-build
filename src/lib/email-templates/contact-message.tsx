import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'Tech Savvy Teacher'


interface ContactMessageProps {
  firstName?: string
  lastName?: string
  email?: string
  subject?: string
  message?: string
  screenshotUrl?: string | null
  screenshotName?: string | null
  timestamp?: string
}

const ContactMessageEmail = ({
  firstName,
  lastName,
  email,
  subject,
  message,
  screenshotUrl,
  screenshotName,
  timestamp,
}: ContactMessageProps) => {
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Anonymous'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>New contact form message from {fullName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>📬 New Contact Form Message</Heading>
          <Text style={text}>
            Someone reached out via the {SITE_NAME} contact form.
          </Text>
          <Section style={infoBox}>
            <Text style={infoRow}>
              <span style={label}>From:</span> {fullName}
            </Text>
            <Text style={infoRow}>
              <span style={label}>Email:</span> {email || '—'}
            </Text>
            <Text style={infoRow}>
              <span style={label}>Subject:</span> {subject || '—'}
            </Text>
            <Text style={infoRow}>
              <span style={label}>Submitted:</span> {timestamp || '—'}
            </Text>
          </Section>
          <Hr style={hr} />
          <Text style={messageLabel}>Message</Text>
          <Text style={messageText}>{message || '(no message)'}</Text>
          {screenshotUrl ? (
            <>
              <Hr style={hr} />
              <Text style={messageLabel}>Screenshot</Text>
              <Img
                src={screenshotUrl}
                alt={screenshotName || 'Screenshot'}
                style={screenshotImg}
              />
              <Text style={text}>
                <Link href={screenshotUrl} style={linkStyle}>
                  Download {screenshotName || 'screenshot'}
                </Link>
              </Text>
            </>
          ) : null}
          <Hr style={hr} />
          <Text style={footer}>{SITE_NAME} contact form</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ContactMessageEmail,
  subject: (data: Record<string, any>) =>
    `📬 Contact form: ${data?.subject || 'New message'}`,
  displayName: 'Contact form message',
  to: 'Edtechsavvyteach@gmail.com',
  previewData: {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
    subject: 'Feature Request',
    message: 'It would be great if you could add a dark mode toggle.',
    screenshotUrl: null,
    screenshotName: null,
    timestamp: new Date().toISOString(),
  },
} satisfies TemplateEntry

export default ContactMessageEmail

const screenshotImg: React.CSSProperties = {
  maxWidth: '100%',
  height: 'auto',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  margin: '8px 0 12px',
}
const linkStyle: React.CSSProperties = {
  color: '#CF27F5',
  textDecoration: 'underline',
}


const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: 'Arial, sans-serif',
}
const container: React.CSSProperties = { padding: '24px', maxWidth: '560px' }
const h1: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 'bold',
  color: '#1a1a1a',
  margin: '0 0 16px',
}
const text: React.CSSProperties = {
  fontSize: '14px',
  color: '#374151',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const infoBox: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '16px 0',
}
const infoRow: React.CSSProperties = {
  fontSize: '14px',
  color: '#1f2937',
  margin: '4px 0',
}
const label: React.CSSProperties = { fontWeight: 600, color: '#6b7280' }
const messageLabel: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#6b7280',
  margin: '8px 0 6px',
}
const messageText: React.CSSProperties = {
  fontSize: '14px',
  color: '#1f2937',
  lineHeight: '1.6',
  whiteSpace: 'pre-wrap',
  margin: '0 0 16px',
}
const hr: React.CSSProperties = {
  borderColor: '#e5e7eb',
  margin: '20px 0',
}
const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#9ca3af',
  margin: '24px 0 0',
}
