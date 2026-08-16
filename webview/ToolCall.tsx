import { useEffect, useRef, useState } from "preact/hooks"
import type { ToolPart } from "../src/types"
import { IconTerminal, IconFile, IconSearch, IconRobot, IconCheck, IconWarn, IconSpinner, IconChevron } from "./icons"
import { escapeHtml } from "./markdown"
import { t } from "./i18n"

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

function fmtTime(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}m ${s.toString().padStart(2, "0")}s`
}

export function ToolCall({ part }: { part: ToolPart }) {
  const s = part.state
  const [open, setOpen] = useState(s.status === "running" || s.status === "pending")
  const [now, setNow] = useState(() => Date.now())
  const prevStatus = useRef<string | null>(null)

  // 运行中 / 刚完成时自动展开，让用户看到正在执行什么
  useEffect(() => {
    const prev = prevStatus.current
    prevStatus.current = s.status
    if (prev !== null && prev !== s.status && (s.status === "running" || s.status === "completed")) {
      setOpen(true)
    }
  }, [s.status])

  // 运行中计时
  useEffect(() => {
    if (s.status !== "running") return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [s.status])

  const Icon = toolIcon(part.tool)
  const summary = summarize((s.input ?? {}) as Record<string, unknown>, part.tool)
  const title = "title" in s ? (s as any).title : part.tool
  const output = "output" in s ? (s as any).output : ""
  const error = "error" in s ? (s as any).error : ""
  const running = s.status === "running" || s.status === "pending"
  const elapsed =
    running && (s as any).time?.start ? fmtTime(Math.max(0, Math.floor((now - (s as any).time.start) / 1000))) : ""

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
      <button class="tool-head" onClick={() => setOpen((v) => !v)} title={open ? t("msg.collapse") : t("msg.expand")}>
        <span class="tool-ic"><Icon size={14} /></span>
        <span class="tool-name">{title || part.tool}</span>
        {summary && summary !== title && <span class="tool-summary">{summary}</span>}
        {running && elapsed && <span class="tool-elapsed">{elapsed}</span>}
        {statusIcon}
        <span class="tool-chev"><IconChevron size={13} class={open ? "open" : ""} /></span>
      </button>
      {open && (
        <div class="tool-body">
          {summary && (
            <div class="tool-input">
              <span class="tool-input-label">{t("tool.input")}</span>
              <code>{summary}</code>
            </div>
          )}
          {error && <pre class="tool-error">{error}</pre>}
          {output && (
            <pre
              class="tool-output"
              dangerouslySetInnerHTML={{ __html: escapeHtml(output) }}
            />
          )}
          {running && !output && <div class="tool-running-hint">{t("tool.running")}</div>}
        </div>
      )}
    </div>
  )
}
