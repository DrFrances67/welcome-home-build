import { describe, expect, it } from "vitest";
import { buildWorksheetPrintHtml } from "@/components/worksheet-print-preview";
import fs from "node:fs";

describe("saved worksheet print preview", () => {
  it("renders every page with headers, margins, and escaped teacher text", () => {
    const html = buildWorksheetPrintHtml({
      title: "Fractions <script>",
      showName: true,
      showDate: true,
      showGrade: true,
      gradeId: "4",
      pageCount: 2,
      pageHeadersHidden: [],
      elements: [{ id: "one", type: "shortAnswer", page: 1, question: "Explain 1/2", lines: 2 }],
    });
    expect(html.match(/class="page"/g)).toHaveLength(2);
    expect(html).toContain("@page{size:letter portrait;margin:.4in}");
    expect(html).toContain("Fractions &lt;script&gt;");
    expect(html).not.toContain("Fractions <script>");
    expect(html).toContain("Explain 1/2");
  });

  it("keeps mobile lesson-plan reopen and restore controls touch friendly", () => {
    const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
    const route = fs.readFileSync(new URL("../routes/lesson-plans.tsx", import.meta.url), "utf8");
    expect(route).toContain('className="saved-plan-primary"');
    expect(route).toContain('className="saved-plan-restore"');
    expect(route).toContain("`${LP_PLAN_ID_KEY}:${user.id}`");
    expect(css).toMatch(/\.saved-plan-actions button \{[^}]*min-height: 44px/);
    expect(css).toMatch(
      /\.saved-plan-restore select, \.saved-plan-restore button \{[^}]*min-height: 44px/,
    );
  });

  it("rejects malformed saved worksheet data", () => {
    expect(() => buildWorksheetPrintHtml({ pageCount: 1000 })).toThrow(/cannot be previewed/i);
  });
});
