import type {
  Agent,
  Command,
  Config,
  MessageWithParts,
  OpenCodeEvent,
  Provider,
  Session,
} from "./types"
import type { PromptInput } from "./client"

// ---------- Webview -> Extension ----------

export type PermissionResponse = "once" | "always" | "reject"

export interface AttachedFile {
  path: string
  name: string
}

export type WebviewCall =
  | { id: string; method: "ready"; params?: undefined }
  | { id: string; method: "listSessions"; params?: undefined }
  | { id: string; method: "listMessages"; params: { sessionId: string } }
  | { id: string; method: "createSession"; params?: { title?: string } }
  | { id: string; method: "deleteSession"; params: { sessionId: string } }
  | { id: string; method: "renameSession"; params: { sessionId: string; title: string } }
  | { id: string; method: "forkSession"; params: { sessionId: string; messageId?: string } }
  | { id: string; method: "shareSession"; params: { sessionId: string } }
  | { id: string; method: "unshareSession"; params: { sessionId: string } }
  | { id: string; method: "summarizeSession"; params: { sessionId: string } }
  | { id: string; method: "sendPrompt"; params: { sessionId: string; body: PromptInput } }
  | { id: string; method: "sendCommand"; params: { sessionId: string; command: string; args: string } }
  | { id: string; method: "abort"; params: { sessionId: string } }
  | {
      id: string
      method: "respondPermission"
      params: { sessionId: string; permissionId: string; response: PermissionResponse; remember?: boolean }
    }
  | { id: string; method: "getProviders"; params?: undefined }
  | { id: string; method: "getAgents"; params?: undefined }
  | { id: string; method: "getCommands"; params?: undefined }
  | { id: string; method: "getConfig"; params?: undefined }
  | { id: string; method: "getTodos"; params: { sessionId: string } }
  | { id: string; method: "pickFiles"; params?: undefined }
  | { id: string; method: "openFile"; params: { path: string } }
  | { id: string; method: "applyToEditor"; params: { path: string; content: string } }
  | { id: string; method: "showDiff"; params: { path: string; before: string; after: string } }
  | { id: string; method: "revertMessage"; params: { sessionId: string; messageId: string } }
  | { id: string; method: "copyToClipboard"; params: { text: string } }
  | { id: string; method: "restartServer"; params?: undefined }
  | { id: string; method: "savePrefs"; params: UserPrefs }

// ---------- Extension -> Webview ----------

export interface UserPrefs {
  sessionId?: string | null
  model?: { providerID: string; modelID: string } | null
  agent?: string | null
  approvalMode?: string
}

export interface Snapshot {
  connected: boolean
  version: string
  directory: string
  sessions: Session[]
  currentSessionId: string | null
  messages: MessageWithParts[]
  providers: Provider[]
  defaults: Record<string, string>
  agents: Agent[]
  commands: Command[]
  config: Config
  statuses: Record<string, string>
  prefs: UserPrefs
}

export type WebviewMessage =
  | { type: "hello"; snapshot: Snapshot }
  | { type: "result"; id: string; ok: boolean; data?: unknown; error?: string }
  | { type: "event"; event: OpenCodeEvent }
  | { type: "connected"; version: string }
  | { type: "disconnected"; error: string }
  | { type: "insertPrompt"; text: string; autoSend?: boolean }
  | { type: "command"; command: "newSession" }
