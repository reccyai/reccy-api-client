import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import type { Project } from "../domain/types";
import type { ExecutionResult } from "../services/requestExecutor";

export type RequestTab = "query" | "body" | "headers" | "auth" | "script";
export type ResponseTab = "response" | "headers" | "timeline" | "tests";

export type AppState = {
  projectPathInput: string;
  project: Project | null;
  selectedRequestId: string | null;
  response: ExecutionResult | null;
  loadingProject: boolean;
  sending: boolean;
  saving: boolean;
  error: string | null;
  createDialogOpen: boolean;
  newRequestName: string;
  deleteDialogOpen: boolean;
  requestTab: RequestTab;
  responseTab: ResponseTab;
};

export type AppAction = {
  type: "PATCH";
  payload: Partial<AppState>;
};

const initialAppState: AppState = {
  projectPathInput: "",
  project: null,
  selectedRequestId: null,
  response: null,
  loadingProject: false,
  sending: false,
  saving: false,
  error: null,
  createDialogOpen: false,
  newRequestName: "New Request",
  deleteDialogOpen: false,
  requestTab: "query",
  responseTab: "response",
};

function appReducer(state: AppState, action: AppAction): AppState {
  if (action.type === "PATCH") {
    return { ...state, ...action.payload };
  }
  return state;
}

type AppStateContextValue = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used inside AppStateProvider.");
  }
  return context;
}
