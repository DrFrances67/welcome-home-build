import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Statement — The Tech Savvy Teacher" },
      { name: "description", content: "How The Tech Savvy Teacher collects, uses, and protects your data." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px", color: "#0f172a", lineHeight: 1.65 }}>
      <Link to="/" style={{ color: "#4f46e5", fontSize: 14 }}>← Back to app</Link>
      <h1 style={{ fontSize: 32, fontWeight: 800, margin: "12px 0 8px" }}>Privacy Statement</h1>
      <p style={{ color: "#64748b", marginBottom: 24 }}>Last updated: {new Date().toLocaleDateString()}</p>

      <p>
        The Tech Savvy Teacher Ecosystem (&ldquo;the Service&rdquo;) is a comprehensive platform designed to meet the
        diverse needs of educators through four user-friendly programs: the Lesson Plan Generator, Danielson Review,
        Worksheet Builder, and Professional Communication Support. This statement explains what information we collect,
        why we collect it, and how it is used.
      </p>

      <h2 style={h2}>1. Information we collect</h2>
      <p>When you create an account, we collect:</p>
      <ul style={ul}>
        <li>Your <strong>full name</strong>, <strong>email address</strong>, <strong>username</strong>, and an <strong>account creation timestamp</strong>.</li>
        <li>A securely hashed copy of your <strong>password</strong> (we never store passwords in plain text).</li>
      </ul>
      <p>While you use the Service, we automatically record:</p>
      <ul style={ul}>
        <li>The <strong>start and end time</strong> of each sign-in session.</li>
        <li>Which <strong>features you access</strong> (Lesson Plan Generator, Danielson Review, Worksheet Builder, Professional Communication Support).</li>
        <li>The <strong>actions you take</strong> within those features and the <strong>time spent</strong> on each.</li>
        <li>Basic technical information such as your browser user-agent.</li>
      </ul>
      <p>
        Content you submit to the AI tools (lesson plans, worksheet inputs, drafts of professional communications) is
        processed solely to generate the requested output and is not used for advertising.
      </p>

      <h2 style={h2}>2. How we use your information</h2>
      <ul style={ul}>
        <li>To authenticate you and keep your account secure.</li>
        <li>To deliver the requested features and personalize your experience.</li>
        <li>To monitor service usage, diagnose problems, and improve the platform.</li>
        <li>To communicate essential account messages (verification, password reset).</li>
      </ul>

      <h2 style={h2}>3. Who can see your data</h2>
      <p>
        Your account profile, session history, and feature-usage logs are visible to the <strong>site owner</strong> via
        a private admin dashboard for the purposes of operating, supporting, and improving the Service. Other users
        cannot see your data.
      </p>

      <h2 style={h2}>4. How your data is protected</h2>
      <ul style={ul}>
        <li>All traffic is served over <strong>HTTPS</strong>.</li>
        <li>Passwords are stored as one-way hashes; we cannot recover them.</li>
        <li>Sign-in sessions use secure tokens with automatic expiration.</li>
        <li>Database access is governed by row-level security so that users can only read their own records.</li>
      </ul>

      <h2 style={h2}>2-step verification & resets</h2>
      <p>
        You can reset your password at any time from the sign-in screen, and you can sign out from the menu in the
        top-right corner.
      </p>

      <h2 style={h2}>5. Data retention and your rights</h2>
      <p>
        Your account data is retained for as long as your account is active. You may request export or deletion of your
        data, or close your account, by contacting the site owner. Closing your account removes your profile, sessions,
        and feature-usage records.
      </p>

      <h2 style={h2}>6. Children&rsquo;s privacy</h2>
      <p>
        The Service is intended for use by educators. It is not directed to children under 13, and we do not knowingly
        collect personal information from children.
      </p>

      <h2 style={h2}>7. Changes to this statement</h2>
      <p>
        We may update this statement from time to time. Material changes will be communicated through the Service or by
        email.
      </p>

      <h2 style={h2}>8. Contact</h2>
      <p>
        Questions about this privacy statement or your data can be directed to the site owner at{" "}
        <a href="mailto:edtechsavvyteach@gmail.com" style={{ color: "#4f46e5" }}>edtechsavvyteach@gmail.com</a>.
      </p>
    </div>
  );
}

const h2: React.CSSProperties = { fontSize: 20, fontWeight: 700, marginTop: 28, marginBottom: 8 };
const ul: React.CSSProperties = { paddingLeft: 22, margin: "8px 0 16px" };
