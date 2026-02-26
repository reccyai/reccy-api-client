import { describe, expect, it } from "bun:test";
import {
  fromOpenCollectionDocument,
  toOpenCollectionDocument,
} from "./adapter";
import {
  parseOpenCollectionRequest,
  parseOpenCollectionRoot,
  serializeOpenCollectionRequest,
  serializeOpenCollectionRoot,
} from "./parser";

describe("OpenCollection parser", () => {
  it("parses and serializes opencollection.yml", () => {
    const serialized = serializeOpenCollectionRoot("My APIs");
    const parsed = parseOpenCollectionRoot(serialized);

    expect(parsed.type).toBe("collection");
    expect(parsed.name).toBe("My APIs");
  });

  it("round-trips request document via adapter", () => {
    const source = parseOpenCollectionRequest(`
info:
  name: Get Users
  type: http
  seq: 2
http:
  method: GET
  url: https://example.com/users
  auth:
    type: bearer
    token: abc123
settings:
  encodeUrl: true
  timeout: 1500
  followRedirects: true
  maxRedirects: 5
`);

    const domain = fromOpenCollectionDocument(source, "requests/get-users.yml");
    const document = toOpenCollectionDocument(domain);
    const reparsed = parseOpenCollectionRequest(
      serializeOpenCollectionRequest(document),
    );

    expect(reparsed.info.name).toBe("Get Users");
    expect(reparsed.http.method).toBe("GET");
    expect(reparsed.http.auth).toEqual({ type: "bearer", token: "abc123" });
    expect(reparsed.settings?.timeout).toBe(1500);
  });

  it("rejects unsupported HTTP methods", () => {
    expect(() =>
      parseOpenCollectionRequest(`
info:
  name: Bad Request
  type: http
  seq: 1
http:
  method: FETCH
  url: https://example.com
`),
    ).toThrow("unsupported http.method");
  });
});
