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

function methodColor(method: HttpMethod): string {
  if (method === "GET") return "text-emerald-400";
  if (method === "POST") return "text-blue-400";
  if (method === "PUT" || method === "PATCH") return "text-amber-400";
  if (method === "DELETE") return "text-rose-400";
  return "text-slate-300";
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
    <div className="h-screen bg-[#0f1117] text-slate-200 flex flex-col">
      <header className="h-10 border-b border-[#2b2e3a] bg-[#11141b] px-3 flex items-center gap-2">
        <div className="text-sm font-semibold tracking-wide text-slate-100">
          Reccy
        </div>
        <div className="h-4 w-px bg-[#2b2e3a]" />
        <div className="text-xs text-slate-400">OpenCollection</div>
        <input
          value={projectPathInput}
          onChange={(event) => setProjectPathInput(event.target.value)}
          className="ml-3 flex-1 h-7 bg-[#0d1016] border border-[#2b2e3a] rounded px-2 text-xs text-slate-200"
          placeholder="/path/to/repo-backed-opencollection"
        />
        <button
          onClick={handleOpenProject}
          disabled={loadingProject}
          className="h-7 px-3 rounded bg-[#202b45] text-xs text-slate-100 border border-[#3a4767] hover:bg-[#2a3859] disabled:opacity-60"
        >
          {loadingProject ? "Opening..." : "Open"}
        </button>
      </header>

      {error && (
        <div className="px-3 py-1 text-xs bg-rose-500/15 border-b border-rose-500/30 text-rose-200">
          {error}
        </div>
      )}

      <div className="flex-1 grid grid-cols-[240px_1fr_420px] min-h-0">
        <aside className="bg-[#0d1016] border-r border-[#2b2e3a] min-h-0 flex flex-col">
          <div className="px-3 py-2 border-b border-[#2b2e3a] flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">
                Collections
              </p>
              <p className="text-sm text-slate-200 truncate max-w-[150px]">
                {project?.collection.name ?? "My Workspace"}
              </p>
            </div>
            <button
              onClick={handleCreateRequest}
              disabled={!project}
              className="h-6 px-2 rounded border border-[#2b2e3a] bg-[#151924] hover:bg-[#1a2030] text-xs disabled:opacity-50"
            >
              +
            </button>
          </div>

          <div className="p-2 overflow-auto space-y-1">
            {project?.collection.requests.map((request) => (
              <button
                key={request.id}
                onClick={() => setSelectedRequestId(request.id)}
                className={`w-full text-left rounded px-2 py-1.5 border ${
                  request.id === selectedRequestId
                    ? "bg-[#1b2232] border-[#3c4a6a]"
                    : "bg-transparent border-transparent hover:bg-[#151924]"
                }`}
              >
                <div className="text-xs flex items-center gap-2">
                  <span
                    className={`font-semibold ${methodColor(request.method)}`}
                  >
                    {request.method}
                  </span>
                  <span className="text-slate-300 truncate">
                    {request.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">
                  {request.filePath}
                </p>
              </button>
            ))}
            {!project?.collection.requests.length && (
              <p className="text-xs text-slate-500 p-2">No requests yet.</p>
            )}
          </div>
        </aside>

        <main className="min-h-0 flex flex-col bg-[#11141b] border-r border-[#2b2e3a]">
          <div className="h-8 border-b border-[#2b2e3a] px-3 flex items-center gap-3 text-xs text-slate-400">
            <span>{project?.collection.name ?? "Collection"}</span>
            <span>/</span>
            <span className="text-slate-200">
              {draftRequest?.name ?? "Untitled Request"}
            </span>
            <span className="ml-auto text-slate-500">
              {dirty ? "Modified" : "Saved"}
            </span>
          </div>

          <div className="h-9 border-b border-[#2b2e3a] px-2 flex items-end gap-1">
            <button className="h-8 px-3 rounded-t border border-b-0 border-[#3c4a6a] bg-[#1b2232] text-xs text-slate-200">
              {draftRequest?.name ?? "Request"}
            </button>
            <button className="h-8 px-2 rounded-t border border-b-0 border-transparent bg-transparent text-xs text-slate-500">
              +
            </button>
          </div>

          <div className="p-3 border-b border-[#2b2e3a] flex items-center gap-2">
            <select
              value={draftRequest?.method ?? "GET"}
              onChange={(event) =>
                updateDraft((current) => ({
                  ...current,
                  method: event.target.value as HttpMethod,
                }))
              }
              className="h-8 min-w-24 bg-[#0d1016] border border-[#2b2e3a] rounded px-2 text-xs font-semibold text-emerald-300"
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
              className="h-8 flex-1 bg-[#0d1016] border border-[#2b2e3a] rounded px-3 text-xs"
            />
            <button
              onClick={handleSend}
              disabled={!draftRequest || sending}
              className="h-8 px-3 rounded bg-[#23472c] border border-[#2f643b] text-emerald-100 text-xs font-semibold hover:bg-[#2c5a39] disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send"}
            </button>
            <button
              onClick={handleSave}
              disabled={!draftRequest || saving}
              className="h-8 px-3 rounded bg-[#1f2f4c] border border-[#334a74] text-blue-100 text-xs font-semibold hover:bg-[#2a3d61] disabled:opacity-60"
            >
              {saving ? "Saving..." : dirty ? "Save *" : "Save"}
            </button>
            <button
              onClick={handleDeleteRequest}
              disabled={!selectedRequest}
              className="h-8 px-3 rounded bg-[#422126] border border-[#6a303a] text-rose-100 text-xs font-semibold hover:bg-[#572c33] disabled:opacity-60"
            >
              Delete
            </button>
          </div>

          <div className="h-9 border-b border-[#2b2e3a] px-3 flex items-center gap-4 text-xs">
            <button className="text-amber-300 border-b border-amber-300 pb-1">
              Query
            </button>
            <button className="text-slate-400 hover:text-slate-200">
              Body
            </button>
            <button className="text-slate-400 hover:text-slate-200">
              Headers
            </button>
            <button className="text-slate-400 hover:text-slate-200">
              Auth
            </button>
            <button className="text-slate-500 hover:text-slate-300 ml-auto">
              Script
            </button>
          </div>

          <div className="flex-1 min-h-0 p-3">
            {draftRequest ? (
              <div className="h-full grid grid-rows-[min-content_min-content_1fr] gap-3">
                <input
                  value={draftRequest.name}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  className="h-8 w-full bg-[#0d1016] border border-[#2b2e3a] rounded px-3 text-xs"
                  placeholder="Request name"
                />

                <div className="border border-[#2b2e3a] rounded bg-[#0d1016] p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">Auth</span>
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
                      className="h-7 bg-[#11141b] border border-[#2b2e3a] rounded px-2 text-xs"
                    >
                      <option value="none">none</option>
                      <option value="inherit">inherit</option>
                      <option value="bearer">bearer</option>
                      <option value="basic">basic</option>
                      <option value="apikey">apikey</option>
                    </select>
                  </div>

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
                      className="w-full h-8 bg-[#11141b] border border-[#2b2e3a] rounded px-3 text-xs"
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
                        className="h-8 bg-[#11141b] border border-[#2b2e3a] rounded px-3 text-xs"
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
                        className="h-8 bg-[#11141b] border border-[#2b2e3a] rounded px-3 text-xs"
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
                        className="h-8 bg-[#11141b] border border-[#2b2e3a] rounded px-3 text-xs"
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
                        className="h-8 bg-[#11141b] border border-[#2b2e3a] rounded px-3 text-xs"
                      />
                      <select
                        value={auth.placement}
                        onChange={(event) =>
                          updateDraft((current) => ({
                            ...current,
                            auth: {
                              ...auth,
                              placement: event.target.value as
                                | "header"
                                | "query",
                            },
                          }))
                        }
                        className="h-8 bg-[#11141b] border border-[#2b2e3a] rounded px-3 text-xs"
                      >
                        <option value="header">header</option>
                        <option value="query">query</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 min-h-0">
                  <div className="min-h-0 flex flex-col">
                    <p className="text-[11px] text-slate-400 mb-1">
                      Query Params
                    </p>
                    <textarea
                      value={paramsText}
                      onChange={(event) => {
                        setParamsText(event.target.value);
                        setDirty(true);
                      }}
                      className="flex-1 min-h-0 bg-[#0d1016] border border-[#2b2e3a] rounded px-3 py-2 font-mono text-xs"
                    />
                  </div>
                  <div className="min-h-0 flex flex-col">
                    <p className="text-[11px] text-slate-400 mb-1">
                      Headers / Body
                    </p>
                    <textarea
                      value={
                        headersText +
                        (headersText && draftRequest.body.data ? "\n\n" : "") +
                        draftRequest.body.data
                      }
                      onChange={(event) => {
                        const [nextHeaders, ...bodyChunks] =
                          event.target.value.split("\n\n");
                        setHeadersText(nextHeaders ?? "");
                        updateDraft((current) => ({
                          ...current,
                          body: {
                            ...current.body,
                            type: "json",
                            data: bodyChunks.join("\n\n"),
                          },
                        }));
                        setDirty(true);
                      }}
                      className="flex-1 min-h-0 bg-[#0d1016] border border-[#2b2e3a] rounded px-3 py-2 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full grid place-items-center text-sm text-slate-500">
                Select or create a request.
              </div>
            )}
          </div>
        </main>

        <aside className="min-h-0 flex flex-col bg-[#0f1117]">
          <div className="h-9 border-b border-[#2b2e3a] px-3 flex items-center gap-4 text-xs">
            <button className="text-slate-100 border-b border-slate-200 pb-1">
              Response
            </button>
            <button className="text-slate-500 hover:text-slate-300">
              Headers
            </button>
            <button className="text-slate-500 hover:text-slate-300">
              Timeline
            </button>
            <button className="text-slate-500 hover:text-slate-300">
              Tests
            </button>
            {response && (
              <span className="ml-auto text-emerald-400">
                {response.status} {Math.round(response.durationMs)}ms
              </span>
            )}
          </div>

          <div className="p-3 border-b border-[#2b2e3a] text-xs text-slate-400 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-[#151924] border border-[#2b2e3a] text-slate-300">
              JSON
            </span>
            <span>{response?.headers.length ?? 0} headers</span>
          </div>

          <div className="flex-1 min-h-0 p-3 overflow-auto">
            {response ? (
              <pre className="text-xs whitespace-pre-wrap break-words font-mono text-slate-200">
                {prettyBody(response.body)}
              </pre>
            ) : (
              <p className="text-sm text-slate-500">
                Send a request to inspect status, headers, and response body.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
