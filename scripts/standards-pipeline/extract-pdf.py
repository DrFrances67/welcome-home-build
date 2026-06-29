#!/usr/bin/env python3
"""Extract candidate {code, desc} standards from a single PDF.

Invoked by scripts/integrate-standards.ts as the "produce the incoming JSON"
phase of the integration pipeline. Given a PDF and a code regex, it pulls the
text (optionally limited to a page range), finds every code occurrence, and
treats the text between one code and the next as that standard's description.

Usage:
  python3 extract-pdf.py --pdf FILE --code-regex REGEX [--pages 1-5] --out OUT.json

Writes a JSON array of { "code": str, "desc": str } to --out and prints a
one-line summary to stdout. Exits non-zero on any failure so the orchestrator
can abort before anything is written into the dataset.
"""
import argparse
import json
import re
import sys

try:
    import pdfplumber
except ImportError:
    sys.stderr.write(
        "pdfplumber is required. Install with: python3 -m pip install pdfplumber\n"
    )
    sys.exit(3)


def parse_page_range(spec, page_count):
    """Turn "1-5" / "3" / "2-" into a 0-based set of page indices."""
    if not spec:
        return list(range(page_count))
    pages = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            lo, _, hi = part.partition("-")
            lo = int(lo) if lo.strip() else 1
            hi = int(hi) if hi.strip() else page_count
        else:
            lo = hi = int(part)
        for p in range(lo, hi + 1):
            if 1 <= p <= page_count:
                pages.add(p - 1)
    return sorted(pages)


def clean(text):
    """Collapse whitespace so codes/descriptions match the canonical form."""
    return re.sub(r"\s+", " ", text or "").strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--code-regex", required=True)
    ap.add_argument("--pages", default="")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    try:
        code_re = re.compile(args.code_regex)
    except re.error as exc:
        sys.stderr.write(f"Invalid --code-regex: {exc}\n")
        sys.exit(2)

    try:
        with pdfplumber.open(args.pdf) as pdf:
            page_count = len(pdf.pages)
            indices = parse_page_range(args.pages, page_count)
            chunks = []
            for i in indices:
                chunks.append(pdf.pages[i].extract_text() or "")
    except Exception as exc:  # noqa: BLE001 - surface any pdf error to orchestrator
        sys.stderr.write(f"Failed to read {args.pdf}: {exc}\n")
        sys.exit(1)

    text = "\n".join(chunks)
    matches = list(code_re.finditer(text))

    records = []
    for idx, m in enumerate(matches):
        code = clean(m.group(0))
        start = m.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        desc = clean(text[start:end])
        # Drop a leading separator that often sits between a code and its text.
        desc = re.sub(r"^[\s:.\-–—)]+", "", desc).strip()
        if code and desc:
            records.append({"code": code, "desc": desc})

    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(records, fh, ensure_ascii=False, indent=2)

    print(
        f"extracted {len(records)} record(s) from {args.pdf} "
        f"(pages={args.pages or 'all'}, regex={args.code_regex})"
    )


if __name__ == "__main__":
    main()
