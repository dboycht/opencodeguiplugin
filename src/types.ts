// 精简的 opencode 服务端 API 类型（来源于 opencode OpenAPI spec）
// 仅保留本插件所需字段。

export type Role = "user" | "assistant"

export interface FileDiff {
  file: string
  before: string
  after: string
  additions: number
  deletions: number
}

export interface UserMessage {
  id: string
  sessionID: string
  role: "user"
  time: { created: number }
  summary?: { title?: string; body?: string; diffs: FileDiff[] }
  agent: string
  model: { providerID: string; modelID: string }
  system?: string
  tools?: Record<string, boolean>
}

export interface ApiError {
  name: string
  data: { message: string; statusCode?: number; isRetryable?: boolean; [k: string]: unknown }
}

export interface AssistantMessage {
  id: string
  sessionID: string
  role: "assistant"
  time: { created: number; completed?: number }
  error?: unknown
  parentID: string
  modelID: string
  providerID: string
  mode: string
  path: { cwd: string; root: string }
  summary?: boolean
  cost: number
  tokens: {
    input: number
    output: number
    reasoning: number
    cache: { read: number; write: number }
  }
  finish?: string
}

export type Message = UserMessage | AssistantMessage

export interface TextPart {
  id: string
  sessionID: string
  messageID: string
  type: "text"
  text: string
  synthetic?: boolean
  ignored?: boolean
  time?: { start: number; end?: number }
  metadata?: Record<string, unknown>
}

export interface ReasoningPart {
  id: string
  sessionID: string
  messageID: string
  type: "reasoning"
  text: string
  time: { start: number; end?: number }
}

export interface FilePart {
  id: string
  sessionID: string
  messageID: string
  type: "file"
  mime: string
  filename?: string
  url: string
  source?: unknown
}

export type ToolState =
  | { status: "pending"; input: Record<string, unknown>; raw: string }
  | { status: "running"; input: Record<string, unknown>; title?: string; time: { start: number } }
  | {
      status: "completed"
      input: Record<string, unknown>
      output: string
      title: string
      metadata: Record<string, unknown>
      time: { start: number; end: number }
      attachments?: FilePart[]
    }
  | {
      status: "error"
      input: Record<string, unknown>
      error: string
      time: { start: number; end: number }
    }

export interface ToolPart {
  id: string
  sessionID: string
  messageID: string
  type: "tool"
  callID: string
  tool: string
  state: ToolState
}

export interface StepStartPart {
  id: string
  sessionID: string
  messageID: string
  type: "step-start"
  snapshot?: string
}

export interface StepFinishPart {
  id: string
  sessionID: string
  messageID: string
  type: "step-finish"
  reason: string
  cost: number
  tokens: AssistantMessage["tokens"]
}

export interface SnapshotPart {
  id: string
  sessionID: string
  messageID: string
  type: "snapshot"
  snapshot: string
}

export interface PatchPart {
  id: string
  sessionID: string
  messageID: string
  type: "patch"
  hash: string
  files: string[]
}

export interface AgentPart {
  id: string
  sessionID: string
  messageID: string
  type: "agent"
  name: string
}

export interface SubtaskPart {
  id: string
  sessionID: string
  messageID: string
  type: "subtask"
  prompt: string
  description: string
  agent: string
}

export interface CompactionPart {
  id: string
  sessionID: string
  messageID: string
  type: "compaction"
  auto: boolean
}

export type Part =
  | TextPart
  | ReasoningPart
  | FilePart
  | ToolPart
  | StepStartPart
  | StepFinishPart
  | SnapshotPart
  | PatchPart
  | AgentPart
  | SubtaskPart
  | CompactionPart

export interface Permission {
  id: string
  type: string
  pattern?: string | string[]
  sessionID: string
  messageID: string
  callID?: string
  title: string
  metadata: Record<string, unknown>
  time: { created: number }
}

export type SessionStatus =
  | { type: "idle" }
  | { type: "retry"; attempt: number; message: string; next: number }
  | { type: "busy" }

export interface Todo {
  content: string
  status: string
  priority: string
  id: string
}

