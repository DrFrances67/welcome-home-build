/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const elementSchema = z
  .object({
    id: z.string().max(200).optional(),
    type: z.string().max(50),
    page: z.number().int().min(0).max(100).optional(),
    x: z.number().min(0).max(100).optional(),
    y: z.number().min(0).max(2000).optional(),
    widthOverride: z.number().min(1).max(100).optional(),
    heightOverride: z.number().min(1).max(2000).optional(),
    text: z.string().max(20000).optional(),
    title: z.string().max(1000).optional(),
    label: z.string().max(1000).optional(),
    question: z.string().max(5000).optional(),
    prompt: z.string().max(5000).optional(),
    caption: z.string().max(1000).optional(),
    url: z.string().max(200000).optional(),
    choices: z.array(z.string().max(2000)).max(100).optional(),
    statements: z.array(z.string().max(2000)).max(100).optional(),
    words: z.array(z.string().max(500)).max(100).optional(),
    items: z.array(z.string().max(2000)).max(100).optional(),
    lines: z.number().int().min(1).max(50).optional(),
  })
  .passthrough();

const worksheetSchema = z
  .object({
    title: z.string().max(500).default("Worksheet"),
    showName: z.boolean().default(true),
    showDate: z.boolean().default(true),
    showGrade: z.boolean().default(true),
    gradeId: z.string().max(20).default("k"),
    pageCount: z.number().int().min(1).max(100).default(1),
    pageHeadersHidden: z.array(z.number().int().min(0).max(100)).max(100).default([]),
    elements: z.array(elementSchema).max(1000).default([]),
  })
  .passthrough();

type WorksheetPreviewData = z.infer<typeof worksheetSchema>;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderElement(element: WorksheetPreviewData["elements"][number]) {
  const text = escapeHtml(
    element.question ?? element.prompt ?? element.text ?? element.label ?? element.title ?? "",
  );
  const answerLines = Array.from({ length: element.lines ?? 3 }, () => "<i></i>").join("");
  let body = `<p>${text}</p>`;
  if (element.type === "multipleChoice") {
    body += `<ul>${(element.choices ?? []).map((choice) => `<li><b></b>${escapeHtml(choice)}</li>`).join("")}</ul>`;
  } else if (element.type === "truefalse") {
    body = (element.statements ?? [])
      .map((item) => `<p>${escapeHtml(item)} <strong>TRUE &nbsp; FALSE</strong></p>`)
      .join("");
  } else if (element.type === "wordBank") {
    body += `<div class="word-bank">${(element.words ?? []).map((word) => `<span>${escapeHtml(word)}</span>`).join("")}</div>`;
  } else if (["blank", "shortAnswer", "essay"].includes(element.type)) {
    body += `<div class="answer-lines">${answerLines}</div>`;
  } else if (element.type === "fillBlank") {
    body = `<p>${escapeHtml(element.text).replaceAll("______", '<span class="inline-blank"></span>')}</p>`;
  } else if (element.type === "matching") {
    const left = Array.isArray(element.left) ? element.left : [];
    const right = Array.isArray(element.right) ? element.right : [];
    body += `<div class="matching">${left.map((item, index) => `<span>${escapeHtml(item)}</span><i>—</i><span>${escapeHtml(right[index])}</span>`).join("")}</div>`;
  } else if (element.type === "table") {
    const headers = Array.isArray(element.headers) ? element.headers : [];
    const rows = Array.isArray(element.rows) ? element.rows : [];
    body += `<table><thead><tr>${headers.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${(Array.isArray(row) ? row : []).map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  } else if (["successCriteria", "exitTicket"].includes(element.type)) {
    body += `<ul>${(element.items ?? []).map((item) => `<li><b></b>${escapeHtml(item)}</li>`).join("")}</ul>`;
  } else if (element.type === "image") {
    const url = element.url ?? "";
    const safe = /^(data:image\/|https:\/\/|http:\/\/)/i.test(url);
    body = safe
      ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(element.caption ?? "Worksheet illustration")}">${element.caption ? `<small>${escapeHtml(element.caption)}</small>` : ""}`
      : `<div class="image-missing">Image unavailable</div>${element.caption ? `<small>${escapeHtml(element.caption)}</small>` : ""}`;
  } else if (element.type === "divider") {
    body = `<div class="divider">✦</div>`;
  } else if (element.type === "dokQuestions") {
    const levels = Array.isArray(element.levels) ? element.levels : [];
    body += levels
      .map((level) => {
        const lv = level as { level?: number; label?: string; items?: unknown };
        const items = Array.isArray(lv.items) ? lv.items : [];
        return `<div class="dok-level"><p class="dok-title">DOK ${escapeHtml(lv.level ?? "")}${lv.label ? ` — ${escapeHtml(lv.label)}` : ""}</p><ul>${items.map((item) => `<li><b></b>${escapeHtml(item)}</li>`).join("")}</ul></div>`;
      })
      .join("");
  } else if (element.type === "customShape") {
    const shapes = Array.isArray(element.shapes) ? element.shapes : [];
    body += `<div class="shapes">${shapes
      .map((shape) => {
        const sh = shape as { label?: string; caption?: string; lines?: number };
        const shapeLines = Array.from({ length: Math.min(20, Math.max(0, sh.lines ?? 0)) }, () => "<i></i>").join("");
        return `<div class="shape-box"><span>${escapeHtml(sh.label ?? "")}</span>${shapeLines ? `<div class="answer-lines">${shapeLines}</div>` : ""}${sh.caption ? `<small>${escapeHtml(sh.caption)}</small>` : ""}</div>`;
      })
      .join("")}</div>`;
  }
  const left = Math.min(88, Math.max(0, element.x ?? 0));
  const top = Math.min(760, Math.max(0, element.y ?? 0));
  const width = Math.min(100 - left, Math.max(12, element.widthOverride ?? 100));
  return `<section class="element" style="left:${left}%;top:${top}px;width:${width}%">${body}</section>`;
}

