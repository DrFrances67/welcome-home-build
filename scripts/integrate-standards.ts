// Single-command standards integration pipeline.
//
//   bun scripts/integrate-standards.ts <job.json> [--dry-run] [--keep-json]
//
// Given a job file that maps new state PDFs to (subject, grade band), this:
//   1. EXTRACTS each PDF into an incoming JSON array of { code, desc }
//      (via scripts/standards-pipeline/extract-pdf.py).
//   2. DEDUPS the incoming codes against the state's existing dataset and
//      against the rest of the batch (the engine behind check-standards-dedup).
//   3. VALIDATES a candidate "existing + incoming" dataset for schema shape,
//      count regressions, code normalization, and duplicates (the engine
//      behind validate-standards).
//   4. Only if BOTH gates pass, WRITES the integrated dataset as a TypeScript
//      module under src/data/ and prints the snippet to wire it into the state.
//
// Any failure in steps 1-3 aborts before anything is written, so a bad PDF
// parse can never silently land in the shipped data.
//
// ── Job file shape ──────────────────────────────────────────────────────────
//   {
//     "state": "PA",
//     "outFile": "src/data/pa-batch-2026.ts",
//     "exportName": "PA_BATCH_2026_STANDARDS",
//     "jobs": [
//       {
//         "subject": "Music",
//         "band": "Grades K-2",
//         "pdf": "/abs/path/music-k2.pdf",
//         "codeRegex": "\\b\\d+\\.\\d+\\.\\d+\\.[A-Z]\\b",
//         "pages": "1-5"          // optional; default = all pages
//       }
//     ]
//   }
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";
import type { Standard, NyStandards } from "../src/data/ny-standards";
import { STATE_STANDARDS, type StateCode } from "../src/data/state-standards";
import {
  dedupeIncomingStandards,
  validateStateStandards,
  normalizeCode,
  formatIssues,
} from "../src/data/standards-validation";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXTRACTOR = join(HERE, "standards-pipeline", "extract-pdf.py");

const fail = (msg: string): never => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};

// ── Job file schema ─────────────────────────────────────────────────────────
const jobSchema = z.object({
  state: z.enum(["CT", "NJ", "NY", "PA"]),
  outFile: z.string().min(1),
  exportName: z.string().regex(/^[A-Z][A-Z0-9_]*$/, "exportName must be SCREAMING_SNAKE_CASE"),
  jobs: z
    .array(
      z.object({
        subject: z.string().min(1),
        band: z.string().min(1),
        pdf: z.string().min(1),
        codeRegex: z.string().min(1),
        pages: z.string().optional(),
      }),
    )
    .min(1, "at least one job is required"),
});
type JobFile = z.infer<typeof jobSchema>;

// ── CLI ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const keepJson = args.includes("--keep-json");
const configPath = args.find((a) => !a.startsWith("--"));

if (!configPath) {
  console.error("Usage: bun scripts/integrate-standards.ts <job.json> [--dry-run] [--keep-json]");
  process.exit(2);
}

let config: JobFile;
try {
  config = jobSchema.parse(JSON.parse(readFileSync(configPath, "utf8")));
} catch (err) {
  fail(`Invalid job file ${configPath}: ${(err as Error).message}`);
}

const state = config!.state as StateCode;
const existing = STATE_STANDARDS[state];

// ── Phase 0: make sure the Python extractor can run ─────────────────────────
const python = process.env.PYTHON ?? "python3";
const probe = spawnSync(python, ["-c", "import pdfplumber"], { encoding: "utf8" });
if (probe.status !== 0) {
  console.log("Installing pdfplumber for PDF extraction…");
  const install = spawnSync(python, ["-m", "pip", "install", "--quiet", "pdfplumber"], {
    stdio: "inherit",
  });
  if (install.status !== 0) fail("Could not install pdfplumber (required for extraction).");
}

// ── Phase 1: extract each PDF into incoming JSON ────────────────────────────
const workDir = mkdtempSync(join(tmpdir(), "standards-extract-"));
console.log(`\n[1/4] Extracting ${config!.jobs.length} PDF job(s) → incoming JSON`);

interface ExtractedJob {
  subject: string;
  band: string;
  pdf: string;
  standards: Standard[];
}
const extracted: ExtractedJob[] = [];

config!.jobs.forEach((job, i) => {
  const outJson = join(workDir, `incoming-${i}.json`);
  const pdfPath = resolve(job.pdf);
  const cmd = [
    EXTRACTOR,
    "--pdf",
    pdfPath,
    "--code-regex",
    job.codeRegex,
    "--out",
    outJson,
    ...(job.pages ? ["--pages", job.pages] : []),
  ];
  const res = spawnSync(python, cmd, { encoding: "utf8" });
  if (res.status !== 0) {
    if (!keepJson) rmSync(workDir, { recursive: true, force: true });
    fail(
      `Extraction failed for ${job.subject} / ${job.band} (${pdfPath}):\n${res.stderr || res.stdout}`,
    );
  }
  console.log(`  ✓ ${job.subject} / ${job.band}: ${res.stdout.trim()}`);
  const standards = JSON.parse(readFileSync(outJson, "utf8")) as Standard[];
  if (standards.length === 0) {
    if (!keepJson) rmSync(workDir, { recursive: true, force: true });
    fail(`No standards extracted for ${job.subject} / ${job.band} — check the code regex.`);
  }
  extracted.push({ subject: job.subject, band: job.band, pdf: pdfPath, standards });
});

