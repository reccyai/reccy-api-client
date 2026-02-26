import { useEffect, useMemo, useState } from "react";
import {
  AlertDialog,
  Button,
  Dialog,
  ScrollArea,
  Select,
  Tabs,
  Text,
  TextArea,
  TextField,
} from "@radix-ui/themes";
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
} from "./services/requestExecutor";
import { useAppState, type RequestTab, type ResponseTab } from "./state/appState";

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
  const { state, dispatch } = useAppState();
  const {
    projectPathInput,
    project,
    selectedRequestId,
    response,
    loadingProject,
    sending,
    saving,
    error,
    createDialogOpen,
    newRequestName,
    deleteDialogOpen,
    requestTab,
    responseTab,
  } = state;

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
      dispatch({ type: "PATCH", payload: { error: "Enter a valid project path." } });
      return;
    }

    dispatch({ type: "PATCH", payload: { loadingProject: true, error: null } });
    try {
      const openedProject = await openProject(projectPathInput.trim());
      dispatch({
        type: "PATCH",
        payload: {
          project: openedProject,
          selectedRequestId: openedProject.collection.requests[0]?.id ?? null,
        },
      });
    } catch (requestError) {
      dispatch({ type: "PATCH", payload: { error: (requestError as Error).message } });
    } finally {
      dispatch({ type: "PATCH", payload: { loadingProject: false } });
    }
  }

  async function handleCreateRequest(name: string) {
    if (!project) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    try {
      const newRequest = await createRequest(
        project.collection.rootPath,
        trimmedName,
      );
      const nextProject: Project = {
        ...project,
        collection: {
          ...project.collection,
          requests: [...project.collection.requests, newRequest].sort(
            (a, b) => a.seq - b.seq || a.name.localeCompare(b.name),
          ),
        },
      };
      dispatch({
        type: "PATCH",
        payload: {
          project: nextProject,
          selectedRequestId: newRequest.id,
          createDialogOpen: false,
          newRequestName: "New Request",
        },
      });
    } catch (requestError) {
      dispatch({ type: "PATCH", payload: { error: (requestError as Error).message } });
    }
  }

  async function handleDeleteRequest() {
    if (!project || !selectedRequest) {
      return;
    }

    try {
      await deleteRequest(
        project.collection.rootPath,
        selectedRequest.filePath,
      );
      const nextRequests = project.collection.requests.filter(
        (request) => request.id !== selectedRequest.id,
      );
      dispatch({
        type: "PATCH",
        payload: {
          project: {
            ...project,
            collection: {
              ...project.collection,
              requests: nextRequests,
            },
          },
          selectedRequestId: nextRequests[0]?.id ?? null,
          deleteDialogOpen: false,
        },
      });
    } catch (requestError) {
      dispatch({ type: "PATCH", payload: { error: (requestError as Error).message } });
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

    dispatch({ type: "PATCH", payload: { saving: true, error: null } });
    try {
      await saveRequest(project.collection.rootPath, payload);
      dispatch({
        type: "PATCH",
        payload: {
          project: {
            ...project,
            collection: {
              ...project.collection,
              requests: project.collection.requests.map((request) =>
                request.id === payload.id ? payload : request,
              ),
            },
          },
        },
      });
      setDraftRequest(payload);
      setDirty(false);
    } catch (requestError) {
      dispatch({ type: "PATCH", payload: { error: (requestError as Error).message } });
    } finally {
      dispatch({ type: "PATCH", payload: { saving: false } });
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

    dispatch({ type: "PATCH", payload: { sending: true, error: null } });
    try {
      dispatch({ type: "PATCH", payload: { response: await executeRequest(payload) } });
    } catch (requestError) {
      dispatch({ type: "PATCH", payload: { error: (requestError as Error).message } });
    } finally {
      dispatch({ type: "PATCH", payload: { sending: false } });
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
        dispatch({ type: "PATCH", payload: { createDialogOpen: true } });
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
        <TextField.Root
          value={projectPathInput}
          onChange={(event) =>
            dispatch({
              type: "PATCH",
              payload: { projectPathInput: event.target.value },
            })
          }
          className="ml-3 flex-1 h-7 bg-[#0d1016] border border-[#2b2e3a] rounded px-2 text-xs text-slate-200"
          placeholder="/path/to/repo-backed-opencollection"
        />
        <Button
          onClick={handleOpenProject}
          disabled={loadingProject}
          className="h-7 px-3 rounded bg-[#202b45] text-xs text-slate-100 border border-[#3a4767] hover:bg-[#2a3859] disabled:opacity-60"
        >
          {loadingProject ? "Opening..." : "Open"}
        </Button>
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
            <Button
              onClick={() =>
                dispatch({ type: "PATCH", payload: { createDialogOpen: true } })
              }
              disabled={!project}
              className="h-6 px-2 rounded border border-[#2b2e3a] bg-[#151924] hover:bg-[#1a2030] text-xs disabled:opacity-50"
            >
              +
            </Button>
          </div>

          <ScrollArea className="min-h-0 flex-1 p-2">
            <div className="space-y-1">
              {project?.collection.requests.map((request) => (
                <Button
                  key={request.id}
                  onClick={() =>
                    dispatch({
                      type: "PATCH",
                      payload: { selectedRequestId: request.id },
                    })
                  }
                  className={`w-full h-auto text-left rounded px-2 py-1.5 border ${
                    request.id === selectedRequestId
                      ? "bg-[#1b2232] border-[#3c4a6a]"
                      : "bg-transparent border-transparent hover:bg-[#151924]"
                  }`}
                >
                  <div className="text-xs flex items-center gap-2">
                    <span className={`font-semibold ${methodColor(request.method)}`}>
                      {request.method}
                    </span>
                    <span className="text-slate-300 truncate">{request.name}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    {request.filePath}
                  </p>
                </Button>
              ))}
              {!project?.collection.requests.length && (
                <p className="text-xs text-slate-500 p-2">No requests yet.</p>
              )}
            </div>
          </ScrollArea>
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
            <Button
              onClick={() =>
                dispatch({ type: "PATCH", payload: { requestTab: "query" } })
              }
              className="h-8 px-3 rounded-t border border-b-0 border-[#3c4a6a] bg-[#1b2232] text-xs text-slate-200"
            >
              {draftRequest?.name ?? "Request"}
            </Button>
            <Button
              onClick={() =>
                dispatch({ type: "PATCH", payload: { createDialogOpen: true } })
              }
              className="h-8 px-2 rounded-t border border-b-0 border-transparent bg-transparent text-xs text-slate-500"
            >
              +
            </Button>
          </div>

          <div className="p-3 border-b border-[#2b2e3a] flex items-center gap-2">
            <Select.Root
              value={draftRequest?.method ?? "GET"}
              onValueChange={(value) =>
                updateDraft((current) => ({
                  ...current,
                  method: value as HttpMethod,
                }))
              }
              disabled={!draftRequest}
            >
              <Select.Trigger className="h-8 min-w-24 bg-[#0d1016] border border-[#2b2e3a] rounded px-2 text-xs font-semibold text-emerald-300" />
              <Select.Content className="rounded border border-[#2b2e3a] bg-[#11141b] text-slate-200 shadow-lg">
                {methods.map((method) => (
                  <Select.Item key={method} value={method}>
                    {method}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            <TextField.Root
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
            <Button
              onClick={handleSend}
              disabled={!draftRequest || sending}
              className="h-8 px-3 rounded bg-[#23472c] border border-[#2f643b] text-emerald-100 text-xs font-semibold hover:bg-[#2c5a39] disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send"}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!draftRequest || saving}
              className="h-8 px-3 rounded bg-[#1f2f4c] border border-[#334a74] text-blue-100 text-xs font-semibold hover:bg-[#2a3d61] disabled:opacity-60"
            >
              {saving ? "Saving..." : dirty ? "Save *" : "Save"}
            </Button>
            <Button
              onClick={() =>
                dispatch({ type: "PATCH", payload: { deleteDialogOpen: true } })
              }
              disabled={!selectedRequest}
              className="h-8 px-3 rounded bg-[#422126] border border-[#6a303a] text-rose-100 text-xs font-semibold hover:bg-[#572c33] disabled:opacity-60"
            >
              Delete
            </Button>
          </div>

          <Tabs.Root
            value={requestTab}
            onValueChange={(value) =>
              dispatch({ type: "PATCH", payload: { requestTab: value as RequestTab } })
            }
            className="flex-1 min-h-0 flex flex-col"
          >
            <Tabs.List className="h-9 border-b border-[#2b2e3a] px-3 flex items-center gap-4 text-xs">
              <Tabs.Trigger
                value="query"
                className="text-slate-400 border-b border-transparent py-2 data-[state=active]:text-amber-300 data-[state=active]:border-amber-300"
              >
                Query
              </Tabs.Trigger>
              <Tabs.Trigger
                value="body"
                className="text-slate-500 border-b border-transparent py-2 data-[state=active]:text-slate-200 data-[state=active]:border-slate-300"
              >
                Body
              </Tabs.Trigger>
              <Tabs.Trigger
                value="headers"
                className="text-slate-500 border-b border-transparent py-2 data-[state=active]:text-slate-200 data-[state=active]:border-slate-300"
              >
                Headers
              </Tabs.Trigger>
              <Tabs.Trigger
                value="auth"
                className="text-slate-500 border-b border-transparent py-2 data-[state=active]:text-slate-200 data-[state=active]:border-slate-300"
              >
                Auth
              </Tabs.Trigger>
              <Tabs.Trigger
                value="script"
                className="text-slate-500 border-b border-transparent py-2 ml-auto data-[state=active]:text-slate-300 data-[state=active]:border-slate-300"
              >
                Script
              </Tabs.Trigger>
            </Tabs.List>
            <div className="flex-1 min-h-0 p-3">
              {draftRequest ? (
              <div className="h-full grid grid-rows-[min-content_1fr] gap-3">
                <TextField.Root
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
                {requestTab === "query" && (
                  <div className="min-h-0 flex flex-col">
                    <p className="text-[11px] text-slate-400 mb-1">Query Params</p>
                    <TextArea
                      value={paramsText}
                      onChange={(event) => {
                        setParamsText(event.target.value);
                        setDirty(true);
                      }}
                      className="flex-1 min-h-0 bg-[#0d1016] border border-[#2b2e3a] rounded px-3 py-2 font-mono text-xs"
                    />
                  </div>
                )}

                {requestTab === "headers" && (
                  <div className="min-h-0 flex flex-col">
                    <p className="text-[11px] text-slate-400 mb-1">Headers</p>
                    <TextArea
                      value={headersText}
                      onChange={(event) => {
                        setHeadersText(event.target.value);
                        setDirty(true);
                      }}
                      className="flex-1 min-h-0 bg-[#0d1016] border border-[#2b2e3a] rounded px-3 py-2 font-mono text-xs"
                    />
                  </div>
                )}

                {requestTab === "body" && (
                  <div className="min-h-0 flex flex-col">
                    <p className="text-[11px] text-slate-400 mb-1">Body</p>
                    <TextArea
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
                      className="flex-1 min-h-0 bg-[#0d1016] border border-[#2b2e3a] rounded px-3 py-2 font-mono text-xs"
                    />
                  </div>
                )}

                {requestTab === "auth" && (
                  <div className="border border-[#2b2e3a] rounded bg-[#0d1016] p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Text className="text-[11px] text-slate-400">Auth</Text>
                      <Select.Root
                        value={auth.type}
                        onValueChange={(value) =>
                          updateDraft((current) => {
                            const type = value as AuthConfig["type"];
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
                      >
                        <Select.Trigger className="h-7 min-w-28 bg-[#11141b] border border-[#2b2e3a] rounded px-2 text-xs" />
                        <Select.Content className="rounded border border-[#2b2e3a] bg-[#11141b] text-slate-200 shadow-lg">
                          {["none", "inherit", "bearer", "basic", "apikey"].map(
                            (value) => (
                              <Select.Item key={value} value={value}>
                                {value}
                              </Select.Item>
                            ),
                          )}
                        </Select.Content>
                      </Select.Root>
                    </div>

                    {auth.type === "bearer" && (
                      <TextField.Root
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
                        <TextField.Root
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
                        <TextField.Root
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
                        <TextField.Root
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
                        <TextField.Root
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
                        <Select.Root
                          value={auth.placement}
                          onValueChange={(value) =>
                            updateDraft((current) => ({
                              ...current,
                              auth: {
                                ...auth,
                                placement: value as "header" | "query",
                              },
                            }))
                          }
                        >
                          <Select.Trigger className="h-8 bg-[#11141b] border border-[#2b2e3a] rounded px-3 text-xs" />
                          <Select.Content className="rounded border border-[#2b2e3a] bg-[#11141b] text-slate-200 shadow-lg">
                            {["header", "query"].map((value) => (
                              <Select.Item key={value} value={value}>
                                {value}
                              </Select.Item>
                            ))}
                          </Select.Content>
                        </Select.Root>
                      </div>
                    )}
                  </div>
                )}

                {requestTab === "script" && (
                  <div className="h-full grid place-items-center text-sm text-slate-500">
                    Script editor coming soon.
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full grid place-items-center text-sm text-slate-500">
                Select or create a request.
              </div>
            )}
            </div>
          </Tabs.Root>
        </main>

        <aside className="min-h-0 flex flex-col bg-[#0f1117]">
          <Tabs.Root
            value={responseTab}
            onValueChange={(value) =>
              dispatch({
                type: "PATCH",
                payload: { responseTab: value as ResponseTab },
              })
            }
            className="min-h-0 flex flex-col"
          >
            <Tabs.List className="h-9 border-b border-[#2b2e3a] px-3 flex items-center gap-4 text-xs">
              <Tabs.Trigger
                value="response"
                className="text-slate-500 border-b border-transparent py-2 data-[state=active]:text-slate-100 data-[state=active]:border-slate-200"
              >
                Response
              </Tabs.Trigger>
              <Tabs.Trigger
                value="headers"
                className="text-slate-500 border-b border-transparent py-2 data-[state=active]:text-slate-300 data-[state=active]:border-slate-300"
              >
                Headers
              </Tabs.Trigger>
              <Tabs.Trigger
                value="timeline"
                className="text-slate-500 border-b border-transparent py-2 data-[state=active]:text-slate-300 data-[state=active]:border-slate-300"
              >
                Timeline
              </Tabs.Trigger>
              <Tabs.Trigger
                value="tests"
                className="text-slate-500 border-b border-transparent py-2 data-[state=active]:text-slate-300 data-[state=active]:border-slate-300"
              >
                Tests
              </Tabs.Trigger>
              {response && (
                <span className="ml-auto text-emerald-400">
                  {response.status} {Math.round(response.durationMs)}ms
                </span>
              )}
            </Tabs.List>
          </Tabs.Root>

          <div className="p-3 border-b border-[#2b2e3a] text-xs text-slate-400 flex items-center gap-2">
            <Text className="px-2 py-0.5 rounded bg-[#151924] border border-[#2b2e3a] text-slate-300">
              JSON
            </Text>
            <Text>{response?.headers.length ?? 0} headers</Text>
          </div>

          <ScrollArea className="flex-1 min-h-0 p-3">
            {responseTab === "response" && response ? (
              <pre className="text-xs whitespace-pre-wrap break-words font-mono text-slate-200">
                {prettyBody(response.body)}
              </pre>
            ) : responseTab === "response" ? (
              <p className="text-sm text-slate-500">
                Send a request to inspect status, headers, and response body.
              </p>
            ) : null}
            {responseTab === "headers" &&
              (response ? (
                <div className="space-y-1 font-mono text-xs text-slate-300">
                  {response.headers.map(([name, value], index) => (
                    <p key={`${name}-${index}`}>
                      {name}: {value}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No response headers yet.</p>
              ))}
            {responseTab === "timeline" &&
              (response ? (
                <div className="text-sm text-slate-300">
                  Total duration: {Math.round(response.durationMs)}ms
                </div>
              ) : (
                <p className="text-sm text-slate-500">No timeline data yet.</p>
              ))}
            {responseTab === "tests" && (
              <p className="text-sm text-slate-500">
                Tests panel coming soon.
              </p>
            )}
          </ScrollArea>
        </aside>
      </div>

      <Dialog.Root
        open={createDialogOpen}
        onOpenChange={(open) =>
          dispatch({ type: "PATCH", payload: { createDialogOpen: open } })
        }
      >
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[#2b2e3a] bg-[#11141b] p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-sm font-semibold text-slate-100">
                Create request
              </Dialog.Title>
              <Dialog.Close>
                <Button className="h-7 w-7 rounded border border-[#2b2e3a] bg-[#0d1016] text-slate-400 hover:text-slate-200">
                  x
                </Button>
              </Dialog.Close>
            </div>

            <TextField.Root
              value={newRequestName}
              onChange={(event) =>
                dispatch({
                  type: "PATCH",
                  payload: { newRequestName: event.target.value },
                })
              }
              className="mt-3 h-8 w-full bg-[#0d1016] border border-[#2b2e3a] rounded px-3 text-xs"
              placeholder="Request name"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleCreateRequest(newRequestName);
                }
              }}
            />

            <div className="mt-3 flex justify-end gap-2">
              <Dialog.Close>
                <Button className="h-8 px-3 rounded border border-[#2b2e3a] bg-[#151924] text-xs text-slate-200 hover:bg-[#1a2030]">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button
                onClick={() => void handleCreateRequest(newRequestName)}
                className="h-8 px-3 rounded bg-[#1f2f4c] border border-[#334a74] text-blue-100 text-xs font-semibold hover:bg-[#2a3d61]"
              >
                Create
              </Button>
            </div>
        </Dialog.Content>
      </Dialog.Root>

      <AlertDialog.Root
        open={deleteDialogOpen}
        onOpenChange={(open) =>
          dispatch({ type: "PATCH", payload: { deleteDialogOpen: open } })
        }
      >
        <AlertDialog.Content className="fixed left-1/2 top-1/2 w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[#2b2e3a] bg-[#11141b] p-4 shadow-xl">
            <AlertDialog.Title className="text-sm font-semibold text-slate-100">
              Delete request
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-xs text-slate-400">
              {selectedRequest
                ? `Delete "${selectedRequest.name}"? This action cannot be undone.`
                : "No request selected."}
            </AlertDialog.Description>
            <div className="mt-4 flex justify-end gap-2">
              <AlertDialog.Cancel>
                <Button className="h-8 px-3 rounded border border-[#2b2e3a] bg-[#151924] text-xs text-slate-200 hover:bg-[#1a2030]">
                  Cancel
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action>
                <Button
                  onClick={() => void handleDeleteRequest()}
                  className="h-8 px-3 rounded bg-[#422126] border border-[#6a303a] text-rose-100 text-xs font-semibold hover:bg-[#572c33]"
                >
                  Delete
                </Button>
              </AlertDialog.Action>
            </div>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </div>
  );
}

export default App;
