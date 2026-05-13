import { createFileRoute } from "@tanstack/react-router";
import { AdminDashboard } from "@/components/AdminDashboard";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — The Tech Savvy Teacher" }] }),
  component: AdminDashboard,
});
