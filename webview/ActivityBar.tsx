import { useEffect, useState } from "preact/hooks"
import { lastActiveTool, abortSession, messages } from "./store"
import { IconSpinner, IconStop } from "./icons"

function fmtTime(sec: number): string {
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}m ${s.toString().padStart(2, "0")}s`
}

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

/**
 * 粘性活动栏：生成期间始终可见，展示当前状态 + 醒目的「停止」按钮。
 */
export function ActivityBar() {
  const [now, setNow] = useState(() => Date.now())
  const [start] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const elapsed = Math.floor((now - start) / 1000)
  const tool = lastActiveTool.value

  // 当前 assistant 消息的 token 统计
  const assistant = [...messages.value].reverse().find((m) => m.info.role === "assistant")
  const tokens = (assistant?.info as any)?.tokens as { input?: number; output?: number; reasoning?: number } | undefined

  // 流式思考内容预览
  const reasoning = [...messages.value]
    .reverse()
    .flatMap((m) => m.parts)
    .find((p) => p.type === "reasoning") as { text?: string } | undefined
  const reasoningPreview = reasoning?.text ? reasoning.text.trim() : ""

  const bits: string[] = []
  if (tokens?.input) bits.push(`输入 ${fmtTokens(tokens.input)}`)
  if (tokens?.output) bits.push(`输出 ${fmtTokens(tokens.output)}`)
  if (tokens?.reasoning) bits.push(`思考 ${fmtTokens(tokens.reasoning)}`)

  return (
    <div class="activity-bar">
      <div class="activity-head">
        <IconSpinner size={14} class="spin" />
        <span class="activity-label">OpenCode 正在处理…</span>
        {tool && (
          <span class="activity-tool">
            使用 <code>{tool}</code>
          </span>
        )}
        <span class="activity-time">{fmtTime(elapsed)}</span>
        {bits.length > 0 && <span class="activity-tokens">{bits.join(" · ")} tokens</span>}
        <span class="activity-spacer" />
        <button class="btn btn-stop btn-sm" onClick={() => void abortSession()} title="停止当前生成（Ctrl+Shift+P：OpenCode 停止服务）">
          <IconStop size={14} />
          <span>停止</span>
        </button>
      </div>
      {reasoningPreview && (
        <div class="activity-reasoning">
          <span class="activity-reasoning-label">思考中</span>
          <span class="activity-reasoning-text">{reasoningPreview.slice(0, 240)}</span>
        </div>
      )}
    </div>
  )
}
