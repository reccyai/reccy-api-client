import type { HttpMethod, RequestBodyType } from "../domain/types";

export type OpenCollectionInfo = {
  name: string;
  type: "http" | "folder";
  seq: number;
  tags?: string[];
};

export type OpenCollectionHeader = {
  name: string;
  value: string;
  disabled?: boolean;
};

export type OpenCollectionParam = {
  name: string;
  value: string;
  type: "query" | "path";
  disabled?: boolean;
};

export type OpenCollectionBody = {
  type: Exclude<RequestBodyType, "none">;
  data: string;
};

export type OpenCollectionAuth =
  | "inherit"
  | { type: "none" }
  | { type: "bearer"; token: string }
  | { type: "basic"; username: string; password: string }
  | {
      type: "apikey";
      key: string;
      value: string;
      placement: "header" | "query";
    };

export type OpenCollectionHttp = {
  method: HttpMethod;
  url: string;
  headers?: OpenCollectionHeader[];
  params?: OpenCollectionParam[];
  body?: OpenCollectionBody;
  auth?: OpenCollectionAuth;
};

export type OpenCollectionRuntime = {
  scripts?: Array<{ type: string; code: string }>;
  assertions?: Array<{ expression: string; operator: string; value?: string }>;
};

export type OpenCollectionSettings = {
  encodeUrl?: boolean;
  timeout?: number;
  followRedirects?: boolean;
  maxRedirects?: number;
};

export type OpenCollectionRequestDocument = {
  info: OpenCollectionInfo;
  http: OpenCollectionHttp;
  runtime?: OpenCollectionRuntime;
  settings?: OpenCollectionSettings;
  docs?: string;
};

export type OpenCollectionRootDocument = {
  version: string;
  name: string;
  type: "collection";
};
