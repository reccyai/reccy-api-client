import type { ApiRequest, Collection, Project } from "../domain/types";
import {
  fromOpenCollectionDocument,
  toOpenCollectionDocument,
} from "../opencollection/adapter";
import {
  parseOpenCollectionRequest,
  serializeOpenCollectionRequest,
} from "../opencollection/parser";
import { bunRequest } from "./rpcClient";

function toCollection(
  rootPath: string,
  collectionName: string,
  requests: Array<{ filePath: string; content: string }>,
): Collection {
  return {
    name: collectionName,
    rootPath,
    requests: requests
      .map((requestFile) =>
        fromOpenCollectionDocument(
          parseOpenCollectionRequest(requestFile.content),
          requestFile.filePath,
        ),
      )
      .sort((a, b) => a.seq - b.seq || a.name.localeCompare(b.name)),
  };
}

export async function openProject(rootPath: string): Promise<Project> {
  const result = await bunRequest().openProject({ rootPath });

  return {
    collection: toCollection(
      result.rootPath,
      result.collectionName,
      result.requests,
    ),
  };
}

export async function saveRequest(
  rootPath: string,
  request: ApiRequest,
): Promise<void> {
  const content = serializeOpenCollectionRequest(
    toOpenCollectionDocument(request),
  );

  await bunRequest().saveRequest({
    rootPath,
    filePath: request.filePath,
    content,
  });
}

export async function createRequest(
  rootPath: string,
  name: string,
): Promise<ApiRequest> {
  const result = await bunRequest().createRequest({ rootPath, name });
  return fromOpenCollectionDocument(
    parseOpenCollectionRequest(result.content),
    result.filePath,
  );
}

export async function deleteRequest(
  rootPath: string,
  filePath: string,
): Promise<void> {
  await bunRequest().deleteRequest({ rootPath, filePath });
}
