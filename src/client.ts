import type {
  Agent,
  Command,
  Config,
  FileDiff,
  MessageWithParts,
  OpenCodeEvent,
  PromptPart,
  Provider,
  Session,
  Todo,
} from "./types"

export interface PromptInput {
  parts: PromptPart[]
  model?: { providerID: string; modelID: string }
  agent?: string
  noReply?: boolean
  system?: string
  messageID?: string
  tools?: Record<string, boolean>
}

export interface ProvidersResult {
  providers: Provider[]
  default: Record<string, string>
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/**
 * opencode 服务端 HTTP 客户端（基于原生 fetch，零运行时依赖）。
 */
export class OpenCodeClient {
  constructor(
    public baseUrl: string,
    public directory?: string,
    private auth?: { username: string; password: string },
  ) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/json" }
    if (this.auth) {
      const token = Buffer.from(`${this.auth.username}:${this.auth.password}`).toString("base64")
      h.Authorization = `Basic ${token}`
    }
    return h
  }

  private qs(params: Record<string, string | undefined>): string {
    const search = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "") search.set(k, v)
    }
    const s = search.toString()
    return s ? `?${s}` : ""
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}${this.directory ? this.qs({ directory: this.directory }) : ""}`
    const res = await fetch(url, {
      ...init,
      headers: { ...this.headers(), ...(init?.headers ?? {}) },
    })
    if (!res.ok) {
      let body = ""
      try {
        body = await res.text()
      } catch {
        /* ignore */
      }
      throw new Error(`opencode 请求失败 (${res.status}): ${body || res.statusText}`)
    }
    const text = await res.text()
    if (!text) return undefined as T
    try {
      return JSON.parse(text) as T
    } catch {
      return text as unknown as T
    }
  }

  health(): Promise<{ healthy: boolean; version?: string }> {
    return this.request<{ healthy: boolean; version?: string }>("/global/health")
  }

  listSessions(): Promise<Session[]> {
    return this.request<Session[]>("/session")
  }

  getSession(id: string): Promise<Session> {
    return this.request<Session>(`/session/${encodeURIComponent(id)}`)
  }

  createSession(body: { parentID?: string; title?: string } = {}): Promise<Session> {
    return this.request<Session>("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  updateSession(id: string, body: { title?: string }): Promise<Session> {
    return this.request<Session>(`/session/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  deleteSession(id: string): Promise<boolean> {
    return this.request<boolean>(`/session/${encodeURIComponent(id)}`, { method: "DELETE" })
  }

  forkSession(id: string, messageID?: string): Promise<Session> {
    return this.request<Session>(`/session/${encodeURIComponent(id)}/fork`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageID }),
    })
  }

  abortSession(id: string): Promise<boolean> {
    return this.request<boolean>(`/session/${encodeURIComponent(id)}/abort`, { method: "POST" })
  }

  shareSession(id: string): Promise<Session> {
    return this.request<Session>(`/session/${encodeURIComponent(id)}/share`, { method: "POST" })
  }

  unshareSession(id: string): Promise<Session> {
    return this.request<Session>(`/session/${encodeURIComponent(id)}/share`, { method: "DELETE" })
  }

  summarizeSession(id: string, body: { providerID: string; modelID: string }): Promise<boolean> {
    return this.request<boolean>(`/session/${encodeURIComponent(id)}/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  revertSession(id: string, body: { messageID: string; partID?: string }): Promise<boolean> {
    return this.request<boolean>(`/session/${encodeURIComponent(id)}/revert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  unrevertSession(id: string): Promise<boolean> {
    return this.request<boolean>(`/session/${encodeURIComponent(id)}/unrevert`, { method: "POST" })
  }

  listMessages(id: string): Promise<MessageWithParts[]> {
    return this.request<MessageWithParts[]>(`/session/${encodeURIComponent(id)}/message`)
  }

  getMessage(id: string, messageID: string): Promise<MessageWithParts> {
    return this.request<MessageWithParts>(
      `/session/${encodeURIComponent(id)}/message/${encodeURIComponent(messageID)}`,
    )
  }

  async prompt(id: string, body: PromptInput): Promise<MessageWithParts> {
    return this.request<MessageWithParts>(`/session/${encodeURIComponent(id)}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  promptAsync(id: string, body: PromptInput): Promise<void> {
    return this.request<void>(`/session/${encodeURIComponent(id)}/prompt_async`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  runCommand(
    id: string,
    body: { command: string; arguments?: string; agent?: string; model?: { providerID: string; modelID: string } },
  ): Promise<MessageWithParts> {
    return this.request<MessageWithParts>(`/session/${encodeURIComponent(id)}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  getTodos(id: string): Promise<Todo[]> {
    return this.request<Todo[]>(`/session/${encodeURIComponent(id)}/todo`)
  }

  getDiff(id: string): Promise<FileDiff[]> {
    return this.request<FileDiff[]>(`/session/${encodeURIComponent(id)}/diff`)
  }

  respondPermission(
    id: string,
    permissionID: string,
    body: { response: "once" | "always" | "reject"; remember?: boolean },
  ): Promise<boolean> {
    return this.request<boolean>(
      `/session/${encodeURIComponent(id)}/permissions/${encodeURIComponent(permissionID)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    )
  }

  providers(): Promise<ProvidersResult> {
    return this.request<ProvidersResult>("/config/providers")
  }

  config(): Promise<Config> {
    return this.request<Config>("/config")
  }

  agents(): Promise<Agent[]> {
    return this.request<Agent[]>("/agent")
  }

  commands(): Promise<Command[]> {
    return this.request<Command[]>("/command")
  }

  readFile(path: string): Promise<{ type: string; content: string }> {
    return this.request<{ type: string; content: string }>(
      `/file/content${this.qs({ path })}`,
    )
  }

  /**
   * 订阅服务端事件流（SSE）。返回一个取消函数。
   * 事件兼容两种格式：`{ type, properties }` 或 `{ payload: { type, properties } }`。
   * 注意：/event 流按项目目录隔离，必须带上 directory 参数才能收到对应项目的事件。
   */
  subscribe(onEvent: (ev: OpenCodeEvent) => void, onError?: (err: Error) => void): () => void {
    const controller = new AbortController()
    const url = `${this.baseUrl}/event${this.directory ? this.qs({ directory: this.directory }) : ""}`
    void (async () => {
      try {
        const res = await fetch(url, {
          headers: { Accept: "text/event-stream", ...this.headers() },
          signal: controller.signal,
        })
        if (!res.ok || !res.body) {
          throw new Error(`事件流连接失败 (${res.status})`)
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() ?? ""
          for (const line of lines) {
            if (!line.startsWith("data:")) continue
            const data = line.slice(5).trim()
            if (!data) continue
            try {
              const obj = JSON.parse(data)
              let ev = obj
              if (isPlainObject(obj) && obj.payload && isPlainObject(obj.payload)) {
                ev = obj.payload
              }
              if (isPlainObject(ev) && typeof ev.type === "string") {
                onEvent(ev as unknown as OpenCodeEvent)
              }
            } catch {
              /* 忽略无法解析的事件 */
            }
          }
        }
        // 流正常结束（服务端主动断开）
        onError?.(new Error("事件流已断开"))
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          onError?.(err as Error)
        }
      }
    })()
    return () => controller.abort()
  }
}
