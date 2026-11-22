import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AdminDashboard } from "@/components/AdminDashboard";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — The Tech Savvy Teacher" },
      {
        name: "description",
        content:
          "Internal admin dashboard for The Tech Savvy Teacher: review users, monitor activity, and manage account operations.",
      },
      { property: "og:title", content: "Admin Dashboard — The Tech Savvy Teacher" },
      {
        property: "og:description",
        content: "Internal admin dashboard for The Tech Savvy Teacher staff.",
      },
      { property: "og:url", content: "https://techsavvyteacher.app/admin" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: "https://techsavvyteacher.app/admin" }],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <>
      {pathname.replace(/\/$/, "") === "/admin" && <AdminDashboard />}
      <Outlet />
    </>
  );
}
