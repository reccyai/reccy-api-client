import type { ApiRequest } from "../domain/types";
import { resolveAuth } from "./authResolver";

export type ExecutionResult = {
  status: number;
  statusText: string;
  durationMs: number;
  headers: Array<[string, string]>;
  body: string;
};

function buildUrl(request: ApiRequest): string {
  const url = new URL(request.url);

  for (const param of request.params) {
    if (param.disabled || param.type !== "query" || !param.name) {
      continue;
    }
    url.searchParams.set(param.name, param.value);
  }

  const auth = resolveAuth(request.auth);
  for (const [key, value] of auth.query.entries()) {
    url.searchParams.set(key, value);
  }

  return request.settings.encodeUrl
    ? url.toString()
    : decodeURI(url.toString());
}

function buildHeaders(request: ApiRequest): Headers {
  const headers = new Headers();

  for (const header of request.headers) {
    if (header.disabled || !header.name) {
      continue;
    }
    headers.set(header.name, header.value);
  }

  const auth = resolveAuth(request.auth);
  for (const [key, value] of Object.entries(auth.headers)) {
    headers.set(key, value);
  }

  return headers;
}

function buildBody(request: ApiRequest): string | undefined {
  if (
    request.body.type === "none" ||
    request.method === "GET" ||
    request.method === "HEAD"
  ) {
    return undefined;
  }

  return request.body.data;
}

export async function executeRequest(
  request: ApiRequest,
): Promise<ExecutionResult> {
  const controller = new AbortController();
  const timeoutMs = request.settings.timeout;
  const timeoutHandle =
    timeoutMs > 0
      ? setTimeout(() => controller.abort("Request timed out"), timeoutMs)
      : null;

  try {
    const startedAt = performance.now();
    const response = await fetch(buildUrl(request), {
      method: request.method,
      headers: buildHeaders(request),
      body: buildBody(request),
      redirect: request.settings.followRedirects ? "follow" : "manual",
      signal: controller.signal,
    });
    const durationMs = performance.now() - startedAt;
    const body = await response.text();

    return {
      status: response.status,
      statusText: response.statusText,
      durationMs,
      headers: Array.from(response.headers.entries()),
      body,
    };
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
