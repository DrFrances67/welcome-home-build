import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Statement — The Tech Savvy Teacher" },
      {
        name: "description",
        content: "How The Tech Savvy Teacher collects, uses, and protects your data.",
      },
      { property: "og:title", content: "Privacy Statement — The Tech Savvy Teacher" },
      {
        property: "og:description",
        content: "How The Tech Savvy Teacher collects, uses, and protects your data.",
      },
      { property: "og:url", content: "https://techsavvyteacher.app/privacy" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://techsavvyteacher.app/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "48px 24px 80px",
        color: "#0f172a",
        lineHeight: 1.65,
      }}
    >
      <Link to="/" style={{ color: "#4f46e5", fontSize: 14 }}>
        ← Back to app
      </Link>
      <h1 style={{ fontSize: 32, fontWeight: 800, margin: "12px 0 8px" }}>Privacy Statement</h1>
      <p style={{ color: "#64748b", marginBottom: 24 }}>Last updated: 5/12/2026</p>

      <p>
        The Tech Savvy Teacher Ecosystem (&ldquo;the Service&rdquo;) is a comprehensive platform
        designed for educators through four user-friendly, distinct programs:
      </p>
      <ul style={ul}>
        <li>
          <strong>Lesson Plan Generator</strong> &mdash; AI-assisted creation of standards-aligned
          lesson plans
        </li>
        <li>
          <strong>Danielson Review</strong> &mdash; Support tools for educator reflection and
          evaluation aligned to the Danielson Framework
        </li>
        <li>
          <strong>Worksheet Builder</strong> &mdash; Dynamic creation of student-facing
          instructional materials
        </li>
        <li>
          <strong>Professional Communication Support</strong> &mdash; AI-powered drafting of
          professional educator communications
        </li>
      </ul>
      <p>
        This Privacy Statement explains how we collect, use, protect, and handle information when
        you use our platform and its programs. By using any of these programs, you agree to the
        practices described in this Privacy Statement.
      </p>

      <h2 style={h2}>1. Information we collect</h2>
      <p>When you create an account, we collect:</p>
      <ul style={ul}>
        <li>
          Your <strong>full name</strong>, <strong>email address</strong>, <strong>username</strong>
          , and an <strong>account creation timestamp</strong>.
        </li>
        <li>
          A securely hashed copy of your <strong>password</strong> (we never store passwords in
          plain text).
        </li>
      </ul>
      <p>While you use the Service, we automatically record:</p>
      <ul style={ul}>
        <li>
          The <strong>start and end time</strong> of each sign-in session.
        </li>
        <li>
          Which <strong>features you access</strong> (Lesson Plan Generator, Danielson Review,
          Worksheet Builder, Professional Communication Support).
        </li>
        <li>
          The <strong>actions you take</strong> within those features and the{" "}
          <strong>time spent</strong> on each.
        </li>
        <li>Basic technical information such as your browser user-agent.</li>
      </ul>
      <p>
        Content you submit to the AI tools (lesson plans, worksheet inputs, drafts of professional
        communications) is processed solely to generate the requested output and is not used for
        advertising.
      </p>

      <h2 style={h2}>2. How we use your information</h2>
      <ul style={ul}>
        <li>To authenticate you and keep your account secure.</li>
        <li>To deliver the requested features and personalize your experience.</li>
        <li>To monitor service usage, diagnose problems, and improve the platform.</li>
        <li>To communicate essential account messages (verification, password reset).</li>
        <li>
          Generate AI-powered responses, lesson plans, worksheets, and professional communications
          on your behalf.
        </li>
        <li>Respond to user inquiries and provide technical support.</li>
      </ul>
      <p>
        We do not sell, rent, or share your personal information with third parties for advertising
        or marketing purposes.
      </p>

      <h2 style={h2}>3. Who can see your data</h2>
      <p>
        Your account profile, session history, and feature-usage logs are visible to the{" "}
        <strong>site owner</strong> via a private admin dashboard for the purposes of operating,
        supporting, and improving the Service. Other users cannot see your data.
      </p>

      <h2 style={h2}>4. How your data is protected</h2>
      <ul style={ul}>
        <li>
          All traffic is served over <strong>HTTPS</strong>.
        </li>
        <li>Passwords are stored as one-way hashes; we cannot recover them.</li>
        <li>Sign-in sessions use secure tokens with automatic expiration.</li>
        <li>
          Database access is governed by row-level security so that users can only read their own
          records.
        </li>
      </ul>

      <h2 style={h2}>2-step verification &amp; resets</h2>
      <p>
        You can reset your password at any time from the sign-in screen, and you can sign out from
        the menu in the top-right corner.
      </p>

      <h2 style={h2}>5. Data retention and your rights</h2>
      <p>
        Your account data is retained for as long as your account is active. We are committed to
        minimizing data storage. Unless you have created an account or explicitly saved content
        within the Platform, input data and AI-generated outputs are not retained beyond your active
        session. Once your session ends, your content is not stored on our servers. If account-based
        features are offered, saved data is retained only for as long as necessary to provide the
        service and is deleted upon account closure upon request.
      </p>

      <h2 style={h2}>6. Student Data &amp; FERPA Compliance</h2>
      <p>
        The Tech Savvy Teacher Ecosystem is designed exclusively for use by educators and school
        professionals. It is not intended for direct use by students. To protect student privacy and
        comply with the Family Educational Rights and Privacy Act (FERPA):
      </p>
      <ul style={ul}>
        <li>
          Do not enter personally identifiable student information (such as student names, ID
          numbers, grades, or behavioral records) into any program on this Platform.
        </li>
        <li>
          The Platform is not a student record system and should not be used to store or transmit
          student educational records.
        </li>
      </ul>
      <p>
        Educators are responsible for ensuring that any content entered into the Platform complies
        with their school&rsquo;s, district&rsquo;s, or state&rsquo;s FERPA obligations and data
        privacy policies. The Service is intended for use by educators. It is not directed to
        children under 17, and we do not knowingly collect personal information from children.
      </p>

      <h2 style={h2}>7. Updates to This Privacy Statement</h2>
      <p>
        We may update this Privacy Statement periodically to reflect changes in our practices,
        technology, or legal requirements. When updates are made, the Effective Date at the top of
        this document will be revised.
      </p>
      <p>
        We encourage users to review this statement regularly. Continued use of the Platform
        following any updates constitutes acceptance of the revised Privacy Statement.
      </p>

      <h2 style={h2}>8. Contact Information</h2>
      <p>
        Questions about this privacy statement or your data can be directed to the site owner at{" "}
        <a href="mailto:edtechsavvyteach@gmail.com" style={{ color: "#4f46e5" }}>
          edtechsavvyteach@gmail.com
        </a>
        .
      </p>
      <p style={{ marginTop: 24 }}>
        Thank you for trusting the Tech Savvy Teacher Ecosystem to support your professional
        practice.
      </p>
    </div>
  );
}

const h2: React.CSSProperties = { fontSize: 20, fontWeight: 700, marginTop: 28, marginBottom: 8 };
const ul: React.CSSProperties = { paddingLeft: 22, margin: "8px 0 16px" };
