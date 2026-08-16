import { workspace, window, commands, StatusBarAlignment, type ExtensionContext } from "vscode"
import { OpenCodeManager } from "./manager"
import { ChatPanel } from "./panel"

export function activate(context: ExtensionContext) {
  const config = workspace.getConfiguration("opencode")
  const manager = new OpenCodeManager({
    commandPath: config.get<string>("commandPath", "opencode"),
    hostname: config.get<string>("hostname", "127.0.0.1"),
    port: config.get<number>("port", 4096),
    connectMode: config.get<"auto" | "manual">("connectMode", "auto"),
    directory: workspace.workspaceFolders?.[0]?.uri.fsPath,
  })
  context.subscriptions.push(manager)

  const panel = new ChatPanel(context, manager)

  // 状态栏
  const statusItem = window.createStatusBarItem("opencode.status", StatusBarAlignment.Left, 100)
  statusItem.text = "$(sync~spin) OpenCode 连接中…"
  statusItem.command = "opencode.open"
  statusItem.show()
  context.subscriptions.push(statusItem)

  manager.on("state", (state: string) => {
    if (state === "connected") {
      statusItem.text = "$(check) OpenCode 已连接"
      statusItem.tooltip = `OpenCode 服务已连接（${manager.version || manager.baseUrl}）`
    } else if (state === "connecting") {
      statusItem.text = "$(sync~spin) OpenCode 连接中…"
      statusItem.tooltip = "正在连接 opencode 服务"
    } else {
      statusItem.text = "$(warning) OpenCode 未连接"
      statusItem.tooltip = `${manager.lastError || "未连接"}（点击打开面板）`
    }
  })

  // 工作区变化时更新目录
  workspace.onDidChangeWorkspaceFolders(() => {
    manager.setDirectory(workspace.workspaceFolders?.[0]?.uri.fsPath)
  })

  const register = (id: string, fn: (...args: any[]) => unknown) =>
    context.subscriptions.push(commands.registerCommand(id, fn))

  register("opencode.open", () => panel.reveal())
  register("opencode.newSession", () => panel.newSessionCommand())
  register("opencode.pickSession", () => panel.reveal())
  register("opencode.startServer", async () => {
    window.showInformationMessage("正在连接 opencode 服务…")
    await manager.start()
  })
  register("opencode.stopServer", () => manager.stop())

  register("opencode.attachSelection", async () => {
    const editor = window.activeTextEditor
    if (!editor) {
      window.showWarningMessage("没有打开的编辑器。")
      return
    }
    const sel = editor.selection
    if (sel.isEmpty) {
      window.showWarningMessage("请先选中代码。")
      return
    }
    const text = editor.document.getText(sel)
    const file = editor.document.uri.fsPath
    const lang = editor.document.languageId
    await panel.insertPrompt(
      `\`\`\`${lang} 文件:${file.replaceAll("\\", "/")}\n${text}\n\`\`\``,
    )
  })

  register("opencode.explainSelection", async () => {
    const editor = window.activeTextEditor
    if (!editor) {
      window.showWarningMessage("没有打开的编辑器。")
      return
    }
    const sel = editor.selection
    if (sel.isEmpty) {
      window.showWarningMessage("请先选中代码。")
      return
    }
    const text = editor.document.getText(sel)
    const lang = editor.document.languageId
    await panel.insertPrompt(
      `请解释下面这段代码的作用、关键逻辑和潜在问题：\n\n\`\`\`${lang}\n${text}\n\`\`\``,
      true,
    )
  })

  if (config.get<boolean>("autoStart", true)) {
    void manager.start()
  }
}

export function deactivate() {}
