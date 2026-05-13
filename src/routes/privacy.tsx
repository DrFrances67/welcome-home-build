import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Statement — The Tech Savvy Teacher" },
      {
        name: "description",
        content:
          "Privacy statement for The Tech Savvy Teacher Ecosystem — Lesson Plan Generator, Danielson Review, Worksheet Builder, and Professional Communication Support.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const lastUpdated = "May 13, 2026";

  return (
    <main
      style={{
        maxWidth: 820,
        margin: "0 auto",
        padding: "48px 24px 96px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: "hsl(var(--foreground))",
        lineHeight: 1.65,
      }}
    >
      <Link
        to="/"
        style={{
          fontSize: 14,
          color: "hsl(var(--muted-foreground))",
          textDecoration: "none",
        }}
      >
        ← Back to home
      </Link>

      <h1 style={{ fontSize: 36, fontWeight: 700, marginTop: 16, marginBottom: 8 }}>
        Privacy Statement
      </h1>
      <p style={{ color: "hsl(var(--muted-foreground))", marginBottom: 32 }}>
        Last updated: {lastUpdated}
      </p>

      <section style={{ marginBottom: 28 }}>
        <p>
          The Tech Savvy Teacher Ecosystem ("we," "our," or "the platform") is a
          comprehensive platform designed to meet the diverse needs of educators
          through distinct, user-friendly programs: the{" "}
          <strong>Lesson Plan Generator</strong>, <strong>Danielson Review</strong>,{" "}
          <strong>Worksheet Builder</strong>, and{" "}
          <strong>Professional Communication Support</strong>. This Privacy
          Statement explains what information we collect, how we use it, and the
          choices you have.
        </p>
      </section>

      <h2 style={h2}>1. Information We Collect</h2>
      <p>
        We collect only the information necessary to provide and improve our
        services:
      </p>
      <ul style={ul}>
        <li>
          <strong>Content you submit.</strong> Lesson plans, worksheet prompts,
          uploaded documents (PDF, Word, plain text), and email or communication
          drafts you provide to any of the four tools.
        </li>
        <li>
          <strong>Account information</strong> (if you sign in): your email
          address and basic profile details.
        </li>
        <li>
          <strong>Usage and analytics data:</strong> pages visited, features
          used, device type, approximate location (country), and referral
          source. This is aggregated and does not identify you personally.
        </li>
      </ul>

      <h2 style={h2}>2. How We Use Your Information</h2>
      <ul style={ul}>
        <li>To generate lesson plans, worksheets, reviews, and communications you request.</li>
        <li>To improve the quality, reliability, and accuracy of the platform.</li>
        <li>To maintain security and prevent abuse.</li>
        <li>To respond to support inquiries.</li>
      </ul>

      <h2 style={h2}>3. AI Processing</h2>
      <p>
        Content you submit is sent to trusted third-party AI model providers
        (such as Google and OpenAI) solely to generate the output you request.
        We do not use your submissions to train AI models, and these providers
        process the data under their respective enterprise terms.
      </p>

      <h2 style={h2}>4. Student & Classroom Content</h2>
      <p>
        Please do not submit personally identifiable information about students
        (names, IDs, contact info, grades tied to individuals). The platform is
        designed for instructional planning and educator workflows, not for
        storing student records. You are responsible for complying with FERPA,
        COPPA, and your district's data-handling policies.
      </p>

      <h2 style={h2}>5. Data Sharing</h2>
      <p>
        We do not sell your information. We share data only with:
      </p>
      <ul style={ul}>
        <li>Infrastructure and AI providers required to operate the platform.</li>
        <li>Authorities when required by law.</li>
      </ul>

      <h2 style={h2}>6. Data Retention</h2>
      <p>
        Generated content and uploads are retained only as long as needed to
        deliver the requested service or as associated with your account. You
        may request deletion of your account and associated data at any time.
      </p>

      <h2 style={h2}>7. Security</h2>
      <p>
        We use industry-standard safeguards including encryption in transit,
        access controls, and secure cloud infrastructure. No system is perfectly
        secure, but we work to protect your information.
      </p>

      <h2 style={h2}>8. Your Rights</h2>
      <p>
        You may request access to, correction of, or deletion of your personal
        information by contacting us. Depending on your location, you may have
        additional rights under GDPR, CCPA, or similar laws.
      </p>

      <h2 style={h2}>9. Children's Privacy</h2>
      <p>
        The platform is intended for use by educators (adults). It is not
        directed to children under 13, and we do not knowingly collect personal
        information from children.
      </p>

      <h2 style={h2}>10. Changes to This Statement</h2>
      <p>
        We may update this Privacy Statement from time to time. Material changes
        will be reflected by updating the "Last updated" date above.
      </p>

      <h2 style={h2}>11. Contact</h2>
      <p>
        Questions about this Privacy Statement? Reach us through the contact
        options on{" "}
        <a
          href="https://techsavvyteacher.app"
          style={{ color: "hsl(var(--primary))" }}
        >
          techsavvyteacher.app
        </a>
        .
      </p>
    </main>
  );
}

const h2: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 600,
  marginTop: 32,
  marginBottom: 8,
};

const ul: React.CSSProperties = {
  paddingLeft: 22,
  marginBottom: 12,
};
