/* eslint-disable react-refresh/only-export-components */
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

const SITE_NAME = "Tech Savvy Teacher";

interface AdminNewSignupProps {
  username?: string;
  name?: string;
  email?: string;
  timestamp?: string;
}

const AdminNewSignupEmail = ({ username, name, email, timestamp }: AdminNewSignupProps) => {
  const displayUsername = username || "new user";
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>New teacher signed up: {displayUsername}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>🎓 New Teacher Signed Up</Heading>
          <Text style={text}>A new educator has joined {SITE_NAME}!</Text>
          <Section style={infoBox}>
            <Text style={infoRow}>
              <span style={label}>Name:</span> {name || "—"}
            </Text>
            <Text style={infoRow}>
              <span style={label}>Username:</span> {username || "—"}
            </Text>
            <Text style={infoRow}>
              <span style={label}>Email:</span> {email || "—"}
            </Text>
            <Text style={infoRow}>
              <span style={label}>Joined:</span> {timestamp || "—"}
            </Text>
          </Section>
          <Hr style={hr} />
          <Text style={text}>
            <Link href="https://techsavvyteacher.app/admin" style={link}>
              Log in to review →
            </Link>
          </Text>
          <Text style={footer}>{SITE_NAME} admin notification</Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: AdminNewSignupEmail,
  subject: (data: Record<string, unknown>) =>
    `🎓 New Teacher Signed Up — ${(data?.username as string) || "new user"}`,
  displayName: "Admin: new signup notification",
  to: "admin@techsavvyteacher.app",
  previewData: {
    username: "janedoe",
    name: "Jane Doe",
    email: "jane@example.com",
    timestamp: new Date().toISOString(),
  },
} satisfies TemplateEntry;

export default AdminNewSignupEmail;

const main: React.CSSProperties = {
  backgroundColor: "#ffffff",
  fontFamily: "Arial, sans-serif",
};
const container: React.CSSProperties = { padding: "24px", maxWidth: "560px" };
const h1: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: "bold",
  color: "#1a1a1a",
  margin: "0 0 16px",
};
const text: React.CSSProperties = {
  fontSize: "14px",
  color: "#374151",
  lineHeight: "1.6",
  margin: "0 0 16px",
};
const infoBox: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  padding: "16px 20px",
  margin: "16px 0",
};
const infoRow: React.CSSProperties = {
  fontSize: "14px",
  color: "#1f2937",
  margin: "4px 0",
};
const label: React.CSSProperties = { fontWeight: 600, color: "#6b7280" };
const hr: React.CSSProperties = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
};
const link: React.CSSProperties = {
  color: "#CF27F5",
  fontWeight: 600,
  textDecoration: "none",
};
const footer: React.CSSProperties = {
  fontSize: "12px",
  color: "#9ca3af",
  margin: "24px 0 0",
};
