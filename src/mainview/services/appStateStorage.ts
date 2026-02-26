import type { PersistedAppState } from "../../shared/rpcContract";
import { bunRequest } from "./rpcClient";

export async function loadAppState(): Promise<PersistedAppState | null> {
  return await bunRequest().loadAppState({});
}

export async function saveAppState(state: PersistedAppState): Promise<void> {
  await bunRequest().saveAppState(state);
}
