import type {
  ApiRequest,
  AuthConfig,
  RequestBody,
  RequestSettings,
} from "../domain/types";
import type {
  OpenCollectionAuth,
  OpenCollectionRequestDocument,
} from "./schema";

const defaultSettings: RequestSettings = {
  encodeUrl: true,
  timeout: 0,
  followRedirects: true,
  maxRedirects: 5,
};

function toDomainAuth(auth: OpenCollectionAuth | undefined): AuthConfig {
  if (auth === "inherit") {
    return { type: "inherit" };
  }

  if (!auth || auth.type === "none") {
    return { type: "none" };
  }

  if (auth.type === "bearer") {
    return { type: "bearer", token: auth.token ?? "" };
  }

  if (auth.type === "basic") {
    return {
      type: "basic",
      username: auth.username ?? "",
      password: auth.password ?? "",
    };
  }

  return {
    type: "apikey",
    key: auth.key ?? "x-api-key",
    value: auth.value ?? "",
    placement: auth.placement === "query" ? "query" : "header",
  };
}

function toOpenCollectionAuth(auth: AuthConfig): OpenCollectionAuth {
  if (auth.type === "inherit") {
    return "inherit";
  }

  if (auth.type === "none") {
    return { type: "none" };
  }

  if (auth.type === "bearer") {
    return { type: "bearer", token: auth.token };
  }

  if (auth.type === "basic") {
    return {
      type: "basic",
      username: auth.username,
      password: auth.password,
    };
  }

  return {
    type: "apikey",
    key: auth.key,
    value: auth.value,
    placement: auth.placement,
  };
}

function toDomainBody(document: OpenCollectionRequestDocument): RequestBody {
  if (!document.http.body) {
    return { type: "none", data: "" };
  }

  return {
    type: document.http.body.type,
    data: document.http.body.data ?? "",
  };
}

function toOpenCollectionBody(body: RequestBody) {
  if (body.type === "none") {
    return undefined;
  }

  return {
    type: body.type,
    data: body.data,
  };
}

export function fromOpenCollectionDocument(
  document: OpenCollectionRequestDocument,
  filePath: string,
): ApiRequest {
  return {
    id: filePath,
    name: document.info.name,
    seq: document.info.seq ?? 0,
    filePath,
    method: document.http.method,
    url: document.http.url,
    headers: document.http.headers ?? [],
    params: document.http.params ?? [],
    body: toDomainBody(document),
    auth: toDomainAuth(document.http.auth),
    settings: {
      encodeUrl: document.settings?.encodeUrl ?? defaultSettings.encodeUrl,
      timeout: document.settings?.timeout ?? defaultSettings.timeout,
      followRedirects:
        document.settings?.followRedirects ?? defaultSettings.followRedirects,
      maxRedirects:
        document.settings?.maxRedirects ?? defaultSettings.maxRedirects,
    },
  };
}

export function toOpenCollectionDocument(
  request: ApiRequest,
): OpenCollectionRequestDocument {
  return {
    info: {
      name: request.name,
      type: "http",
      seq: request.seq,
    },
    http: {
      method: request.method,
      url: request.url,
      headers: request.headers,
      params: request.params,
      body: toOpenCollectionBody(request.body),
      auth: toOpenCollectionAuth(request.auth),
    },
    settings: request.settings,
  };
}

export { defaultSettings };
