import { createFileRoute } from "@tanstack/react-router";
import { TheTechSavvyTeacherApp } from "@/components/TheTechSavvyTeacherApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Tech Savvy Teacher — AI Tools for Educators" },
      {
        name: "description",
        content:
          "Generate differentiated lesson plans, build print-ready worksheets aligned to NY Standards, and polish professional emails — all in one AI-powered toolkit for teachers.",
      },
      { property: "og:title", content: "The Tech Savvy Teacher" },
      {
        property: "og:description",
        content:
          "AI-powered lesson plans, worksheet builder, and professional email assistant for teachers.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

function Index() {
  return <TheTechSavvyTeacherApp />;
}
