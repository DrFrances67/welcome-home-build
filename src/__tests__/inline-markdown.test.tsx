import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  renderInlineMarkdown,
  inlineMarkdownToHtml,
  stripInlineMarkdown,
} from "@/lib/inlineMarkdown";

describe("renderInlineMarkdown (React)", () => {
  it("renders **word** as a <strong> element with bold weight", () => {
    const { container } = render(<p>{renderInlineMarkdown("Read the **important** text.")}</p>);
    const strong = container.querySelector("strong");
    expect(strong).not.toBeNull();
    expect(strong!.textContent).toBe("important");
    // CSS fontWeight 700 (computed as inline style on the element)
    expect((strong as HTMLElement).style.fontWeight).toBe("700");
    expect(container.textContent).toBe("Read the important text.");
  });

  it("renders __word__ as <strong>", () => {
    const { container } = render(<p>{renderInlineMarkdown("This is __really__ key.")}</p>);
    expect(container.querySelector("strong")?.textContent).toBe("really");
  });

  it("renders *word* and _word_ as <em>", () => {
    const a = render(<p>{renderInlineMarkdown("Be *brave*.")}</p>);
    const b = render(<p>{renderInlineMarkdown("Be _kind_.")}</p>);
    expect(a.container.querySelector("em")?.textContent).toBe("brave");
    expect(b.container.querySelector("em")?.textContent).toBe("kind");
  });

  it("supports multiple bold spans in one string", () => {
    const { container } = render(
      <p>{renderInlineMarkdown("**One** and **two** and **three**.")}</p>,
    );
    const strongs = container.querySelectorAll("strong");
    expect(strongs).toHaveLength(3);
    expect(Array.from(strongs).map(s => s.textContent)).toEqual(["One", "two", "three"]);
  });

  it("returns plain text when no markers are present", () => {
    const { container } = render(<p>{renderInlineMarkdown("nothing fancy here")}</p>);
    expect(container.querySelector("strong")).toBeNull();
    expect(container.querySelector("em")).toBeNull();
    expect(container.textContent).toBe("nothing fancy here");
  });

  it("handles null/undefined gracefully", () => {
    const a = render(<p>{renderInlineMarkdown(undefined)}</p>);
    const b = render(<p>{renderInlineMarkdown(null)}</p>);
    expect(a.container.textContent).toBe("");
    expect(b.container.textContent).toBe("");
  });
});

describe("inlineMarkdownToHtml (HTML / print export)", () => {
  it("converts **word** to <strong>word</strong>", () => {
    expect(inlineMarkdownToHtml("Pay **attention**.")).toBe("Pay <strong>attention</strong>.");
  });

  it("converts *word* and _word_ to <em>", () => {
    expect(inlineMarkdownToHtml("*hi* and _yo_")).toBe("<em>hi</em> and <em>yo</em>");
  });

  it("escapes raw HTML before applying markdown so no XSS vector is introduced", () => {
    const out = inlineMarkdownToHtml("<script>alert(1)</script> **bold**");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
    expect(out).toContain("<strong>bold</strong>");
  });

  it("handles empty/nullish input", () => {
    expect(inlineMarkdownToHtml("")).toBe("");
    expect(inlineMarkdownToHtml(undefined)).toBe("");
    expect(inlineMarkdownToHtml(null)).toBe("");
  });
});

describe("stripInlineMarkdown", () => {
  it("removes ** and __ markers but keeps text", () => {
    expect(stripInlineMarkdown("Read the **important** __notes__."))
      .toBe("Read the important notes.");
  });
});

// ─── Integration-style checks against simulated worksheet/DOK/MC/Success render
// shapes. These mirror the JSX patterns used in TheTechSavvyTeacherApp so a
// regression in the helper would break here too.
describe("markdown bold in worksheet-style render shapes", () => {
  it("DOK question span: **bold** becomes <strong>", () => {
    const q = "Justify your answer with **two** pieces of evidence.";
    const { container } = render(
      <div>
        <span>{renderInlineMarkdown(q)}</span>
      </div>,
    );
    const strong = container.querySelector("strong");
    expect(strong?.textContent).toBe("two");
  });

  it("multiple choice question + choice both render bold", () => {
    const question = "Which word means **happy**?";
    const choices = ["sad", "**joyful**", "tired"];
    const { container } = render(
      <div>
        <p data-testid="q">{renderInlineMarkdown(question)}</p>
        <ul>
          {choices.map((c, i) => (
            <li key={i}>{renderInlineMarkdown(c)}</li>
          ))}
        </ul>
      </div>,
    );
    const strongs = container.querySelectorAll("strong");
    expect(strongs).toHaveLength(2);
    expect(strongs[0].textContent).toBe("happy");
    expect(strongs[1].textContent).toBe("joyful");
  });

  it("success criteria item renders bold", () => {
    const item = "I can identify the **main idea**.";
    const { container } = render(<span>{renderInlineMarkdown(item)}</span>);
    expect(container.querySelector("strong")?.textContent).toBe("main idea");
  });

  it("HTML print export wraps bold in <strong>", () => {
    const html = inlineMarkdownToHtml("Find the **subject** of the sentence.");
    expect(html).toContain("<strong>subject</strong>");
  });
});
