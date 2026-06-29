// Standalone standards integrity check.
//
//   bun scripts/validate-standards.ts
//
// Prints a per-state summary (subjects / bands / totals vs baseline) and any
// schema, count, normalization, or duplicate issues. Exits non-zero on errors,
// so it can gate a build/deploy pipeline (CI already runs the equivalent vitest
// suite via `bun run test`).
import {
  summarizeAllStandards,
  validateAllStandards,
  formatIssues,
} from "../src/data/standards-validation";

const summaries = summarizeAllStandards();
console.log("State standards summary:");
for (const s of summaries) {
  const flag = s.total >= s.expectedMin ? "ok" : "LOW";
  console.log(
    `  ${s.state}: subjects=${s.subjects} bands=${s.bands} total=${s.total} (min ${s.expectedMin}) [${flag}]`,
  );
}

const issues = validateAllStandards();
const errors = issues.filter((i) => i.level === "error");
const warnings = issues.filter((i) => i.level === "warning");

if (issues.length) {
  console.log("\nIssues:");
  console.log(formatIssues(issues));
}

console.log(`\n${errors.length} error(s), ${warnings.length} warning(s).`);

if (errors.length) {
  console.error("\n✗ Standards validation failed.");
  process.exit(1);
}
console.log("\n✓ All standards datasets passed validation.");