export interface Session {
  id: string
  projectID: string
  directory: string
  parentID?: string
  summary?: { additions: number; deletions: number; files: number; diffs?: FileDiff[] }
  share?: { url: string }
  title: string
  version: string
  time: { created: number; updated: number; compacting?: number }
}

export interface Model {
  id: string
  providerID: string
  name: string
  capabilities: {
    temperature: boolean
    reasoning: boolean
    attachment: boolean
    toolcall: boolean
    input: { text: boolean; audio: boolean; image: boolean; video: boolean; pdf: boolean }
    output: { text: boolean; audio: boolean; image: boolean; video: boolean; pdf: boolean }
  }
  cost: {
    input: number
    output: number
    cache: { read: number; write: number }
  }
  limit: { context: number; output: number }
  status: "alpha" | "beta" | "deprecated" | "active"
}

export interface Provider {
  id: string
  name: string
  source: "env" | "config" | "custom" | "api"
  env: string[]
  key?: string
  models: Record<string, Model>
}

export interface Agent {
  name: string
  description?: string
  mode: "subagent" | "primary" | "all"
  builtIn: boolean
  color?: string
  model?: { modelID: string; providerID: string }
  tools: Record<string, boolean>
}

export interface Command {
  name: string
  description?: string
  agent?: string
  model?: string
  template: string
  subtask?: boolean
}

export interface Config {
  model?: string
  small_model?: string
  username?: string
  permission?: Record<string, unknown>
  [k: string]: unknown
}

export interface TodoUpdated {
  type: "todo.updated"
  properties: { sessionID: string; todos: Todo[] }
}

export interface MessagePartUpdated {
  type: "message.part.updated"
  properties: { part: Part; delta?: string }
}

export interface MessageUpdated {
  type: "message.updated"
  properties: { info: Message }
}

export interface MessageRemoved {
  type: "message.removed"
  properties: { sessionID: string; messageID: string }
}

export interface MessagePartRemoved {
  type: "message.part.removed"
  properties: { sessionID: string; messageID: string; partID: string }
}

export interface PermissionUpdated {
  type: "permission.updated"
  properties: Permission
}

export interface PermissionReplied {
  type: "permission.replied"
  properties: { sessionID: string; permissionID: string; response: string }
}

export interface SessionStatusEvent {
  type: "session.status"
  properties: { sessionID: string; status: SessionStatus }
}

export interface SessionIdle {
  type: "session.idle"
  properties: { sessionID: string }
}

export interface SessionCreated {
  type: "session.created"
  properties: { info: Session }
}

export interface SessionUpdated {
  type: "session.updated"
  properties: { info: Session }
}

export interface SessionDeleted {
  type: "session.deleted"
  properties: { info: Session }
}

export interface SessionError {
  type: "session.error"
  properties: { sessionID?: string; error?: ApiError }
}

export interface SessionDiff {
  type: "session.diff"
  properties: { sessionID: string; diff: FileDiff[] }
}

export interface FileEdited {
  type: "file.edited"
  properties: { file: string }
}

export type OpenCodeEvent =
  | TodoUpdated
  | MessagePartUpdated
  | MessageUpdated
  | MessageRemoved
  | MessagePartRemoved
  | PermissionUpdated
  | PermissionReplied
  | SessionStatusEvent
  | SessionIdle
  | SessionCreated
  | SessionUpdated
  | SessionDeleted
  | SessionError
  | SessionDiff
  | FileEdited
  | { type: string; properties?: Record<string, unknown>; [k: string]: unknown }

export interface MessageWithParts {
  info: Message
  parts: Part[]
}

/** 发送消息时可用的 part 输入类型（id 可选，无需 sessionID/messageID） */
export type PromptPart =
  | { id?: string; type: "text"; text: string; synthetic?: boolean; ignored?: boolean }
  | { id?: string; type: "file"; mime: string; filename?: string; url: string }
  | { id?: string; type: "agent"; name: string }
  | { id?: string; type: "subtask"; prompt: string; description: string; agent: string }
