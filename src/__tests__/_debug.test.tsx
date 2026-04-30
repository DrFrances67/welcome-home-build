import { describe, it } from "vitest";
import { render } from "@testing-library/react";
import { WorksheetBuilder } from "@/components/TheTechSavvyTeacherApp";

describe("debug", () => {
  it("count", () => {
    render(<WorksheetBuilder />);
    const els = document.querySelectorAll(".ws-element");
    console.log("INITIAL ws-element count:", els.length);
    els.forEach((e, i) => console.log(i, (e as HTMLElement).getAttribute("aria-label")));
  });
});
