import { describe, expect, it } from "vitest";
import { buildWorksheetPrintHtml } from "@/components/worksheet-print-preview";

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

  it("rejects malformed saved worksheet data", () => {
    expect(() => buildWorksheetPrintHtml({ pageCount: 1000 })).toThrow(/cannot be previewed/i);
  });
});