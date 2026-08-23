import { createContext, useContext } from "react";
import {
  type StateCode,
  type StateInfo,
  DEFAULT_STATE,
  getStateInfo,
  hasStandards as hasStandardsFor,
} from "@/data/state-standards";

export interface AppStateContextValue {
  stateCode: StateCode;
  setStateCode: (code: StateCode) => void;
  info: StateInfo;
  /** Whether the selected state has standards loaded. */
  hasStandards: boolean;
}

export const AppStateContext = createContext<AppStateContextValue | null>(null);

/**
 * Read the selected state. Lives in its own module (separate from the
 * provider component) so React Fast Refresh can hot-swap the provider
 * without invalidating every consumer.
 */
export function useAppState(): AppStateContextValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    // Safe fallback if a component renders outside the provider.
    return {
      stateCode: DEFAULT_STATE,
      setStateCode: () => {},
      info: getStateInfo(DEFAULT_STATE),
      hasStandards: hasStandardsFor(DEFAULT_STATE),
    };
  }
  return ctx;
}
