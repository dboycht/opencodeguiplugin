import { signal, computed, batch, effect } from "@preact/signals"
import type {
  Agent,
  Command,
  Config,
  FileDiff,
  MessageWithParts,
  OpenCodeEvent,
  Part,
  Permission,
  PromptPart,
  Provider,
  Session,
  Todo,
} from "../src/types"
import type { Snapshot } from "../src/protocol"
import type { PromptInput } from "../src/client"
import { call } from "./api"
import { lang } from "./i18n"

// ---------- 基础状态 ----------
export const connected = signal(false)
export const version = signal("")
export const connError = signal("")

export const sessions = signal<Session[]>([])
export const currentId = signal<string | null>(null)
export const messages = signal<MessageWithParts[]>([])
export const providers = signal<Provider[]>([])
export const defaults = signal<Record<string, string>>({})
export const agents = signal<Agent[]>([])
export const commands = signal<Command[]>([])
export const config = signal<Config>({})
export const todos = signal<Todo[]>([])
export const permissions = signal<Permission[]>([])
export const busyIds = signal<Set<string>>(new Set())
export const directory = signal("")
export const appVersion = signal("")
export const server = signal<{ url: string; commandPath: string; hostname: string; port: number; connectMode: string }>({
  url: "",
  commandPath: "opencode",
  hostname: "127.0.0.1",
  port: 4096,
  connectMode: "auto",
})

export const view = signal<"chat" | "settings">("chat")
export const search = signal("")
export const sidebarOpen = signal(typeof window !== "undefined" ? window.innerWidth >= 720 : false)
export const sidebarTab = signal<"sessions" | "settings">("sessions")

export function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

export function openSidebar() {
  sidebarOpen.value = true
}

export function closeSidebar() {
  sidebarOpen.value = false
}

export interface Toast {
  id: number
  title?: string
  message: string
  variant: "info" | "success" | "warning" | "error"
}
export const toasts = signal<Toast[]>([])

// 模型 / 代理选择
export const model = signal<{ providerID: string; modelID: string } | null>(null)
export const agent = signal<string | null>(null)

// 审批模式（类似 Claude 的权限模式）
export type ApprovalMode = "ask" | "accept-edits" | "accept-all" | "plan"
export const approvalMode = signal<ApprovalMode>("ask")

export const APPROVAL_MODES: { id: ApprovalMode; label: string; desc: string }[] = [
  { id: "ask", label: "默认询问", desc: "编辑、命令等操作都询问你" },
  { id: "accept-edits", label: "自动接受编辑", desc: "自动接受文件编辑，命令仍询问" },
  { id: "accept-all", label: "全部自动", desc: "自动接受所有操作，不打断" },
  { id: "plan", label: "计划模式", desc: "只读，拒绝编辑和命令执行" },
]

// 是否已加载快照（用于避免在恢复前持久化默认值）
export const loaded = signal(false)

// 持久化用户偏好：模型 / 智能体 / 审批模式 / 当前会话
effect(() => {
  if (!loaded.value) return
  const m = model.value
  void call("savePrefs", {
    sessionId: currentId.value,
    model: m ? { providerID: m.providerID, modelID: m.modelID } : null,
    agent: agent.value,
    approvalMode: approvalMode.value,
  })
})

// 草稿与附件（按会话）
export const drafts = signal<Record<string, string>>({})
export const attachments = signal<Record<string, PromptPart[]>>({})

// ---------- 派生状态 ----------
export const currentSession = computed<Session | null>(() => {
  const id = currentId.value
  return sessions.value.find((s) => s.id === id) ?? null
})

export const filteredSessions = computed<Session[]>(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return sessions.value
  return sessions.value.filter((s) => s.title.toLowerCase().includes(q))
})

export const isBusy = computed<boolean>(() => {
  const id = currentId.value
  return id ? busyIds.value.has(id) : false
})

