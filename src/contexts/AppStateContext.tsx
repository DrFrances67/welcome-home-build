import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  type StateCode,
  type StateInfo,
  DEFAULT_STATE,
  getStateInfo,
  hasStandards as hasStandardsFor,
  setActiveStateCode,
} from "@/data/state-standards";

const STORAGE_KEY = "tst-selected-state";

interface AppStateContextValue {
  stateCode: StateCode;
  setStateCode: (code: StateCode) => void;
  info: StateInfo;
  /** Whether the selected state has standards loaded. */
  hasStandards: boolean;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

function readInitialState(): StateCode {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) as StateCode | null;
    if (saved && ["CT", "NJ", "NY", "PA"].includes(saved)) return saved;
  } catch {
    /* ignore */
  }
  return DEFAULT_STATE;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [stateCode, setStateCodeRaw] = useState<StateCode>(readInitialState);

  // Keep the module-level active state in sync on every render so non-component
  // helpers (worksheet-utils, AI prompt builders) read the selected state.
  setActiveStateCode(stateCode);

  const setStateCode = useCallback((code: StateCode) => {
    setActiveStateCode(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore */
    }
    setStateCodeRaw(code);
  }, []);

  const value: AppStateContextValue = {
    stateCode,
    setStateCode,
    info: getStateInfo(stateCode),
    hasStandards: hasStandardsFor(stateCode),
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

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
