// Multi-state learning-standards registry.
//
// New York ships with a full dataset (see ny-standards.ts). Connecticut,
// New Jersey, and Pennsylvania datasets are populated from their respective
// uploaded standards documents. Until a state's dataset is loaded, its entry
// is an empty object and the standards UI is hidden for that state.
import { NY_STANDARDS, type NyStandards } from "./ny-standards";
import { CT_STANDARDS } from "./ct-standards";
import { NJ_STANDARDS } from "./nj-standards";
import { PA_STANDARDS } from "./pa-standards";

export type StateCode = "CT" | "NJ" | "NY" | "PA";

export interface StateInfo {
  code: StateCode;
  /** Full state name, e.g. "New York" */
  name: string;
  /** Official standards set name used in prompts and citations */
  standardsName: string;
  /** Short label used on buttons, e.g. "NY Standards" */
  standardsShort: string;
  /** Decorative emoji shown next to the standards label */
  flag: string;
}

// Alphabetical by state name.
export const STATES: StateInfo[] = [
  {
    code: "CT",
    name: "Connecticut",
    standardsName: "Connecticut Core Standards",
    standardsShort: "CT Standards",
    flag: "⚓",
  },
  {
    code: "NJ",
    name: "New Jersey",
    standardsName: "New Jersey Student Learning Standards",
    standardsShort: "NJ Standards",
    flag: "🌳",
  },
  {
    code: "NY",
    name: "New York",
    standardsName: "New York State Next Generation Learning Standards",
    standardsShort: "NY Standards",
    flag: "🗽",
  },
  {
    code: "PA",
    name: "Pennsylvania",
    standardsName: "Pennsylvania Academic Standards",
    standardsShort: "PA Standards",
    flag: "🔔",
  },
];

export const STATE_STANDARDS: Record<StateCode, NyStandards> = {
  CT: CT_STANDARDS,
  NJ: NJ_STANDARDS,
  NY: NY_STANDARDS,
  PA: PA_STANDARDS,
};

export const DEFAULT_STATE: StateCode = "NY";

export const getStateInfo = (code: StateCode): StateInfo =>
  STATES.find((s) => s.code === code) || STATES.find((s) => s.code === DEFAULT_STATE)!;

/** Whether a state has any standards loaded (controls visibility of standards UI). */
export const hasStandards = (code: StateCode): boolean =>
  Object.keys(STATE_STANDARDS[code] || {}).length > 0;

// ── Module-level "active state" ──────────────────────────────────────────
// Kept in sync by AppStateProvider so non-component helpers (worksheet-utils,
// AI prompt builders) can read the selected state without prop drilling.
let activeStateCode: StateCode = DEFAULT_STATE;

export const setActiveStateCode = (code: StateCode) => {
  activeStateCode = code;
};
export const getActiveStateCode = (): StateCode => activeStateCode;
export const getActiveStandards = (): NyStandards => STATE_STANDARDS[activeStateCode] || {};
export const getActiveStateInfo = (): StateInfo => getStateInfo(activeStateCode);