/** 当前正在运行/待运行的工具名（用于顶部活动栏提示） */
export const lastActiveTool = computed<string | null>(() => {
  if (!isBusy.value) return null
  for (const m of [...messages.value].reverse()) {
    for (const p of [...m.parts].reverse()) {
      if (p.type === "tool") {
        const s = p.state
        if (s?.status === "running" || s?.status === "pending") return p.tool
      }
    }
  }
  return null
})

export const pendingPermissions = computed<Permission[]>(() => {
  const id = currentId.value
  return permissions.value.filter((p) => p.sessionID === id)
})

/** 当前会话的使用统计（token / 成本 / 消息数），供「使用记录」展示 */
export const sessionUsage = computed(() => {
  let input = 0
  let output = 0
  let reasoning = 0
  let cacheRead = 0
  let cacheWrite = 0
  let cost = 0
  let assistantMessages = 0
  let userMessages = 0
  let toolCalls = 0
  for (const m of messages.value) {
    if (m.info.role === "assistant") {
      assistantMessages++
      const t = (m.info as any).tokens
      if (t) {
        input += t.input ?? 0
        output += t.output ?? 0
        reasoning += t.reasoning ?? 0
        cacheRead += t.cache?.read ?? 0
        cacheWrite += t.cache?.write ?? 0
      }
      cost += (m.info as any).cost ?? 0
      toolCalls += m.parts.filter((p) => p.type === "tool").length
    } else {
      userMessages++
    }
  }
  const total = input + output + reasoning + cacheRead + cacheWrite
  return { input, output, reasoning, cacheRead, cacheWrite, total, cost, assistantMessages, userMessages, toolCalls }
})

/** 本轮对话的耗时指标（发送时间 / 首 token 到达时间），用于展示首 token 延迟与总耗时 */
export const roundMetrics = signal<{ sentAt: number; firstTokenAt: number | null } | null>(null)

/** 输入历史（已发送的 prompt，↑/↓ 切换） */
export const history = signal<string[]>([])

export function addHistory(text: string) {
  const h = history.value
  if (h[h.length - 1] === text) return
  history.value = [...h.slice(-99), text]
}

/** Plan 审批：待审阅的文件差异 */
export const planDiffs = signal<FileDiff[]>([])

export function closePlanPreview() {
  planDiffs.value = []
}

export async function applyPlanFile(file: string, after: string) {
  try {
    await call("applyToEditor", { path: file, content: after })
    planDiffs.value = planDiffs.value.filter((d) => d.file !== file)
    toast(`${file} 已应用`, "success")
  } catch (err) {
    toast((err as Error).message, "error", "应用失败")
  }
}

export async function rejectPlanFile(file: string) {
  planDiffs.value = planDiffs.value.filter((d) => d.file !== file)
}

export async function searchFiles(query: string): Promise<string[]> {
  try {
    return (await call<string[]>("findFiles", { query })) ?? []
  } catch {
    return []
  }
}

// ---------- Toast ----------
let toastSeq = 0
export function toast(message: string, variant: Toast["variant"] = "info", title?: string) {
  const id = ++toastSeq
  toasts.value = [...toasts.value, { id, title, message, variant }]
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }, 5000)
}

// ---------- 快照加载 ----------
export function loadSnapshot(s: Snapshot) {
  batch(() => {
    connected.value = s.connected
    version.value = s.version
    directory.value = s.directory
    sessions.value = s.sessions
    currentId.value = s.currentSessionId
    messages.value = s.messages
    providers.value = s.providers
    defaults.value = s.defaults
    agents.value = s.agents
    commands.value = s.commands
    config.value = s.config
    if (s.server) server.value = s.server
    if (s.appVersion) appVersion.value = s.appVersion

    const prefs = s.prefs ?? {}
    if (prefs.model) {
      model.value = { providerID: prefs.model.providerID, modelID: prefs.model.modelID }
    } else if (!model.value) {
      let m: string | undefined = s.config.model
      if (!m) {
        const providerID = Object.keys(s.defaults)[0]
        const modelID = providerID ? s.defaults[providerID] : undefined
        if (providerID && modelID) m = `${providerID}/${modelID}`
      }
      if (m) {
        const [providerID, modelID] = m.split("/")
        if (providerID && modelID) model.value = { providerID, modelID }
      }
    }
    if (prefs.agent !== undefined) agent.value = prefs.agent
    if (prefs.approvalMode) approvalMode.value = prefs.approvalMode as ApprovalMode
    if (prefs.language === "en" || prefs.language === "zh") lang.value = prefs.language

    loaded.value = true
  })

  // 没有会话时自动创建一个
  if (s.sessions.length === 0 && !currentId.value) {
    void createSession()
  }
}

