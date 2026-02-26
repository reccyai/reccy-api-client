import { describe, expect, it } from "bun:test";
import { resolveAuth } from "./authResolver";

describe("authResolver", () => {
  it("maps bearer auth to Authorization header", () => {
    const auth = resolveAuth({ type: "bearer", token: "token-1" });
    expect(auth.headers.Authorization).toBe("Bearer token-1");
  });

  it("maps basic auth to base64 Authorization header", () => {
    const auth = resolveAuth({
      type: "basic",
      username: "jamie",
      password: "secret",
    });
    expect(auth.headers.Authorization).toBe("Basic amFtaWU6c2VjcmV0");
  });

  it("maps API key auth to query params", () => {
    const auth = resolveAuth({
      type: "apikey",
      key: "api_key",
      value: "abc",
      placement: "query",
    });
    expect(auth.query.get("api_key")).toBe("abc");
  });
});
