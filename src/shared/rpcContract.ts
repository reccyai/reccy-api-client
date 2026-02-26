export type ProjectLoadResult = {
  rootPath: string;
  collectionName: string;
  requests: Array<{
    filePath: string;
    content: string;
  }>;
};

export type SaveRequestInput = {
  rootPath: string;
  filePath: string;
  content: string;
};

export type CreateRequestInput = {
  rootPath: string;
  name: string;
};

export type CreateRequestResult = {
  filePath: string;
  content: string;
};

export type AppRPCSchema = {
  bun: {
    requests: {
      openProject: {
        params: { rootPath: string };
        response: ProjectLoadResult;
      };
      saveRequest: {
        params: SaveRequestInput;
        response: { ok: true };
      };
      createRequest: {
        params: CreateRequestInput;
        response: CreateRequestResult;
      };
      deleteRequest: {
        params: { rootPath: string; filePath: string };
        response: { ok: true };
      };
    };
    messages: {};
  };
  webview: {
    requests: {};
    messages: {};
  };
};
