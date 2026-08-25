// Narrow structural interfaces for the few pdfjs-dist / mammoth APIs we use.
// Keeping them minimal (and explicit) means an upstream API change surfaces as
// a type error here instead of an `any` silently flowing through the app.

export interface PdfTextItem {
  str?: string;
}

export interface PdfTextContent {
  items: PdfTextItem[];
}

export interface PdfViewport {
  width: number;
  height: number;
}

export interface PdfRenderTask {
  promise: Promise<void>;
}

export interface PdfPageProxy {
  getTextContent(): Promise<PdfTextContent>;
  getViewport(params: { scale: number }): PdfViewport;
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfViewport;
  }): PdfRenderTask;
}

export interface PdfDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageProxy>;
}

export interface PdfJsModule {
  GlobalWorkerOptions?: { workerSrc: string };
  getDocument(params: { data: ArrayBuffer }): { promise: Promise<PdfDocumentProxy> };
}

export interface MammothModule {
  extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value?: string }>;
}

/** Lazily import pdfjs-dist and point it at its bundled worker. */
export async function loadPdfjs(): Promise<PdfJsModule> {
  const mod = (await import("pdfjs-dist")) as unknown as
    | PdfJsModule
    | { default?: PdfJsModule };
  const pdfjs = ("default" in mod && mod.default ? mod.default : mod) as PdfJsModule;
  const workerMod = (await import("pdfjs-dist/build/pdf.worker.mjs?url")) as unknown as {
    default?: string;
  };
  const workerUrl = workerMod?.default ?? (workerMod as unknown as string);
  if (typeof pdfjs.getDocument !== "function") {
    throw new Error("PDF reader failed to load. Please try a .txt or .docx file.");
  }
  if (pdfjs.GlobalWorkerOptions && typeof workerUrl === "string") {
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  }
  return pdfjs;
}

export function pdfTextFromContent(content: PdfTextContent | null | undefined): string {
  const items = Array.isArray(content?.items) ? content.items : [];
  return items.map((it) => (it && typeof it.str === "string" ? it.str : "")).join(" ");
}

/** Open a PDF file and return the pdfjs document proxy. */
export async function openPdf(file: File): Promise<PdfDocumentProxy> {
  const pdfjs = await loadPdfjs();
  const buf = await file.arrayBuffer();
  return await pdfjs.getDocument({ data: buf }).promise;
}

/** Extract plain text from up to `maxPages` pages, with an optional page separator. */
export async function extractPdfPlainText(
  file: File,
  maxPages: number,
  separator?: (pageNumber: number) => string,
): Promise<string> {
  const doc = await openPdf(file);
  const pages = Math.min(doc.numPages, maxPages);
  let text = "";
  for (let p = 1; p <= pages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    text += (separator ? separator(p) : "") + pdfTextFromContent(content) + "\n\n";
  }
  return text.trim();
}

/** Lazily import mammoth's browser build. */
export async function loadMammoth(): Promise<MammothModule> {
  const mod = (await import("mammoth/mammoth.browser.js")) as unknown as
    | MammothModule
    | { default?: MammothModule };
  const mammoth = (("default" in mod && mod.default ? mod.default : mod) ??
    null) as MammothModule | null;
  if (!mammoth || typeof mammoth.extractRawText !== "function") {
    throw new Error("Word document reader failed to load. Please try a PDF or .txt file.");
  }
  return mammoth;
}

/** Extract raw text from a .docx file. */
export async function extractDocxText(file: File): Promise<string> {
  const mammoth = await loadMammoth();
  const buf = await file.arrayBuffer();
  const out = await mammoth.extractRawText({ arrayBuffer: buf });
  return (out?.value || "").trim();
}
