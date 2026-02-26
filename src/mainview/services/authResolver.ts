import type { AuthConfig } from "../domain/types";

export type ResolvedAuthResult = {
  headers: Record<string, string>;
  query: URLSearchParams;
};

function toBasicToken(username: string, password: string): string {
  return btoa(`${username}:${password}`);
}

export function resolveAuth(auth: AuthConfig): ResolvedAuthResult {
  const result: ResolvedAuthResult = {
    headers: {},
    query: new URLSearchParams(),
  };

  if (auth.type === "bearer" && auth.token) {
    result.headers.Authorization = `Bearer ${auth.token}`;
    return result;
  }

  if (auth.type === "basic") {
    result.headers.Authorization = `Basic ${toBasicToken(auth.username, auth.password)}`;
    return result;
  }

  if (auth.type === "apikey" && auth.key) {
    if (auth.placement === "query") {
      result.query.set(auth.key, auth.value);
    } else {
      result.headers[auth.key] = auth.value;
    }
  }

  return result;
}
