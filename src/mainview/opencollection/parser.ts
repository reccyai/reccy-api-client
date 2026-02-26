import { parse, stringify } from "yaml";
import type {
  OpenCollectionRequestDocument,
  OpenCollectionRootDocument,
} from "./schema";

export const OPEN_COLLECTION_FILE = "opencollection.yml";
const supportedHttpMethods = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
  "TRACE",
  "CONNECT",
]);
const supportedAuthTypes = new Set([
  "none",
  "inherit",
  "basic",
  "bearer",
  "apikey",
  "digest",
  "oauth2",
  "awsv4",
  "ntlm",
]);
const supportedBodyTypes = new Set([
  "json",
  "text",
  "xml",
  "form-urlencoded",
  "multipart-form",
  "graphql",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseOpenCollectionRoot(
  content: string,
): OpenCollectionRootDocument {
  const parsed = parse(content);

  if (!isObject(parsed)) {
    throw new Error("Invalid opencollection.yml: expected an object.");
  }

  if (parsed.type !== "collection") {
    throw new Error("Invalid opencollection.yml: type must be 'collection'.");
  }

  if (typeof parsed.name !== "string" || !parsed.name.trim()) {
    throw new Error(
      "Invalid opencollection.yml: name must be a non-empty string.",
    );
  }

  return {
    version:
      typeof parsed.version === "string" && parsed.version.trim()
        ? parsed.version
        : "0.1",
    name: parsed.name,
    type: "collection",
  };
}

export function serializeOpenCollectionRoot(name: string): string {
  return stringify({
    version: "0.1",
    name,
    type: "collection",
  });
}

export function parseOpenCollectionRequest(
  content: string,
): OpenCollectionRequestDocument {
  const parsed = parse(content);

  if (!isObject(parsed)) {
    throw new Error("Invalid request YAML: expected an object.");
  }

  if (!isObject(parsed.info) || parsed.info.type !== "http") {
    throw new Error("Invalid request YAML: info.type must be 'http'.");
  }

  if (!isObject(parsed.http)) {
    throw new Error("Invalid request YAML: missing http section.");
  }

  if (
    typeof parsed.http.method !== "string" ||
    typeof parsed.http.url !== "string"
  ) {
    throw new Error(
      "Invalid request YAML: http.method and http.url are required.",
    );
  }

  if (!supportedHttpMethods.has(parsed.http.method)) {
    throw new Error(
      `Invalid request YAML: unsupported http.method '${parsed.http.method}'.`,
    );
  }

  if (parsed.http.headers !== undefined) {
    if (!Array.isArray(parsed.http.headers)) {
      throw new Error("Invalid request YAML: http.headers must be an array.");
    }
  }

  if (parsed.http.params !== undefined) {
    if (!Array.isArray(parsed.http.params)) {
      throw new Error("Invalid request YAML: http.params must be an array.");
    }
  }

  if (parsed.http.body !== undefined) {
    if (
      !isObject(parsed.http.body) ||
      typeof parsed.http.body.type !== "string"
    ) {
      throw new Error(
        "Invalid request YAML: http.body must be an object with a type.",
      );
    }
    if (!supportedBodyTypes.has(parsed.http.body.type)) {
      throw new Error(
        `Invalid request YAML: unsupported http.body.type '${parsed.http.body.type}'.`,
      );
    }
  }

  if (parsed.http.auth !== undefined && parsed.http.auth !== "inherit") {
    if (
      !isObject(parsed.http.auth) ||
      typeof parsed.http.auth.type !== "string"
    ) {
      throw new Error(
        "Invalid request YAML: http.auth must be 'inherit' or an auth object.",
      );
    }
    if (!supportedAuthTypes.has(parsed.http.auth.type)) {
      throw new Error(
        `Invalid request YAML: unsupported http.auth.type '${parsed.http.auth.type}'.`,
      );
    }
  }

  return parsed as OpenCollectionRequestDocument;
}

export function serializeOpenCollectionRequest(
  document: OpenCollectionRequestDocument,
): string {
  return stringify(document);
}