export function setConnected(v: string) {
  connected.value = true
  version.value = v
  connError.value = ""
}

export function setDisconnected(err: string) {
  connected.value = false
  connError.value = err
}

// ---------- 事件处理 ----------
function autoPermissionResponse(p: Permission): { response: "once" | "always" | "reject"; remember?: boolean } | null {
  const mode = approvalMode.value
  if (mode === "ask") return null
  const t = p.type
  const isWrite = t === "edit" || t === "bash" || t === "doom_loop"
  if (mode === "plan") {
    return isWrite ? { response: "reject" } : { response: "always", remember: true }
  }
  if (mode === "accept-edits") {
    return t === "edit" ? { response: "always", remember: true } : null
  }
  if (mode === "accept-all") {
    return { response: "always", remember: true }
  }
  return null
}

export function handleEvent(raw: OpenCodeEvent) {
  const ev = raw as OpenCodeEvent
  switch (ev.type) {
    case "message.updated": {
      const info = (ev as any).properties?.info
      if (!info) return
      const id = info.sessionID
      if (id !== currentId.value) {
        refreshSessionsMeta()
        return
      }
      const arr = [...messages.value]
      const idx = arr.findIndex((m) => m.info.id === info.id)
      if (idx >= 0) arr[idx] = { info, parts: arr[idx].parts }
      else arr.push({ info, parts: [] })
      messages.value = arr
      break
    }
    case "message.part.updated": {
      const part = (ev as any).properties?.part as Part | undefined
      if (!part) return
      if (part.sessionID !== currentId.value) return
      upsertPart(part)
      break
    }
    case "message.part.delta": {
      const p = (ev as any).properties
      if (!p) return
      if (p.sessionID !== currentId.value) return
      if (typeof p.delta !== "string" || !p.delta) return
      // 记录首 token 到达时间
      if (roundMetrics.value && roundMetrics.value.firstTokenAt === null) {
        roundMetrics.value = { ...roundMetrics.value, firstTokenAt: Date.now() }
      }
      applyDelta(p.sessionID, p.messageID, p.partID, p.field, p.delta)
      break
    }
    case "message.removed": {
      const { messageID } = (ev as any).properties
      messages.value = messages.value.filter((m) => m.info.id !== messageID)
      break
    }
    case "message.part.removed": {
      const { messageID, partID } = (ev as any).properties
      messages.value = messages.value.map((m) =>
        m.info.id === messageID ? { info: m.info, parts: m.parts.filter((p) => p.id !== partID) } : m,
      )
      break
    }
    case "session.updated":
    case "session.created":
    case "session.deleted": {
      const info = (ev as any).properties?.info as Session | undefined
      if (!info) return
      refreshSessionsMeta()
      break
    }
    case "session.status": {
      const { sessionID, status } = (ev as any).properties
      const set = new Set(busyIds.value)
      if (status?.type === "busy") set.add(sessionID)
      else set.delete(sessionID)
      busyIds.value = set
      break
    }
    case "session.idle": {
      const { sessionID } = (ev as any).properties
      const set = new Set(busyIds.value)
      set.delete(sessionID)
      busyIds.value = set
      if (sessionID === currentId.value) {
        void refreshMessages()
        // 计划模式：完成后自动打开文件差异预览，询问用户
        if (approvalMode.value === "plan") {
          void showPlanPreview()
        }
      }
      refreshSessionsMeta()
      break
    }
    case "session.error": {
      const err = (ev as any).properties?.error
      toast(err?.data?.message ?? "会话出错", "error", "会话错误")
      break
    }
    case "permission.updated": {
      const p = (ev as any).properties as Permission
      const auto = autoPermissionResponse(p)
      if (auto) {
        void respondPermission(p.id, auto.response, auto.remember)
        return
      }
      permissions.value = permissions.value.some((x) => x.id === p.id)
        ? permissions.value.map((x) => (x.id === p.id ? p : x))
        : [...permissions.value, p]
      break
    }
    case "permission.replied": {
      const { permissionID } = (ev as any).properties
      permissions.value = permissions.value.filter((x) => x.id !== permissionID)
      break
    }
    case "todo.updated": {
      const { sessionID, todos: list } = (ev as any).properties
      if (sessionID === currentId.value) todos.value = list ?? []
      break
    }
    default:
      break
  }
}

