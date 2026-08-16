import {
  workspace,
  window,
  Uri,
  ViewColumn,
  commands,
  WorkspaceEdit,
  Range,
  env,
  type Webview,
  type WebviewView,
  type WebviewViewProvider,
  type ExtensionContext,
} from "vscode"
import * as fs from "node:fs"
import * as path from "node:path"
import type { OpenCodeManager } from "./manager"
import type { WebviewCall, WebviewMessage, Snapshot, AttachedFile, UserPrefs, ServerInfo } from "./protocol"

const VIEW_TYPE = "opencode.chatView"

/**
 * 单个 Webview 的聊天控制器（面板或侧边栏视图均可复用）。
 */
export class ChatHost {
  private currentSessionId: string | null = null
  private ready = false
  private pendingMessages: WebviewMessage[] = []
  private disposables: { dispose(): unknown }[] = []

  constructor(
    private readonly context: ExtensionContext,
    private readonly manager: OpenCodeManager,
    private readonly webview: Webview,
  ) {
    webview.onDidReceiveMessage((msg: WebviewCall) => void this.onMessage(msg))
    this.disposables.push(
      subscribe(this.manager, "event", (ev) => this.post({ type: "event", event: ev })),
      subscribe(this.manager, "state", () => this.pushConnectionState()),
    )
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose())
    this.disposables = []
  }

  private post(msg: WebviewMessage) {
    this.webview.postMessage(msg)
  }

  private pushConnectionState() {
    if (this.manager.state === "connected") {
      this.post({ type: "connected", version: this.manager.version })
    } else if (this.manager.state === "error" || this.manager.state === "disconnected") {
      this.post({ type: "disconnected", error: this.manager.lastError || "未连接" })
    }
  }

  private async buildSnapshot(): Promise<Snapshot> {
    const client = this.manager.client
    const base: Snapshot = {
      connected: this.manager.state === "connected",
      version: this.manager.version,
      directory: this.manager.options.directory ?? "",
      sessions: [],
      currentSessionId: this.currentSessionId,
      messages: [],
      providers: [],
      defaults: {},
      agents: [],
      commands: [],
      config: {},
      statuses: {},
      prefs: this.readPrefs(),
      server: {
        url: this.manager.baseUrl,
        commandPath: this.manager.options.commandPath,
        hostname: this.manager.options.hostname,
        port: this.manager.options.port,
        connectMode: this.manager.options.connectMode,
      } as ServerInfo,
      appVersion: this.context.extension.packageJSON?.version ?? "",
    }
    if (!client || this.manager.state !== "connected") return base

    const [sessions, providers, agents, commandsList, config] = await Promise.allSettled([
      client.listSessions(),
      client.providers(),
      client.agents(),
      client.commands(),
      client.config(),
    ])
    if (sessions.status === "fulfilled") {
      base.sessions = (sessions.value ?? []).sort((a, b) => b.time.updated - a.time.updated)
    }
    if (providers.status === "fulfilled") {
      base.providers = providers.value.providers ?? []
      base.defaults = providers.value.default ?? {}
    }
    if (agents.status === "fulfilled") base.agents = agents.value ?? []
    if (commandsList.status === "fulfilled") base.commands = commandsList.value ?? []
    if (config.status === "fulfilled") base.config = config.value ?? {}

    if (!this.currentSessionId) {
      const prefs = base.prefs
      if (prefs.sessionId && base.sessions.some((s) => s.id === prefs.sessionId)) {
        this.currentSessionId = prefs.sessionId
      } else if (base.sessions.length > 0) {
        this.currentSessionId = base.sessions[0].id
      }
    }
    base.currentSessionId = this.currentSessionId

    if (this.currentSessionId) {
      const messages = await client.listMessages(this.currentSessionId).catch(() => [])
      base.messages = messages ?? []
    }
    return base
  }

  private readPrefs(): UserPrefs {
    try {
      const p = this.context.globalState.get<UserPrefs>("opencode.prefs", {})
      if (!p.language) {
        const uiLang = workspace.getConfiguration("opencode").get<string>("uiLanguage", "zh-CN")
        p.language = uiLang
      }
      return p
    } catch {
      return {}
    }
  }

  private async onMessage(msg: WebviewCall) {
    if (msg.method === "ready") {
      this.ready = true
      const snapshot = await this.buildSnapshot()
      this.post({ type: "hello", snapshot })
      this.flushPending()
      return
    }
    if (msg.method === "restartServer") {
      await this.manager.start()
      this.post({ type: "result", id: msg.id, ok: true, data: true })
      return
    }
    const client = this.manager.client
    if (!client) {
      this.post({ type: "result", id: msg.id, ok: false, error: "opencode 服务未连接" })
      return
    }

    try {
      const data = await this.dispatch(client, msg)
      this.post({ type: "result", id: msg.id, ok: true, data })
    } catch (err) {
      this.post({ type: "result", id: msg.id, ok: false, error: (err as Error).message })
    }
  }

  private async dispatch(
    client: NonNullable<OpenCodeManager["client"]>,
    msg: WebviewCall,
  ): Promise<unknown> {
    switch (msg.method) {
      case "listSessions":
        return (await client.listSessions()).sort((a, b) => b.time.updated - a.time.updated)
      case "listMessages":
        return client.listMessages(msg.params.sessionId)
      case "createSession": {
        const s = await client.createSession(msg.params?.title ? { title: msg.params.title } : {})
        this.currentSessionId = s.id
        return s
      }
      case "deleteSession": {
        const ok = await client.deleteSession(msg.params.sessionId)
        if (ok && this.currentSessionId === msg.params.sessionId) this.currentSessionId = null
        return ok
      }
      case "renameSession":
        return client.updateSession(msg.params.sessionId, { title: msg.params.title })
      case "forkSession":
        return client.forkSession(msg.params.sessionId, msg.params.messageId)
      case "shareSession":
        return client.shareSession(msg.params.sessionId)
      case "unshareSession":
        return client.unshareSession(msg.params.sessionId)
      case "summarizeSession": {
        const [cfg, providers] = await Promise.all([client.config(), client.providers()])
        let small = cfg.small_model ?? cfg.model ?? ""
        if (!small) {
          const pid = Object.keys(providers.default)[0]
          const mid = pid ? providers.default[pid] : undefined
          if (pid && mid) small = `${pid}/${mid}`
        }
        const [providerID, modelID] = small.split("/")
        return client.summarizeSession(msg.params.sessionId, { providerID, modelID })
      }
      case "sendPrompt": {
        const { sessionId, body } = msg.params
        this.currentSessionId = sessionId
        await client.promptAsync(sessionId, body)
        return true
      }
      case "sendCommand": {
        const { sessionId, command, args } = msg.params
        this.currentSessionId = sessionId
        void client
          .runCommand(sessionId, { command, arguments: args })
          .catch((err) => this.post({ type: "result", id: `cmd:${sessionId}`, ok: false, error: (err as Error).message }))
        return true
      }
      case "abort":
        return client.abortSession(msg.params.sessionId)
      case "respondPermission":
        return client.respondPermission(msg.params.sessionId, msg.params.permissionId, {
          response: msg.params.response,
          remember: msg.params.remember,
        })
      case "getProviders": {
        const p = await client.providers()
        return { providers: p.providers, defaults: p.default }
      }
      case "getAgents":
        return client.agents()
      case "getCommands":
        return client.commands()
      case "getConfig":
        return client.config()
      case "getTodos":
        return client.getTodos(msg.params.sessionId)
      case "getDiff":
        return client.getDiff(msg.params.sessionId)
      case "findFiles":
        return client.findFiles(msg.params.query)
      case "pickFiles": {
        const files = await window.showOpenDialog({ canSelectMany: true, openLabel: "添加到对话" })
        if (!files) return []
        return files.map<AttachedFile>((f) => ({ path: f.fsPath, name: path.basename(f.fsPath) }))
      }
      case "openFile": {
        const doc = await workspace.openTextDocument(Uri.file(msg.params.path))
        await window.showTextDocument(doc)
        return true
      }
      case "applyToEditor": {
        const uri = Uri.file(msg.params.path)
        const doc = await workspace.openTextDocument(uri)
        const edit = new WorkspaceEdit()
        const fullRange = new Range(doc.positionAt(0), doc.positionAt(doc.getText().length))
        edit.replace(uri, fullRange, msg.params.content)
        await workspace.applyEdit(edit)
        return true
      }
      case "showDiff": {
        const beforeDoc = await workspace.openTextDocument({ content: msg.params.before, language: "plaintext" })
        const afterDoc = await workspace.openTextDocument({ content: msg.params.after, language: "plaintext" })
        await commands.executeCommand(
          "vscode.diff",
          beforeDoc.uri,
          afterDoc.uri,
          `${path.basename(msg.params.path)}：变更对比`,
          { viewColumn: ViewColumn.Beside, preview: true },
        )
        return true
      }
      case "revertMessage":
        return client.revertSession(msg.params.sessionId, { messageID: msg.params.messageId })
      case "copyToClipboard":
        return env.clipboard.writeText(msg.params.text)
      case "savePrefs": {
        const existing = this.readPrefs()
        const merged: UserPrefs = { ...existing, ...msg.params }
        await this.context.globalState.update("opencode.prefs", merged)
        return true
      }
      case "updateSetting": {
        const cfg = workspace.getConfiguration("opencode")
        await cfg.update(msg.params.key, msg.params.value, true)
        return true
      }
      default:
        return undefined
    }
  }

  insertPrompt(text: string, autoSend = false) {
    this.enqueue({ type: "insertPrompt", text, autoSend })
  }

  newSession() {
    this.enqueue({ type: "command", command: "newSession" })
  }

  private enqueue(msg: WebviewMessage) {
    this.pendingMessages.push(msg)
    this.flushPending()
  }

  private flushPending() {
    if (!this.ready) return
    for (const msg of this.pendingMessages.splice(0)) this.post(msg)
  }
}

