// Actions considered billable (cloud / AI generation events).
// Everything else (clicks, opens, edits, exports, uploads, resizes, navigation,
// timer pings, etc.) is non-billable and excluded from the credit count.
export const BILLABLE_ACTIONS = new Set<string>([
  "generate", // Lesson Plan Generator — AI lesson generation
  "analyze", // Danielson Review — AI rubric analysis
  "create", // Worksheet Builder — AI worksheet creation
  "send", // Professional Communication — AI message generation
]);

export function isBillableAction(action: string | null | undefined): boolean {
  return !!action && BILLABLE_ACTIONS.has(action);
}
