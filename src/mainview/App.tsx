import { useEffect, useMemo, useState } from "react";
import type {
  ApiRequest,
  AuthConfig,
  HttpMethod,
  Project,
} from "./domain/types";
import {
  createRequest,
  deleteRequest,
  openProject,
  saveRequest,
} from "./services/projectStorage";
import {
  executeRequest,
  type ExecutionResult,
} from "./services/requestExecutor";

const methods: HttpMethod[] = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
];

function requestToHeadersText(request: ApiRequest): string {
  return request.headers
    .map((header) => `${header.name}: ${header.value}`)
    .join("\n");
}

function requestToParamsText(request: ApiRequest): string {
  return request.params
    .filter((param) => param.type === "query")
    .map((param) => `${param.name}=${param.value}`)
    .join("\n");
}

function parseHeaders(text: string): ApiRequest["headers"] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(":");
      if (separator < 0) {
        return { name: line, value: "" };
      }
      return {
        name: line.slice(0, separator).trim(),
        value: line.slice(separator + 1).trim(),
      };
    });
}

function parseParams(text: string): ApiRequest["params"] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf("=");
      if (separator < 0) {
        return { name: line, value: "", type: "query" as const };
      }
      return {
        name: line.slice(0, separator).trim(),
        value: line.slice(separator + 1).trim(),
        type: "query" as const,
      };
    });
}

function prettyBody(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function useDraftRequest(selectedRequest: ApiRequest | null) {
  const [draftRequest, setDraftRequest] = useState<ApiRequest | null>(null);
  const [headersText, setHeadersText] = useState("");
  const [paramsText, setParamsText] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!selectedRequest) {
      setDraftRequest(null);
      setHeadersText("");
      setParamsText("");
      setDirty(false);
      return;
    }

    setDraftRequest(structuredClone(selectedRequest));
    setHeadersText(requestToHeadersText(selectedRequest));
    setParamsText(requestToParamsText(selectedRequest));
    setDirty(false);
  }, [selectedRequest?.id]);

  function updateDraft(mutator: (current: ApiRequest) => ApiRequest) {
    setDraftRequest((previous) => {
      if (!previous) {
        return previous;
      }
      setDirty(true);
      return mutator(previous);
    });
  }

  return {
    draftRequest,
    setDraftRequest,
    headersText,
    setHeadersText,
    paramsText,
    setParamsText,
    dirty,
    setDirty,
    updateDraft,
  };
}

