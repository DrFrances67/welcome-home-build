/**
 * Integration tests for the PDF/DOCX import paths.
 *
 * These load real sample files from `fixtures/`, run them through the same
 * pdfjs-dist / mammoth helpers the app uses, and assert the extracted text and
 * document metadata match snapshots. An upstream API change (or a regression in
 * our narrow interfaces) breaks these tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractPdfPlainText,
  extractDocxText,
  openPdf,
  pdfTextFromContent,
  loadMammoth,
  loadPdfjs,
} from "@/lib/document-extract";

const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures");

function fixtureFile(name: string, type: string): File {
  const bytes = readFileSync(resolve(FIXTURES, name));
  return new File([new Uint8Array(bytes)], name, { type });
}

const pdfFile = () => fixtureFile("sample-worksheet.pdf", "application/pdf");
const docxFile = () =>
  fixtureFile(
    "sample-lesson-plan.docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );

describe("PDF import path (pdfjs-dist)", () => {
  it("loads pdfjs with the expected surface", async () => {
    const pdfjs = await loadPdfjs();
    expect(typeof pdfjs.getDocument).toBe("function");
  });

  it("reports document metadata (page count) for a sample PDF", async () => {
    const doc = await openPdf(pdfFile());
    expect(doc.numPages).toBe(2);
  });

  it("extracts text matching the expected snapshot", async () => {
    const text = await extractPdfPlainText(pdfFile(), 15);
    expect(text).toMatchInlineSnapshot(`
      "Fractions Practice Name: ____________ 1. What is one half of eight?

      2. Explain your reasoning."
    `);
  });

  it("honours the page cap", async () => {
    const onePage = await extractPdfPlainText(pdfFile(), 1);
    expect(onePage).toContain("Fractions Practice");
    expect(onePage).not.toContain("Explain your reasoning");
  });

  it("supports per-page separators used by the worksheet importer", async () => {
    const text = await extractPdfPlainText(pdfFile(), 8, (p) => `\n\n--- PAGE ${p} ---\n`);
    expect(text).toContain("--- PAGE 1 ---");
    expect(text).toContain("--- PAGE 2 ---");
  });

  it("exposes page text items with the shape our interfaces declare", async () => {
    const doc = await openPdf(pdfFile());
    const page = await doc.getPage(1);
    const content = await page.getTextContent();
    expect(Array.isArray(content.items)).toBe(true);
    expect(content.items.every((it) => typeof it.str === "string")).toBe(true);
    expect(pdfTextFromContent(content)).toContain("Fractions Practice");
    const viewport = page.getViewport({ scale: 1 });
    expect(Math.round(viewport.width)).toBe(612);
    expect(Math.round(viewport.height)).toBe(792);
  });

  it("tolerates malformed text content", () => {
    expect(pdfTextFromContent(null)).toBe("");
    expect(pdfTextFromContent({ items: [{ str: "a" }, {}, { str: "b" }] })).toBe("a  b");
  });
});

describe("DOCX import path (mammoth)", () => {
  it("loads mammoth with the expected surface", async () => {
    const mammoth = await loadMammoth();
    expect(typeof mammoth.extractRawText).toBe("function");
  });

  it("extracts text matching the expected snapshot", async () => {
    const text = await extractDocxText(docxFile());
    expect(text).toMatchInlineSnapshot(`
      "Lesson Plan: Photosynthesis

      Objective: Students will explain how plants make food.

      Materials: leaves, microscope, worksheet"
    `);
  });

  it("keeps paragraph structure line by line", async () => {
    const lines = (await extractDocxText(docxFile())).split(/\n+/);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("Lesson Plan: Photosynthesis");
  });

  it("rejects a non-DOCX payload instead of returning garbage", async () => {
    const bogus = new File([new Uint8Array([1, 2, 3, 4])], "bad.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    await expect(extractDocxText(bogus)).rejects.toBeTruthy();
  });
});