/**
 * 侧边栏（活动栏）Webview 视图。
 */
export class ChatViewProvider implements WebviewViewProvider {
  public static readonly viewType = VIEW_TYPE
  private host: ChatHost | null = null

  constructor(
    private readonly context: ExtensionContext,
    private readonly manager: OpenCodeManager,
  ) {}

  resolveWebviewView(view: WebviewView): void {
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(this.context.extensionUri, "dist")],
    }
    view.webview.html = getHtml(this.context, view.webview)
    this.host = new ChatHost(this.context, this.manager, view.webview)
    view.onDidDispose(() => {
      this.host?.dispose()
      this.host = null
    })
  }

  insertPrompt(text: string, autoSend = false) {
    this.host?.insertPrompt(text, autoSend)
  }

  newSession() {
    this.host?.newSession()
  }
}

export function getHtml(context: ExtensionContext, webview: Webview): string {
  const distDir = Uri.joinPath(context.extensionUri, "dist")
  const file = Uri.joinPath(distDir, "webview.html")
  const nonce = getNonce()
  const html = fs.readFileSync(file.fsPath, "utf8")
  return html
    .replaceAll("{{cspSource}}", webview.cspSource)
    .replaceAll("{{nonce}}", nonce)
    .replaceAll("{{styleUri}}", webview.asWebviewUri(Uri.joinPath(distDir, "webview.css")).toString())
    .replaceAll("{{scriptUri}}", webview.asWebviewUri(Uri.joinPath(distDir, "webview.js")).toString())
}

function getNonce(): string {
  let text = ""
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length))
  return text
}

function subscribe(
  emitter: {
    on: (e: string, l: (...a: any[]) => void) => unknown
    off: (e: string, l: (...a: any[]) => void) => unknown
  },
  event: string,
  listener: (...a: any[]) => void,
) {
  emitter.on(event, listener)
  return { dispose: () => emitter.off(event, listener) }
}
