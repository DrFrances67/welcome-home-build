// @ts-nocheck
// Validation for the email assistant's situation selection.
import { SITUATION_MAX, SITUATION_CONFLICTS } from "@/data/email";

export function validateSituations(selected) {
  const issues = [];
  if (selected.length > SITUATION_MAX) {
    issues.push({
      level: "error",
      message: `You've selected ${selected.length} situations. Pick ${SITUATION_MAX} or fewer so the AI can address each one clearly.`,
      suggestion: selected.slice(0, SITUATION_MAX),
    });
  }
  if (selected.includes("Other") && selected.length > 1) {
    issues.push({
      level: "warning",
      message: `"Other" is a catch-all — pairing it with specific situations confuses the AI's focus.`,
      suggestion: selected.filter(s => s !== "Other"),
    });
  }
  for (const rule of SITUATION_CONFLICTS) {
    if (rule.allowed || rule.soft) continue;
    const [a, b] = rule.when;
    if (selected.includes(a) && selected.includes(b)) {
      issues.push({
        level: "error",
        message: `"${a}" + "${b}" — ${rule.reason}`,
        suggestion: rule.suggest,
      });
    }
  }
  return issues;
}
