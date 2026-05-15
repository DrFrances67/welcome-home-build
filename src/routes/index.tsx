import { createFileRoute } from "@tanstack/react-router";
import { TheTechSavvyTeacherApp } from "@/components/TheTechSavvyTeacherApp";
import { AuthGate } from "@/components/AuthGate";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Tech Savvy Teacher — Tools For Educators" },
      {
        name: "description",
        content:
          "AI lesson plans, NY-standards worksheets, and polished parent emails — one classroom-ready toolkit built for K–12 teachers.",
      },
      { property: "og:title", content: "The Tech Savvy Teacher" },
      {
        property: "og:description",
        content:
          "AI lesson plans, NY-standards worksheets, and polished parent emails for K–12 teachers.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://techsavvyteacher.app/" },
    ],
    links: [
      { rel: "canonical", href: "https://techsavvyteacher.app/" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <AuthGate>
      <TheTechSavvyTeacherApp />
    </AuthGate>
  );
}