export function buildWorksheetPrintHtml(input: unknown) {
  const parsed = worksheetSchema.safeParse(input);
  if (!parsed.success) throw new Error("This saved worksheet cannot be previewed.");
  const worksheet = parsed.data;
  const hiddenHeaders = new Set(worksheet.pageHeadersHidden);
  const pages = Array.from({ length: worksheet.pageCount }, (_, pageIndex) => {
    const header = hiddenHeaders.has(pageIndex)
      ? ""
      : `<header><h1>${escapeHtml(worksheet.title)}${worksheet.pageCount > 1 ? ` <small>— Page ${pageIndex + 1}</small>` : ""}</h1><div class="student-lines">${worksheet.showName ? "<span>Name:</span><i></i>" : ""}${worksheet.showDate ? "<span>Date:</span><i></i>" : ""}</div></header>`;
    const elements = worksheet.elements
      .filter((element) => (element.page ?? 0) === pageIndex)
      .map(renderElement)
      .join("");
    return `<article class="page">${worksheet.showGrade ? `<aside>${escapeHtml(worksheet.gradeId.toUpperCase())}</aside>` : ""}${header}<main>${elements}</main></article>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
*{box-sizing:border-box}html,body{margin:0;background:#dfe3e8;color:#111827;font-family:Arial,sans-serif}.page{position:relative;width:760px;height:970px;margin:20px auto;background:#fff;padding:52px 64px;overflow:hidden;box-shadow:0 3px 16px #0002;break-after:page}.page aside{position:absolute;right:18px;top:14px;padding:4px 11px;border:1px solid #8b0ab0;border-radius:999px;color:#8b0ab0;font-size:11px;font-weight:700}.page header{height:92px;border-bottom:2px solid #8b0ab033}.page h1{margin:0 0 18px;color:#8b0ab0;font-size:22px}.page h1 small{color:#6b7280;font-size:12px}.student-lines{display:grid;grid-template-columns:auto 1fr auto 1fr;gap:8px;align-items:end;font-size:12px}.student-lines i,.answer-lines i{display:block;border-bottom:1.5px solid #9ca3af;height:20px}.page main{position:relative;height:770px}.element{position:absolute;padding:0 6px;font-size:14px;line-height:1.45}.element p{margin:0 0 8px}.element ul{list-style:none;padding:0;margin:6px 0}.element li{display:flex;gap:8px;margin:6px 0}.element li b{width:17px;height:17px;border:2px solid #8b0ab0;border-radius:50%;flex:none}.element strong{float:right;color:#8b0ab0;font-size:11px}.word-bank{display:flex;flex-wrap:wrap;gap:6px;padding:10px;background:#faf5ff}.word-bank span{border:1px solid #8b0ab0;border-radius:999px;padding:3px 9px}.element img{display:block;max-width:100%;max-height:220px;margin:auto}.element small{display:block;text-align:center;color:#6b7280}.answer-lines i{height:26px}.inline-blank{display:inline-block;width:90px;border-bottom:2px solid #8b0ab0}.matching{display:grid;grid-template-columns:1fr auto 1fr;gap:8px}.matching span{border:1px solid #8b0ab0;padding:6px;text-align:center}.element table{width:100%;border-collapse:collapse}.element th,.element td{border:1px solid #8b0ab0;padding:6px}.element th{background:#8b0ab0;color:white}
.divider{text-align:center;color:#8b0ab0;font-size:16px;margin:8px 0}.image-missing{padding:18px;text-align:center;border:1px dashed #9ca3af;color:#6b7280;font-size:12px}.dok-level{margin:8px 0;border-left:4px solid #8b0ab0;padding-left:10px}.dok-title{font-weight:700;color:#8b0ab0;font-size:12px;margin:0 0 4px}.shapes{display:flex;flex-wrap:wrap;gap:10px}.shape-box{flex:1 1 45%;min-height:60px;border:2px solid #8b0ab0;border-radius:10px;padding:8px;text-align:center}
@media print{html,body{background:#fff}.page{margin:0 auto;box-shadow:none}@page{size:letter portrait;margin:.4in}}
</style></head><body>${pages}</body></html>`;
}

export function WorksheetPrintPreview({
  open,
  onOpenChange,
  worksheet,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worksheet: unknown;
  onEdit: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(1);
  const html = useMemo(() => {
    try {
      return { content: buildWorksheetPrintHtml(worksheet), error: null };
    } catch (error) {
      return {
        content: "",
        error: error instanceof Error ? error.message : "Preview unavailable.",
      };
    }
  }, [worksheet]);
  const pageCount = worksheetSchema.safeParse(worksheet).data?.pageCount ?? 1;

  useEffect(() => {
    if (!open || !viewportRef.current) return;
    const element = viewportRef.current;
    const update = () => setScale(Math.min(1, Math.max(0.25, (element.clientWidth - 24) / 760)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="worksheet-preview-dialog">
        <DialogHeader className="worksheet-preview-header">
          <DialogTitle>Print preview</DialogTitle>
          <DialogDescription>
            {pageCount} full {pageCount === 1 ? "page" : "pages"} with print margins
          </DialogDescription>
        </DialogHeader>
        {html.error ? (
          <p role="alert" className="worksheet-preview-error">
            {html.error}
          </p>
        ) : (
          <div ref={viewportRef} className="worksheet-preview-viewport">
            <div
              className="worksheet-preview-scaler"
              style={{ width: 760 * scale, height: pageCount * 1010 * scale }}
            >
              <iframe
                ref={iframeRef}
                title="Saved worksheet full-page preview"
                srcDoc={html.content}
                sandbox="allow-same-origin allow-modals"
                style={{ width: 760, height: pageCount * 1010, transform: `scale(${scale})` }}
              />
            </div>
          </div>
        )}
        <div className="worksheet-preview-actions">
          <Button variant="outline" onClick={onEdit}>
            Open &amp; edit
          </Button>
          <Button
            onClick={() => iframeRef.current?.contentWindow?.print()}
            disabled={Boolean(html.error)}
          >
            <Printer aria-hidden="true" /> Print / Save PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
