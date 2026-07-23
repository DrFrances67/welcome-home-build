import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabaseForUser";

export default defineTool({
  name: "list_lesson_plan_versions",
  title: "List lesson plan versions",
  description:
    "List every saved draft/version snapshot for a lesson plan, newest first. Use to browse edit history.",
  inputSchema: {
    plan_id: z.string().uuid().describe("Lesson plan id from list_lesson_plans."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ plan_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("lesson_plan_versions")
      .select("id, version_no, label, created_at")
      .eq("lesson_plan_id", plan_id)
      .order("version_no", { ascending: false });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const rows = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { count: rows.length, versions: rows },
    };
  },
});