// ── Phase 2: dedup gate (check-standards-dedup engine) ──────────────────────
console.log(`\n[2/4] Dedup check against existing ${state} dataset + within batch`);
const bySubject = new Map<string, Standard[]>();
for (const e of extracted) {
  const list = bySubject.get(e.subject) ?? [];
  list.push(...e.standards);
  bySubject.set(e.subject, list);
}

let dupCount = 0;
for (const [subject, incoming] of bySubject) {
  const res = dedupeIncomingStandards(existing, subject, incoming);
  console.log(
    `  ${subject}: incoming=${incoming.length} unique=${res.unique.length} ` +
      `dupExisting=${res.duplicatesOfExisting.length} dupBatch=${res.duplicatesInBatch.length} ` +
      `normalized=${res.normalized.length}`,
  );
  for (const d of res.duplicatesOfExisting) {
    console.log(`    ! "${d.standard.code}" already in band "${d.existingBand}"`);
  }
  for (const d of res.duplicatesInBatch) console.log(`    ! "${d.code}" repeated within batch`);
  dupCount += res.duplicatesOfExisting.length + res.duplicatesInBatch.length;
}
if (dupCount > 0) {
  if (!keepJson) rmSync(workDir, { recursive: true, force: true });
  fail(`${dupCount} duplicate(s) detected — resolve before integrating. Nothing was written.`);
}

// Build the normalized candidate dataset (subject → band → Standard[]).
const incomingDataset: NyStandards = {};
for (const e of extracted) {
  incomingDataset[e.subject] ??= {};
  const arr = (incomingDataset[e.subject][e.band] ??= []);
  for (const s of e.standards) arr.push({ code: normalizeCode(s.code), desc: s.desc.trim() });
}

// ── Phase 3: validation gate (validate-standards engine) ────────────────────
console.log(`\n[3/4] Validating candidate "${state} existing + incoming" dataset`);
const merged: NyStandards = structuredClone(existing);
for (const [subject, bands] of Object.entries(incomingDataset)) {
  merged[subject] ??= {};
  for (const [band, arr] of Object.entries(bands)) {
    merged[subject][band] = [...(merged[subject][band] ?? []), ...arr];
  }
}
const issues = validateStateStandards(state, merged);
const errors = issues.filter((i) => i.level === "error");
if (issues.length) console.log(formatIssues(issues));
if (errors.length) {
  if (!keepJson) rmSync(workDir, { recursive: true, force: true });
  fail(`${errors.length} validation error(s) — nothing was written.`);
}
console.log("  ✓ schema, count guard, normalization, and duplicate checks passed");

// ── Phase 4: write the integrated dataset module ────────────────────────────
const totalNew = extracted.reduce((n, e) => n + e.standards.length, 0);
if (dryRun) {
  if (!keepJson) rmSync(workDir, { recursive: true, force: true });
  console.log(`\n[4/4] --dry-run: ${totalNew} standard(s) would be written to ${config!.outFile}.`);
  console.log("\n✓ All gates passed (dry run, no file written).");
  process.exit(0);
}

const source = renderModule(config!.exportName, incomingDataset, extracted);
const outPath = resolve(config!.outFile);
writeFileSync(outPath, source, "utf8");

// Format the generated file so it satisfies the prettier CI check.
const fmt = spawnSync("bunx", ["prettier", "--write", config!.outFile], { encoding: "utf8" });
if (fmt.status !== 0) console.warn(`  (prettier formatting skipped: ${fmt.stderr || fmt.stdout})`);

if (!keepJson) rmSync(workDir, { recursive: true, force: true });

console.log(`\n[4/4] Wrote ${totalNew} standard(s) → ${config!.outFile}`);
console.log("\nWire it into the state by merging the export, e.g. in the state data file:");
console.log(`  import { ${config!.exportName} } from "./${moduleSpecifier(config!.outFile)}";`);
console.log(
  `  export const ${state}_STANDARDS = { ...${state}_STANDARDS_BASE, ...${config!.exportName} };`,
);
console.log(
  "\nThen run `bun run validate:standards` and `bun run test` to confirm CI stays green.",
);
console.log("\n✓ Integration complete.");

// ── Helpers ─────────────────────────────────────────────────────────────────
function moduleSpecifier(outFile: string): string {
  return outFile.replace(/^src\/data\//, "").replace(/\.tsx?$/, "");
}

function renderModule(exportName: string, dataset: NyStandards, jobs: ExtractedJob[]): string {
  const sources = [...new Set(jobs.map((j) => j.pdf))].map((p) => `//   - ${p}`).join("\n");
  const body = Object.entries(dataset)
    .map(([subject, bands]) => {
      const bandLines = Object.entries(bands)
        .map(([band, arr]) => {
          const items = arr
            .map(
              (s) => `      { code: ${JSON.stringify(s.code)}, desc: ${JSON.stringify(s.desc)} },`,
            )
            .join("\n");
          return `    ${JSON.stringify(band)}: [\n${items}\n    ],`;
        })
        .join("\n");
      return `  ${JSON.stringify(subject)}: {\n${bandLines}\n  },`;
    })
    .join("\n");
  return `// AUTO-GENERATED by scripts/integrate-standards.ts on ${new Date().toISOString().slice(0, 10)}.
// Passed the dedup and validation gates before being written.
// Source PDFs:
${sources}
import type { NyStandards } from "./ny-standards";

export const ${exportName}: NyStandards = {
${body}
};
`;
}