// ---------- 流式增量（核心） ----------

/** partID -> 该 part 最近一次经 part.updated 设置的完整文本（用于检测重复增量） */
const fullTexts = new Map<string, string>()

function placeholderInfo(sessionID: string, messageID: string) {
  return {
    id: messageID,
    sessionID,
    role: "assistant" as const,
    time: { created: Date.now() },
    agent: "",
    model: { providerID: "", modelID: "" },
    parentID: "",
    modelID: "",
    providerID: "",
    mode: "",
    path: { cwd: "", root: "" },
    cost: 0,
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  }
}

/** 仅替换受影响的 message，其余保持引用不变（配合 memo 避免每次增量重渲染整列消息） */
function patchMessage(
  messageID: string,
  sessionID: string,
  update: (m: MessageWithParts) => MessageWithParts,
) {
  const arr = messages.value
  const idx = arr.findIndex((m) => m.info.id === messageID)
  if (idx >= 0) {
    const next = [...arr]
    next[idx] = update(arr[idx])
    messages.value = next
  } else {
    messages.value = [...arr, update({ info: placeholderInfo(sessionID, messageID), parts: [] })]
  }
}

/**
 * message.part.updated：服务端发送的权威全量 part，直接整体替换。
 */
function upsertPart(part: Part) {
  if ((part.type === "text" || part.type === "reasoning") && typeof (part as any).text === "string") {
    fullTexts.set(part.id, (part as any).text)
  }
  patchMessage(part.messageID, part.sessionID, (m) => {
    const parts = [...m.parts]
    const idx = parts.findIndex((p) => p.id === part.id)
    if (idx >= 0) parts[idx] = part
    else parts.push(part)
    return { info: m.info, parts }
  })
}

/** 取 part 对应 field 的当前字符串值（text/reasoning → .text；tool → .state.output） */
function partFieldText(part: Part, field: string): string {
  if (part.type === "tool") return ((part.state as any)?.output ?? "") as string
  return ((part as any).text ?? "") as string
}

/**
 * message.part.delta：增量追加。若 part/message 尚不存在则先创建占位，避免增量丢失。
 * 防御重复追加：若该 part 刚被全量 part.updated 覆盖、且当前值已以 delta 结尾，说明该增量已被包含，跳过。
 */
function applyDelta(sessionID: string, messageID: string, partID: string, field: string, delta: string) {
  patchMessage(messageID, sessionID, (m) => {
    const parts = [...m.parts]
    const idx = parts.findIndex((p) => p.id === partID)
    if (idx < 0) {
      // 未知 part：按字段类型创建占位，避免增量丢失
      if (field === "output") {
        parts.push({
          id: partID,
          sessionID,
          messageID,
          type: "tool",
          tool: "bash",
          callID: "",
          state: { status: "running", input: {}, time: { start: Date.now() }, output: delta },
        } as unknown as Part)
      } else {
        parts.push({
          id: partID,
          sessionID,
          messageID,
          type: "text",
          text: delta,
        } as unknown as Part)
      }
      return { info: m.info, parts }
    }
    const p = parts[idx]
    const cur = partFieldText(p, field)
    const known = fullTexts.get(partID)
    if (known !== undefined && known === cur && cur.endsWith(delta)) {
      return m // 全量 part.updated 已包含该增量，跳过防重复
    }
    if (p.type === "tool") {
      const st = (p.state as any) ?? {}
      parts[idx] = { ...p, state: { ...st, output: cur + delta } } as Part
    } else {
      parts[idx] = { ...p, text: cur + delta } as Part
    }
    return { info: m.info, parts }
  })
}

