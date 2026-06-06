import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TheTechSavvyTeacherApp } from "@/components/TheTechSavvyTeacherApp";
import fs from "node:fs";
import path from "node:path";

describe("Branding: no 'AI Tools for Educators' anywhere", () => {
  it("route metadata title does not contain 'AI Tools for Educators'", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/routes/index.tsx"), "utf8");
    expect(src).toMatch(/Tools For Educators/i);
    expect(src).not.toMatch(/AI Tools for Educators/i);
  });

  it("rendered app header shows 'TOOLS FOR EDUCATORS' tagline (no 'AI')", () => {
    const { container } = render(<TheTechSavvyTeacherApp />);
    const brand = container.querySelector(".site-brand");
    expect(brand).not.toBeNull();
    const text = brand!.textContent || "";
    // CSS uppercases the tagline; raw text is "Tools for Educators" or
    // "TOOLS FOR EDUCATORS". Either way, "AI" must not appear.
    expect(/tools\s+for\s+new\s+york\s+educators/i.test(text)).toBe(true);
    expect(/ai\s+tools\s+for\s+educators/i.test(text)).toBe(false);
  });

  it("no source file under src/ contains 'AI Tools for Educators'", () => {
    function walk(dir: string, hits: string[] = []): string[] {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
          walk(full, hits);
        } else if (/\.(tsx?|jsx?|css|html|md)$/.test(entry.name)) {
          if (full.endsWith("header-no-ai-branding.test.tsx")) continue;
          const content = fs.readFileSync(full, "utf8");
          if (/AI\s+Tools\s+for\s+Educators/i.test(content)) hits.push(full);
        }
      }
      return hits;
    }
    const offenders = walk(path.join(process.cwd(), "src"));
    expect(offenders).toEqual([]);
  });
});
