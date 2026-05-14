import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/AuthPage";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ mode: (s.mode as string) ?? "signin" }),
  head: () => ({
    meta: [
      { title: "Sign In or Create Account — The Tech Savvy Teacher" },
      { name: "description", content: "Sign in or create a free Tech Savvy Teacher account to access AI lesson plans, worksheets, and parent email tools." },
      { property: "og:title", content: "Sign In — The Tech Savvy Teacher" },
      { property: "og:description", content: "Log in or create a free account to use The Tech Savvy Teacher's AI classroom tools." },
      { property: "og:url", content: "https://techsavvyteacher.app/auth" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://techsavvyteacher.app/auth" }],
  }),
  component: () => <AuthPage />,
});
