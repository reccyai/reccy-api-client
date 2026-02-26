import { BrowserView, BrowserWindow, Updater } from "electrobun/bun";
import type { ElectrobunRPCSchema } from "electrobun/bun";
import * as path from "node:path";
import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import type { AppRPCSchema } from "../shared/rpcContract";
import {
  OPEN_COLLECTION_FILE,
  parseOpenCollectionRoot,
  serializeOpenCollectionRoot,
} from "../mainview/opencollection/parser";
import { serializeOpenCollectionRequest } from "../mainview/opencollection/parser";
import type { OpenCollectionRequestDocument } from "../mainview/opencollection/schema";

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

const IGNORED_SCAN_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "environments",
]);

function toSafeFileName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "new-request"
  );
}

async function ensureCollectionRoot(rootPath: string): Promise<string> {
  const rootFilePath = path.join(rootPath, OPEN_COLLECTION_FILE);
  try {
    const content = await readFile(rootFilePath, "utf8");
    const parsed = parseOpenCollectionRoot(content);
    return parsed.name;
  } catch {
    const defaultName = path.basename(rootPath);
    await writeFile(
      rootFilePath,
      serializeOpenCollectionRoot(defaultName),
      "utf8",
    );
    return defaultName;
  }
}

async function collectRequestFiles(directoryPath: string): Promise<string[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const collected: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_SCAN_DIRS.has(entry.name)) {
        continue;
      }
      const nested = await collectRequestFiles(absolutePath);
      collected.push(...nested);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".yml")) {
      continue;
    }

    if (entry.name === OPEN_COLLECTION_FILE || entry.name === "folder.yml") {
      continue;
    }

    collected.push(absolutePath);
  }

  return collected;
}

function buildDefaultRequestContent(name: string): string {
  const document: OpenCollectionRequestDocument = {
    info: {
      name,
      type: "http",
      seq: 1,
    },
    http: {
      method: "GET",
      url: "https://echo.usebruno.com/get",
      auth: { type: "none" },
    },
    settings: {
      encodeUrl: true,
      timeout: 0,
      followRedirects: true,
      maxRedirects: 5,
    },
  };

  return serializeOpenCollectionRequest(document);
}

const rpc = BrowserView.defineRPC<AppRPCSchema & ElectrobunRPCSchema>({
  handlers: {
    requests: {
      openProject: async ({ rootPath }) => {
        const resolvedRootPath = path.resolve(rootPath);
        const rootStats = await stat(resolvedRootPath);
        if (!rootStats.isDirectory()) {
          throw new Error("Project path must be a directory.");
        }

        const collectionName = await ensureCollectionRoot(resolvedRootPath);
        const requestFiles = await collectRequestFiles(resolvedRootPath);
        const requests = await Promise.all(
          requestFiles.map(async (filePath) => ({
            filePath: path.relative(resolvedRootPath, filePath),
            content: await readFile(filePath, "utf8"),
          })),
        );

        return {
          rootPath: resolvedRootPath,
          collectionName,
          requests,
        };
      },
      saveRequest: async ({ rootPath, filePath, content }) => {
        const fullPath = path.join(path.resolve(rootPath), filePath);
        await mkdir(path.dirname(fullPath), { recursive: true });
        await writeFile(fullPath, content, "utf8");
        return { ok: true as const };
      },
      createRequest: async ({ rootPath, name }) => {
        const resolvedRootPath = path.resolve(rootPath);
        const requestsDir = path.join(resolvedRootPath, "requests");
        await mkdir(requestsDir, { recursive: true });

        const fileName = `${toSafeFileName(name)}.yml`;
        const relativePath = path.join("requests", fileName);
        const content = buildDefaultRequestContent(name);
        await writeFile(
          path.join(resolvedRootPath, relativePath),
          content,
          "utf8",
        );

        return {
          filePath: relativePath,
          content,
        };
      },
      deleteRequest: async ({ rootPath, filePath }) => {
        const fullPath = path.join(path.resolve(rootPath), filePath);
        await rm(fullPath, { force: true });
        return { ok: true as const };
      },
    },
    messages: {},
  },
});

// Check if Vite dev server is running for HMR
async function getMainViewUrl(): Promise<string> {
  const channel = await Updater.localInfo.channel();
  if (channel === "dev") {
    try {
      await fetch(DEV_SERVER_URL, { method: "HEAD" });
      console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
      return DEV_SERVER_URL;
    } catch {
      console.log(
        "Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
      );
    }
  }
  return "views://mainview/index.html";
}

// Create the main application window
const url = await getMainViewUrl();

new BrowserWindow({
  title: "Reccy API Client",
  url,
  frame: {
    width: 900,
    height: 700,
    x: 200,
    y: 200,
  },
  rpc,
});

console.log("Reccy API client started!");
