import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabaseForUser";

export default defineTool({
  name: "get_lesson_plan",
  title: "Get lesson plan",
  description:
    "Fetch a single saved lesson plan by id, including its current version's form inputs and generated result.",
  inputSchema: {
    id: z.string().uuid().describe("Lesson plan id from list_lesson_plans."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data: plan, error } = await supabase
      .from("lesson_plans")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!plan) return { content: [{ type: "text", text: "Lesson plan not found" }], isError: true };

    let current: unknown = null;
    if (plan.current_version_id) {
      const { data: ver } = await supabase
        .from("lesson_plan_versions")
        .select("*")
        .eq("id", plan.current_version_id)
        .maybeSingle();
      current = ver ?? null;
    }
    const payload = { ...plan, current };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
