// Multi-state learning-standards registry.
//
// Each state's dataset is large (thousands of entries), so datasets are loaded
// on demand via dynamic import when a state is selected. Nothing standards
// related ships in the initial bundle; `getActiveStandards()` returns `{}`
// until the selected state's chunk has resolved.
import type { NyStandards } from "./ny-standards";

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

export const DEFAULT_STATE: StateCode = "NY";

export const getStateInfo = (code: StateCode): StateInfo =>
  STATES.find((s) => s.code === code) || STATES.find((s) => s.code === DEFAULT_STATE)!;

// ── Lazy dataset loading ─────────────────────────────────────────────────
const LOADERS: Record<StateCode, () => Promise<NyStandards>> = {
  CT: () => import("./ct-standards").then((m) => m.CT_STANDARDS),
  NJ: () => import("./nj-standards").then((m) => m.NJ_STANDARDS),
  NY: () => import("./ny-standards").then((m) => m.NY_STANDARDS),
  PA: () => import("./pa-standards").then((m) => m.PA_STANDARDS),
};

/**
 * Which states ship a dataset. Static so standards UI visibility can be decided
 * without pulling in a multi-megabyte chunk.
 */
const STATES_WITH_STANDARDS: Record<StateCode, boolean> = {
  CT: true,
  NJ: true,
  NY: true,
  PA: true,
};

const cache = new Map<StateCode, NyStandards>();
const inflight = new Map<StateCode, Promise<NyStandards>>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((fn) => fn());

/** Subscribe to dataset-loaded events (used by the app-state provider). */
export const onStandardsLoaded = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Load (and cache) a state's dataset. */
export function loadStandards(code: StateCode): Promise<NyStandards> {
  const cached = cache.get(code);
  if (cached) return Promise.resolve(cached);
  let p = inflight.get(code);
  if (!p) {
    p = LOADERS[code]()
      .then((data) => {
        cache.set(code, data);
        inflight.delete(code);
        notify();
        return data;
      })
      .catch((err) => {
        inflight.delete(code);
        throw err;
      });
    inflight.set(code, p);
  }
  return p;
}

/** Synchronously read an already-loaded dataset ({} when not loaded yet). */
export const getLoadedStandards = (code: StateCode): NyStandards => cache.get(code) ?? {};

/** Whether a state has a dataset available (controls visibility of standards UI). */
export const hasStandards = (code: StateCode): boolean => STATES_WITH_STANDARDS[code] === true;

/** Whether a state's dataset has finished loading. */
export const isStandardsLoaded = (code: StateCode): boolean => cache.has(code);

// ── Module-level "active state" ──────────────────────────────────────────
// Kept in sync by AppStateProvider so non-component helpers (worksheet-utils,
// AI prompt builders) can read the selected state without prop drilling.
let activeStateCode: StateCode = DEFAULT_STATE;

export const setActiveStateCode = (code: StateCode) => {
  const changed = activeStateCode !== code;
  activeStateCode = code;
  if (!cache.has(code)) void loadStandards(code).catch(() => {});
  else if (changed) notify();
};
export const getActiveStateCode = (): StateCode => activeStateCode;
export const getActiveStandards = (): NyStandards => getLoadedStandards(activeStateCode);
export const getActiveStateInfo = (): StateInfo => getStateInfo(activeStateCode);