function App() {
  const [projectPathInput, setProjectPathInput] = useState("");
  const [project, setProject] = useState<Project | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    null,
  );
  const [response, setResponse] = useState<ExecutionResult | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRequest = useMemo(() => {
    if (!project || !selectedRequestId) {
      return null;
    }
    return (
      project.collection.requests.find(
        (request) => request.id === selectedRequestId,
      ) ?? null
    );
  }, [project, selectedRequestId]);

  const {
    draftRequest,
    setDraftRequest,
    headersText,
    setHeadersText,
    paramsText,
    setParamsText,
    dirty,
    setDirty,
    updateDraft,
  } = useDraftRequest(selectedRequest);

  async function handleOpenProject() {
    if (!projectPathInput.trim()) {
      setError("Enter a valid project path.");
      return;
    }

    setLoadingProject(true);
    setError(null);
    try {
      const openedProject = await openProject(projectPathInput.trim());
      setProject(openedProject);
      setSelectedRequestId(openedProject.collection.requests[0]?.id ?? null);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoadingProject(false);
    }
  }

  async function handleCreateRequest() {
    if (!project) {
      return;
    }

    const name = window.prompt("Request name", "New Request")?.trim();
    if (!name) {
      return;
    }

    try {
      const newRequest = await createRequest(project.collection.rootPath, name);
      setProject((previous) => {
        if (!previous) {
          return previous;
        }
        return {
          ...previous,
          collection: {
            ...previous.collection,
            requests: [...previous.collection.requests, newRequest].sort(
              (a, b) => a.seq - b.seq || a.name.localeCompare(b.name),
            ),
          },
        };
      });
      setSelectedRequestId(newRequest.id);
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  }

  async function handleDeleteRequest() {
    if (!project || !selectedRequest) {
      return;
    }

    if (!window.confirm(`Delete request "${selectedRequest.name}"?`)) {
      return;
    }

    try {
      await deleteRequest(
        project.collection.rootPath,
        selectedRequest.filePath,
      );
      setProject((previous) => {
        if (!previous) {
          return previous;
        }

        const nextRequests = previous.collection.requests.filter(
          (request) => request.id !== selectedRequest.id,
        );
        setSelectedRequestId(nextRequests[0]?.id ?? null);
        return {
          ...previous,
          collection: {
            ...previous.collection,
            requests: nextRequests,
          },
        };
      });
    } catch (requestError) {
      setError((requestError as Error).message);
    }
  }

  async function handleSave() {
    if (!project || !draftRequest) {
      return;
    }

    const payload: ApiRequest = {
      ...draftRequest,
      headers: parseHeaders(headersText),
      params: parseParams(paramsText),
    };

    setSaving(true);
    setError(null);
    try {
      await saveRequest(project.collection.rootPath, payload);
      setProject((previous) => {
        if (!previous) {
          return previous;
        }
        return {
          ...previous,
          collection: {
            ...previous.collection,
            requests: previous.collection.requests.map((request) =>
              request.id === payload.id ? payload : request,
            ),
          },
        };
      });
      setDraftRequest(payload);
      setDirty(false);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!draftRequest) {
      return;
    }

    const payload: ApiRequest = {
      ...draftRequest,
      headers: parseHeaders(headersText),
      params: parseParams(paramsText),
    };

    setSending(true);
    setError(null);
    try {
      setResponse(await executeRequest(payload));
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSave();
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void handleSend();
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        void handleCreateRequest();
      }
    };

    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });

  const auth = draftRequest?.auth ?? ({ type: "none" } satisfies AuthConfig);

  return (
    <div className="h-screen bg-slate-900 text-slate-100 flex flex-col">
      <header className="border-b border-slate-700 px-4 py-3 flex items-center gap-3">
        <h1 className="text-lg font-semibold">Reccy API Client</h1>
        <input
          value={projectPathInput}
          onChange={(event) => setProjectPathInput(event.target.value)}
          className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm"
          placeholder="/path/to/repo-backed-opencollection"
        />
        <button
          onClick={handleOpenProject}
          disabled={loadingProject}
          className="bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60 text-white px-3 py-2 rounded text-sm"
        >
          {loadingProject ? "Opening..." : "Open / Create Project"}
        </button>
      </header>

      {error && (
        <div className="px-4 py-2 text-sm bg-red-500/20 text-red-200">
          {error}
        </div>
      )}

      <div className="flex-1 grid grid-cols-[260px_1fr_420px] min-h-0">
        <aside className="border-r border-slate-700 p-3 overflow-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-slate-400">Collection</p>
              <p className="font-medium">
                {project?.collection.name ?? "No project loaded"}
              </p>
            </div>
            <button
              onClick={handleCreateRequest}
              disabled={!project}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded px-2 py-1 text-xs"
            >
              New Request
            </button>
          </div>

          <div className="space-y-1">
            {project?.collection.requests.map((request) => (
              <button
                key={request.id}
                onClick={() => setSelectedRequestId(request.id)}
                className={`w-full text-left rounded px-2 py-2 text-sm ${
                  request.id === selectedRequestId
                    ? "bg-indigo-500/25 border border-indigo-400/60"
                    : "hover:bg-slate-800 border border-transparent"
                }`}
              >
                <div className="font-medium">{request.name}</div>
                <div className="text-xs text-slate-400">
                  {request.method} {request.filePath}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="p-4 overflow-auto space-y-4">
          <div className="flex gap-2 items-center">
            <select
              value={draftRequest?.method ?? "GET"}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  method: event.target.value as HttpMethod,
                }))
              }
              className="bg-slate-800 border border-slate-700 rounded px-2 py-2"
              disabled={!draftRequest}
            >
              {methods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
            <input
              value={draftRequest?.url ?? ""}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  url: event.target.value,
                }))
              }
              placeholder="https://api.example.com/resource"
              disabled={!draftRequest}
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2"
            />
            <button
              onClick={handleSend}
              disabled={!draftRequest || sending}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-medium px-3 py-2 rounded"
            >
              {sending ? "Sending..." : "Send"}
            </button>
            <button
              onClick={handleSave}
              disabled={!draftRequest || saving}
              className="bg-blue-500 hover:bg-blue-400 disabled:opacity-60 text-slate-950 font-medium px-3 py-2 rounded"
            >
              {saving ? "Saving..." : dirty ? "Save *" : "Save"}
            </button>
            <button
              onClick={handleDeleteRequest}
              disabled={!selectedRequest}
              className="bg-rose-500 hover:bg-rose-400 disabled:opacity-60 text-slate-950 font-medium px-3 py-2 rounded"
            >
              Delete
            </button>
          </div>

          {draftRequest ? (
            <div className="space-y-3">
              <input
                value={draftRequest.name}
                onChange={(event) =>
                  updateDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                placeholder="Request name"
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-400 mb-1">
                    Headers (`name: value`)
                  </p>
                  <textarea
                    value={headersText}
                    onChange={(event) => {
                      setHeadersText(event.target.value);
                      setDirty(true);
                    }}
                    className="w-full h-32 bg-slate-800 border border-slate-700 rounded px-3 py-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">
                    Query Params (`name=value`)
                  </p>
                  <textarea
                    value={paramsText}
                    onChange={(event) => {
                      setParamsText(event.target.value);
                      setDirty(true);
                    }}
                    className="w-full h-32 bg-slate-800 border border-slate-700 rounded px-3 py-2 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="border border-slate-700 rounded p-3 space-y-2">
                <p className="text-sm font-medium">Auth</p>
                <select
                  value={auth.type}
                  onChange={(event) =>
                    updateDraft((current) => {
                      const type = event.target.value as AuthConfig["type"];
                      const nextAuth: AuthConfig =
                        type === "bearer"
                          ? { type: "bearer", token: "" }
                          : type === "basic"
                            ? { type: "basic", username: "", password: "" }
                            : type === "apikey"
                              ? {
                                  type: "apikey",
                                  key: "x-api-key",
                                  value: "",
                                  placement: "header",
                                }
                              : type === "inherit"
                                ? { type: "inherit" }
                                : { type: "none" };
                      return { ...current, auth: nextAuth };
                    })
                  }
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-2"
                >
                  <option value="none">none</option>
                  <option value="inherit">inherit</option>
                  <option value="bearer">bearer</option>
                  <option value="basic">basic</option>
                  <option value="apikey">apikey</option>
                </select>

                {auth.type === "bearer" && (
                  <input
                    value={auth.token}
                    onChange={(event) =>
                      updateDraft((current) => ({
                        ...current,
                        auth: { type: "bearer", token: event.target.value },
                      }))
                    }
                    placeholder="Bearer token"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2"
                  />
                )}

                {auth.type === "basic" && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={auth.username}
                      onChange={(event) =>
                        updateDraft((current) => ({
                          ...current,
                          auth: {
                            type: "basic",
                            username: event.target.value,
                            password: auth.password,
                          },
                        }))
                      }
                      placeholder="Username"
                      className="bg-slate-800 border border-slate-700 rounded px-3 py-2"
                    />
                    <input
                      value={auth.password}
                      onChange={(event) =>
                        updateDraft((current) => ({
                          ...current,
                          auth: {
                            type: "basic",
                            username: auth.username,
                            password: event.target.value,
                          },
                        }))
                      }
                      placeholder="Password"
                      type="password"
                      className="bg-slate-800 border border-slate-700 rounded px-3 py-2"
                    />
                  </div>
                )}

                {auth.type === "apikey" && (
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      value={auth.key}
                      onChange={(event) =>
                        updateDraft((current) => ({
                          ...current,
                          auth: { ...auth, key: event.target.value },
                        }))
                      }
                      placeholder="Key"
                      className="bg-slate-800 border border-slate-700 rounded px-3 py-2"
                    />
                    <input
                      value={auth.value}
                      onChange={(event) =>
                        updateDraft((current) => ({
                          ...current,
                          auth: { ...auth, value: event.target.value },
                        }))
                      }
                      placeholder="Value"
                      className="bg-slate-800 border border-slate-700 rounded px-3 py-2"
                    />
                    <select
                      value={auth.placement}
                      onChange={(event) =>
                        updateDraft((current) => ({
                          ...current,
                          auth: {
                            ...auth,
                            placement: event.target.value as "header" | "query",
                          },
                        }))
                      }
                      className="bg-slate-800 border border-slate-700 rounded px-3 py-2"
                    >
                      <option value="header">header</option>
                      <option value="query">query</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs text-slate-400 mb-1">Body</p>
                <textarea
                  value={draftRequest.body.data}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      body: {
                        ...current.body,
                        type: "json",
                        data: event.target.value,
                      },
                    }))
                  }
                  className="w-full h-44 bg-slate-800 border border-slate-700 rounded px-3 py-2 font-mono text-xs"
                  placeholder='{"hello":"world"}'
                />
              </div>
            </div>
          ) : (
            <div className="text-slate-400">Select or create a request.</div>
          )}
        </main>

        <aside className="border-l border-slate-700 p-4 overflow-auto">
          <h2 className="font-semibold mb-3">Response</h2>
          {response ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-800 rounded p-2">
                  <p className="text-xs text-slate-400">Status</p>
                  <p>
                    {response.status} {response.statusText}
                  </p>
                </div>
                <div className="bg-slate-800 rounded p-2">
                  <p className="text-xs text-slate-400">Duration</p>
                  <p>{Math.round(response.durationMs)}ms</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Headers</p>
                <pre className="bg-slate-800 rounded p-2 text-xs whitespace-pre-wrap">
                  {response.headers
                    .map(([key, value]) => `${key}: ${value}`)
                    .join("\n")}
                </pre>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Body</p>
                <pre className="bg-slate-800 rounded p-2 text-xs whitespace-pre-wrap overflow-auto max-h-[50vh]">
                  {prettyBody(response.body)}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">
              Send a request to inspect status, headers, and response body.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

export default App;