// ---------- 数据操作 ----------
export async function refreshSessions() {
  try {
    const list = (await call<Session[]>("listSessions")) ?? []
    sessions.value = [...list].sort((a, b) => b.time.updated - a.time.updated)
  } catch (err) {
    toast((err as Error).message, "error", "加载会话失败")
  }
}

export async function refreshSessionsMeta() {
  void refreshSessions()
}

export async function refreshMeta() {
  try {
    const p = await call<{ providers: Provider[]; defaults: Record<string, string> }>("getProviders")
    if (p) {
      providers.value = p.providers ?? []
      defaults.value = p.defaults ?? {}
    }
  } catch {
    /* ignore */
  }
  try {
    agents.value = (await call<Agent[]>("getAgents")) ?? []
  } catch {
    /* ignore */
  }
  try {
    commands.value = (await call<Command[]>("getCommands")) ?? []
  } catch {
    /* ignore */
  }
  try {
    config.value = (await call<Config>("getConfig")) ?? {}
  } catch {
    /* ignore */
  }
}

export async function refreshMessages() {
  const id = currentId.value
  if (!id) return
  try {
    const list = (await call<MessageWithParts[]>("listMessages", { sessionId: id })) ?? []
    messages.value = list
  } catch (err) {
    toast((err as Error).message, "error", "加载消息失败")
  }
}

export async function refreshTodos() {
  const id = currentId.value
  if (!id) return
  try {
    todos.value = (await call<Todo[]>("getTodos", { sessionId: id })) ?? []
  } catch {
    todos.value = []
  }
}

export async function selectSession(id: string) {
  currentId.value = id
  messages.value = []
  todos.value = []
  await Promise.all([refreshMessages(), refreshTodos()])
}

export async function createSession(): Promise<string | null> {
  try {
    const s = await call<Session>("createSession", {})
    await refreshSessions()
    currentId.value = s.id
    messages.value = []
    todos.value = []
    view.value = "chat"
    return s.id
  } catch (err) {
    toast((err as Error).message, "error", "新建会话失败")
    return null
  }
}

export async function deleteSession(id: string) {
  try {
    await call("deleteSession", { sessionId: id })
    if (currentId.value === id) {
      const rest = sessions.value.filter((s) => s.id !== id)
      currentId.value = rest[0]?.id ?? null
      if (currentId.value) await selectSession(currentId.value)
      else messages.value = []
    }
    await refreshSessions()
  } catch (err) {
    toast((err as Error).message, "error", "删除会话失败")
  }
}

export async function renameSession(id: string, title: string) {
  try {
    await call("renameSession", { sessionId: id, title })
    await refreshSessions()
  } catch (err) {
    toast((err as Error).message, "error", "重命名失败")
  }
}

export async function forkSession(id: string) {
  try {
    await call("forkSession", { sessionId: id })
    await refreshSessions()
  } catch (err) {
    toast((err as Error).message, "error", "复制会话失败")
  }
}

export async function shareSession(id: string) {
  try {
    const s = await call<Session>("shareSession", { sessionId: id })
    await refreshSessions()
    if (s?.share?.url) {
      await call("copyToClipboard", { text: s.share.url })
      toast("分享链接已复制到剪贴板", "success", "分享成功")
    }
  } catch (err) {
    toast((err as Error).message, "error", "分享失败")
  }
}

export async function unshareSession(id: string) {
  try {
    await call("unshareSession", { sessionId: id })
    await refreshSessions()
  } catch (err) {
    toast((err as Error).message, "error", "取消分享失败")
  }
}

