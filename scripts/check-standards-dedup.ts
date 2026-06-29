// Deduplication check for a freshly parsed PDF batch BEFORE merging it into a
// state's dataset. Catches codes that already exist (in any grade band) or that
// repeat within the new batch, and reports codes that needed normalization.
//
//   bun scripts/check-standards-dedup.ts <STATE> <SUBJECT> <incoming.json>
//
// where incoming.json is an array of { "code": string, "desc": string }.
// Exits non-zero if any duplicates are detected, so it can block integration.
import { readFileSync } from "node:fs";
import { STATE_STANDARDS } from "../src/data/state-standards";
import type { StateCode } from "../src/data/state-standards";
import type { Standard } from "../src/data/ny-standards";
import { dedupeIncomingStandards } from "../src/data/standards-validation";

const [state, subject, file] = process.argv.slice(2);

if (!state || !subject || !file) {
  console.error("Usage: bun scripts/check-standards-dedup.ts <STATE> <SUBJECT> <incoming.json>");
  process.exit(2);
}

const dataset = STATE_STANDARDS[state as StateCode];
if (!dataset) {
  console.error(`Unknown state "${state}". Known: ${Object.keys(STATE_STANDARDS).join(", ")}`);
  process.exit(2);
}

let incoming: Standard[];
try {
  incoming = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(incoming)) throw new Error("expected a JSON array");
} catch (err) {
  console.error(`Failed to read ${file}: ${(err as Error).message}`);
  process.exit(2);
}

const res = dedupeIncomingStandards(dataset, subject, incoming);

console.log(`Incoming: ${incoming.length} standard(s) for ${state} / ${subject}`);
console.log(`  unique (safe to add):      ${res.unique.length}`);
console.log(`  duplicates of existing:    ${res.duplicatesOfExisting.length}`);
console.log(`  duplicates within batch:   ${res.duplicatesInBatch.length}`);
console.log(`  codes normalized:          ${res.normalized.length}`);

if (res.duplicatesOfExisting.length) {
  console.log("\nAlready present in dataset:");
  for (const d of res.duplicatesOfExisting) {
    console.log(`  ${d.standard.code} (existing band: ${d.existingBand})`);
  }
}
if (res.duplicatesInBatch.length) {
  console.log("\nRepeated within incoming batch:");
  for (const d of res.duplicatesInBatch) console.log(`  ${d.code}`);
}
if (res.normalized.length) {
  console.log("\nNormalized codes:");
  for (const n of res.normalized) console.log(`  "${n.original}" -> "${n.normalized}"`);
}

const dupes = res.duplicatesOfExisting.length + res.duplicatesInBatch.length;
if (dupes) {
  console.error(`\n✗ ${dupes} duplicate(s) detected — resolve before integrating.`);
  process.exit(1);
}
console.log("\n✓ No duplicates. Safe to integrate.");
