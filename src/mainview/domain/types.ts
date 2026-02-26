export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD"
  | "TRACE"
  | "CONNECT";

export type RequestParamType = "query" | "path";

export type RequestParam = {
  name: string;
  value: string;
  type: RequestParamType;
  disabled?: boolean;
};

export type RequestHeader = {
  name: string;
  value: string;
  disabled?: boolean;
};

export type RequestBodyType =
  | "none"
  | "json"
  | "text"
  | "xml"
  | "form-urlencoded"
  | "multipart-form"
  | "graphql";

export type RequestBody = {
  type: RequestBodyType;
  data: string;
};

export type AuthNone = { type: "none" };
export type AuthInherit = { type: "inherit" };
export type AuthBearer = { type: "bearer"; token: string };
export type AuthBasic = { type: "basic"; username: string; password: string };
export type AuthApiKey = {
  type: "apikey";
  key: string;
  value: string;
  placement: "header" | "query";
};

export type AuthConfig =
  | AuthNone
  | AuthInherit
  | AuthBearer
  | AuthBasic
  | AuthApiKey;

export type RequestSettings = {
  encodeUrl: boolean;
  timeout: number;
  followRedirects: boolean;
  maxRedirects: number;
};

export type ApiRequest = {
  id: string;
  name: string;
  seq: number;
  filePath: string;
  method: HttpMethod;
  url: string;
  headers: RequestHeader[];
  params: RequestParam[];
  body: RequestBody;
  auth: AuthConfig;
  settings: RequestSettings;
};

export type Collection = {
  name: string;
  rootPath: string;
  requests: ApiRequest[];
};

export type Environment = {
  name: string;
  variables: Record<string, string>;
};

export type Project = {
  collection: Collection;
  activeEnvironment?: Environment;
};
