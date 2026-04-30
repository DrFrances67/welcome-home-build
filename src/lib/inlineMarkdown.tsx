import React from "react";

// Minimal inline-markdown renderer for AI-generated worksheet text.
// Supports **bold**, __bold__, *italic*, _italic_. Order matters: bold first.
// Returns a React fragment safe to drop inside <p>/<span>/<div>.
export function renderInlineMarkdown(input: string | undefined | null): React.ReactNode {
  if (input == null) return null;
  const text = String(input);
  if (!/[*_]/.test(text)) return text;

  // Tokenize with a single regex that matches **..**, __..__, *..*, _.._
  const re = /(\*\*([^*\n]+?)\*\*|__([^_\n]+?)__|\*([^*\n]+?)\*|_([^_\n]+?)_)/g;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const bold = m[2] ?? m[3];
    const ital = m[4] ?? m[5];
    if (bold != null) {
      out.push(<strong key={key++} style={{ fontWeight: 700 }}>{bold}</strong>);
    } else if (ital != null) {
      out.push(<em key={key++}>{ital}</em>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

// Plain-text variant: strips markdown markers without emitting tags.
// Useful for textareas / plaintext export.
export function stripInlineMarkdown(input: string | undefined | null): string {
  if (input == null) return "";
  return String(input)
    .replace(/\*\*([^*\n]+?)\*\*/g, "$1")
    .replace(/__([^_\n]+?)__/g, "$1")
    .replace(/\*([^*\n]+?)\*/g, "$1")
    .replace(/_([^_\n]+?)_/g, "$1");
}

// HTML variant for export (PDF/print). Escapes HTML then applies bold/italic.
export function inlineMarkdownToHtml(input: string | undefined | null): string {
  if (input == null) return "";
  const esc = String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc
    .replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_\n]+?)__/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+?)\*/g, "<em>$1</em>")
    .replace(/_([^_\n]+?)_/g, "<em>$1</em>");
}