export async function summarizeSession(id: string) {
  try {
    await call("summarizeSession", { sessionId: id })
    toast("已生成会话摘要", "success")
  } catch (err) {
    toast((err as Error).message, "error", "摘要失败")
  }
}

export async function sendPrompt(text: string): Promise<boolean> {
  const id = currentId.value
  if (!id) {
    const created = await createSession()
    if (!created) return false
    return sendPrompt(text)
  }

  // 斜杠命令检测（如 /compact、/new）
  const slash = /^\/(\S+)(?:\s+([\s\S]*))?$/.exec(text.trim())
  if (slash) {
    const name = slash[1]
    const known = commands.value.some((c) => c.name === name)
    if (known) {
      return sendCommand(name, (slash[2] ?? "").trim())
    }
  }

  const parts: PromptPart[] = [...(attachments.value[id] ?? [])]
  parts.push({ type: "text", text })
  const body: PromptInput = { parts }
  if (model.value) body.model = { ...model.value }
  if (agent.value) body.agent = agent.value

  drafts.value = { ...drafts.value, [id]: "" }
  attachments.value = { ...attachments.value, [id]: [] }

  const set = new Set(busyIds.value)
  set.add(id)
  busyIds.value = set
  roundMetrics.value = { sentAt: Date.now(), firstTokenAt: null }
  addHistory(text)

  try {
    await call("sendPrompt", { sessionId: id, body })
    return true
  } catch (err) {
    const s = new Set(busyIds.value)
    s.delete(id)
    busyIds.value = s
    toast((err as Error).message, "error", "发送失败")
    return false
  }
}

export async function sendCommand(name: string, args: string): Promise<boolean> {
  const id = currentId.value
  if (!id) {
    const created = await createSession()
    if (!created) return false
    return sendCommand(name, args)
  }
  drafts.value = { ...drafts.value, [id]: "" }
  const set = new Set(busyIds.value)
  set.add(id)
  busyIds.value = set
  try {
    await call("sendCommand", { sessionId: id, command: name, args })
    return true
  } catch (err) {
    const s = new Set(busyIds.value)
    s.delete(id)
    busyIds.value = s
    toast((err as Error).message, "error", "命令执行失败")
    return false
  }
}

export async function abortSession() {
  const id = currentId.value
  if (!id) return
  try {
    await call("abort", { sessionId: id })
    const s = new Set(busyIds.value)
    s.delete(id)
    busyIds.value = s
  } catch (err) {
    toast((err as Error).message, "error", "中断失败")
  }
}

export async function respondPermission(permissionId: string, response: "once" | "always" | "reject", remember?: boolean) {
  const id = currentId.value
  if (!id) return
  try {
    await call("respondPermission", { sessionId: id, permissionId, response, remember })
    permissions.value = permissions.value.filter((p) => p.id !== permissionId)
  } catch (err) {
    toast((err as Error).message, "error", "权限响应失败")
  }
}

export async function revertMessage(messageId: string) {
  const id = currentId.value
  if (!id) return
  try {
    await call("revertMessage", { sessionId: id, messageId })
    await refreshMessages()
  } catch (err) {
    toast((err as Error).message, "error", "回退消息失败")
  }
}

/** 计划模式完成后：拉取会话差异，弹出审批面板供用户逐文件应用/拒绝 */
export async function showPlanPreview() {
  const id = currentId.value
  if (!id) return
  try {
    const diffs = (await call<FileDiff[]>("getDiff", { sessionId: id })) ?? []
    const changed = diffs.filter((d) => d.before !== d.after)
    planDiffs.value = changed
    if (changed.length === 0) {
      toast("计划已完成，暂无文件变更", "info", "计划")
    }
  } catch {
    /* 忽略 */
  }
}

export async function updateSetting(key: string, value: unknown) {
  try {
    await call("updateSetting", { key, value })
    toast("设置已更新", "success")
  } catch (err) {
    toast((err as Error).message, "error", "更新设置失败")
  }
}
