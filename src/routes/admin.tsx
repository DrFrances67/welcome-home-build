import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboard } from "@/components/AdminDashboard";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — The Tech Savvy Teacher" },
      { name: "description", content: "Internal admin dashboard for The Tech Savvy Teacher: review users, monitor activity, and manage account operations." },
      { property: "og:title", content: "Admin Dashboard — The Tech Savvy Teacher" },
      { property: "og:description", content: "Internal admin dashboard for The Tech Savvy Teacher staff." },
      { property: "og:url", content: "https://techsavvyteacher.app/admin" },
      { property: "og:type", content: "website" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://techsavvyteacher.app/admin" }],
  }),
  component: AdminDashboard,
});
