import { afterAll, describe, expect, it } from "bun:test";
import { executeRequest } from "./requestExecutor";
import type { ApiRequest } from "../domain/types";

const server = Bun.serve({
  port: 0,
  fetch(req) {
    const url = new URL(req.url);
    return new Response(
      JSON.stringify({
        path: url.pathname,
        apiKey: url.searchParams.get("api_key"),
        auth: req.headers.get("authorization"),
      }),
      {
        headers: { "content-type": "application/json" },
      },
    );
  },
});

afterAll(() => {
  server.stop(true);
});

function baseRequest(url: string): ApiRequest {
  return {
    id: "id-1",
    name: "get",
    seq: 1,
    filePath: "requests/get.yml",
    method: "GET",
    url,
    headers: [],
    params: [],
    body: { type: "none", data: "" },
    auth: { type: "none" },
    settings: {
      encodeUrl: true,
      timeout: 1000,
      followRedirects: true,
      maxRedirects: 5,
    },
  };
}

describe("requestExecutor", () => {
  it("executes requests and injects bearer auth", async () => {
    const result = await executeRequest({
      ...baseRequest(`${server.url}users`),
      auth: { type: "bearer", token: "abc" },
    });

    expect(result.status).toBe(200);
    expect(result.body).toContain('"auth":"Bearer abc"');
  });

  it("injects API key auth in query when placement is query", async () => {
    const result = await executeRequest({
      ...baseRequest(`${server.url}orders`),
      auth: {
        type: "apikey",
        key: "api_key",
        value: "secret",
        placement: "query",
      },
    });

    expect(result.status).toBe(200);
    expect(result.body).toContain('"apiKey":"secret"');
  });
});
