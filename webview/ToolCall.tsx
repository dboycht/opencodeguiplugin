import { useState } from "preact/hooks"
import type { ToolPart } from "../src/types"
import { IconTerminal, IconFile, IconSearch, IconRobot, IconCheck, IconWarn, IconSpinner, IconChevron } from "./icons"
import { escapeHtml } from "./markdown"

function toolIcon(tool: string) {
  if (tool === "bash" || tool === "shell") return IconTerminal
  if (tool === "read" || tool === "edit" || tool === "write" || tool === "patch" || tool === "apply_patch") return IconFile
  if (tool === "glob" || tool === "grep" || tool === "find") return IconSearch
  if (tool === "task" || tool === "subagent") return IconRobot
  if (tool === "webfetch" || tool === "websearch") return IconGlobe
  return IconTerminal
}

function IconGlobe(p: { size?: number }) {
  return (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
    </svg>
  )
}

function summarize(input: Record<string, unknown>, tool: string): string {
  const t = tool.toLowerCase()
  if (t === "bash") return String(input.command ?? input.cmd ?? "")
  if (t === "read" || t === "edit" || t === "write" || t === "patch") {
    return String(input.filePath ?? input.path ?? input.file ?? "")
  }
  if (t === "grep") return String(input.pattern ?? "")
  if (t === "glob") return String(input.pattern ?? "")
  if (t === "task") return String(input.prompt ?? "").slice(0, 80)
  if (t === "webfetch") return String(input.url ?? "")
  return ""
}

export function ToolCall({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(false)
  const s = part.state
  const Icon = toolIcon(part.tool)
  const summary = summarize(s.input ?? {}, part.tool)
  const title = "title" in s ? (s as any).title : part.tool
  const output = "output" in s ? (s as any).output : ""
  const error = "error" in s ? (s as any).error : ""

  const statusIcon =
    s.status === "completed" ? (
      <span class="tool-ok"><IconCheck size={13} /></span>
    ) : s.status === "error" ? (
      <span class="tool-err"><IconWarn size={13} /></span>
    ) : (
      <span class="tool-running"><IconSpinner size={13} class="spin" /></span>
    )

  return (
    <div class={`tool-call tool-${s.status}`}>
      <button class="tool-head" onClick={() => setOpen((v) => !v)}>
        <span class="tool-ic"><Icon size={14} /></span>
        <span class="tool-name">{title}</span>
        {summary && <span class="tool-summary">{summary}</span>}
        {statusIcon}
        <span class="tool-chev"><IconChevron size={13} class={open ? "open" : ""} /></span>
      </button>
      {open && (
        <div class="tool-body">
          {error && <pre class="tool-error">{error}</pre>}
          {output && (
            <pre
              class="tool-output"
              dangerouslySetInnerHTML={{ __html: escapeHtml(output) }}
            />
          )}
        </div>
      )}
    </div>
  )
}
