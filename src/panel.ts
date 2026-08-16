import {
  workspace,
  window,
  Uri,
  ViewColumn,
  commands,
  WorkspaceEdit,
  Range,
  env,
  type WebviewPanel,
  type Webview,
  type ExtensionContext,
} from "vscode"
import * as fs from "node:fs"
import * as path from "node:path"
import type { OpenCodeManager } from "./manager"
import type { WebviewCall, WebviewMessage, Snapshot, AttachedFile } from "./protocol"

const VIEW_TYPE = "opencode.chat"

export class ChatPanel {
  public static current: ChatPanel | undefined
  public static readonly viewType = VIEW_TYPE

  private panel: WebviewPanel | undefined
  private disposables: { dispose(): unknown }[] = []
  private currentSessionId: string | null = null

  constructor(
    private readonly context: ExtensionContext,
    private readonly manager: OpenCodeManager,
  ) {}

  public reveal() {
    if (this.panel) {
      this.panel.reveal(ViewColumn.Beside)
      return
    }
    const panel = window.createWebviewPanel(VIEW_TYPE, "OpenCode 助手", ViewColumn.Beside, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [Uri.joinPath(this.context.extensionUri, "dist")],
    })
    this.panel = panel
    panel.iconPath = Uri.joinPath(this.context.extensionUri, "media", "icon.svg")
    panel.webview.html = this.getHtml(panel.webview)
    panel.webview.onDidReceiveMessage((msg: WebviewCall) => void this.onMessage(msg))
    panel.onDidDispose(() => {
      this.panel = undefined
      this.disposables.forEach((d) => d.dispose())
      this.disposables = []
      if (ChatPanel.current === this) ChatPanel.current = undefined
    })

    this.disposables.push(
      subscribe(this.manager, "event", (ev) => this.post({ type: "event", event: ev })),
      subscribe(this.manager, "state", () => this.pushConnectionState()),
    )
    ChatPanel.current = this
  }

  private post(msg: WebviewMessage) {
    this.panel?.webview.postMessage(msg)
  }

  private getHtml(webview: Webview): string {
    const distDir = Uri.joinPath(this.context.extensionUri, "dist")
    const file = Uri.joinPath(distDir, "webview.html")
    const nonce = getNonce()
    const html = fs.readFileSync(file.fsPath, "utf8")
    return html
      .replaceAll("{{cspSource}}", webview.cspSource)
      .replaceAll("{{nonce}}", nonce)
      .replaceAll("{{styleUri}}", webview.asWebviewUri(Uri.joinPath(distDir, "webview.css")).toString())
      .replaceAll("{{scriptUri}}", webview.asWebviewUri(Uri.joinPath(distDir, "webview.js")).toString())
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
    }
    if (!client || this.manager.state !== "connected") return base

    const [sessions, providers, agents, commands, config] = await Promise.allSettled([
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
    if (commands.status === "fulfilled") base.commands = commands.value ?? []
    if (config.status === "fulfilled") base.config = config.value ?? {}

    if (!this.currentSessionId && base.sessions.length > 0) {
      this.currentSessionId = base.sessions[0].id
    }
    base.currentSessionId = this.currentSessionId

    if (this.currentSessionId) {
      const messages = await client.listMessages(this.currentSessionId).catch(() => [])
      base.messages = messages ?? []
    }
    return base
  }

  private async onMessage(msg: WebviewCall) {
    if (msg.method === "ready") {
      const snapshot = await this.buildSnapshot()
      this.post({ type: "hello", snapshot })
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
        )
        return true
      }
      case "revertMessage":
        return client.revertSession(msg.params.sessionId, { messageID: msg.params.messageId })
      case "copyToClipboard":
        return env.clipboard.writeText(msg.params.text)
      default:
        return undefined
    }
  }

  public async insertPrompt(text: string, autoSend = false) {
    this.reveal()
    this.post({ type: "insertPrompt", text, autoSend })
  }

  public async newSessionCommand() {
    this.reveal()
    this.post({ type: "command", command: "newSession" })
  }
}

function getNonce(): string {
  let text = ""
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length))
  return text
}

function subscribe(emitter: { on: (e: string, l: (...a: any[]) => void) => unknown; off: (e: string, l: (...a: any[]) => void) => unknown }, event: string, listener: (...a: any[]) => void) {
  emitter.on(event, listener)
  return { dispose: () => emitter.off(event, listener) }
}
