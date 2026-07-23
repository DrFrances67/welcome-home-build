import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listLessonPlans from "./tools/list-lesson-plans";
import getLessonPlan from "./tools/get-lesson-plan";
import listLessonPlanVersions from "./tools/list-lesson-plan-versions";
import whoami from "./tools/whoami";

// The OAuth issuer must be the direct Supabase host, not the .lovable.cloud
// proxy that mcp-js would reject. VITE_SUPABASE_PROJECT_ID is inlined by Vite
// at build time. The sentinel fallback keeps the URL well-formed during the
// build-time manifest extract; a real token never verifies against it.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "tech-savvy-teacher-mcp",
  title: "The Tech Savvy Teacher",
  version: "0.1.0",
  instructions:
    "Tools for The Tech Savvy Teacher. Each call acts as the signed-in teacher. Use whoami to confirm identity, list_lesson_plans to see saved plans and drafts, get_lesson_plan to read a plan's full form + result, and list_lesson_plan_versions to browse edit history.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoami, listLessonPlans, getLessonPlan, listLessonPlanVersions],
});
