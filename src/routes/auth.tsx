import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/AuthPage";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ mode: (s.mode as string) ?? "signin" }),
  head: () => ({ meta: [{ title: "Sign in — The Tech Savvy Teacher" }] }),
  component: () => <AuthPage />,
});
