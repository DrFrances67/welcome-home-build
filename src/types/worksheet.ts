// Shared worksheet-element data model.
// The worksheet builder stores a heterogeneous list of "elements" (one object
// per block on the page). Every block shares positioning fields; the rest of
// the fields are optional and vary by `type`. The index signature keeps the
// model permissive for incremental adoption while the known fields document
// the common shape.
export type WorksheetElementType =
  | "instruction" | "text" | "image" | "blank" | "wordBank" | "matching"
  | "multipleChoice" | "truefalse" | "shortAnswer" | "fillBlank" | "essay"
  | "table" | "customShape" | "successCriteria" | "exitTicket"
  | "dokQuestions" | "divider";

export interface DokLevel {
  level: number;
  label: string;
  items: string[];
}

export interface WorksheetShape {
  shape: string;
  label?: string;
  fill?: string;
  border?: string;
  borderWidth?: number;
  width?: number | string;
  height?: number | string;
  lines?: number;
}

export interface WorksheetElement {
  id: string;
  type: WorksheetElementType | string;
  // Layout / positioning
  x?: number;
  y?: number;
  page?: number;
  widthOverride?: number;
  heightOverride?: number;
  align?: string;
  size?: string;
  font?: string;
  // Content (varies by type)
  text?: string;
  label?: string;
  title?: string;
  intro?: string;
  caption?: string;
  url?: string;
  note?: string;
  lines?: number;
  points?: number;
  words?: string[];
  left?: string[];
  right?: string[];
  question?: string;
  choices?: string[];
  statements?: string[];
  prompt?: string;
  headers?: string[];
  rows?: string[][];
  items?: string[];
  mode?: string;
  topic?: string;
  layout?: string;
  shapes?: WorksheetShape[];
  levels?: DokLevel[];
  [key: string]: unknown;
}
