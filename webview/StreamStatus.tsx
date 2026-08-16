import { useEffect, useState } from "preact/hooks"
import { messages } from "./store"
import { IconSpinner } from "./icons"

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

export function StreamStatus() {
  const [now, setNow] = useState(() => Date.now())
  const [start] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const elapsed = Math.floor((now - start) / 1000)

  // 最后一条 assistant 消息的 token 统计
  const assistant = [...messages.value].reverse().find((m) => m.info.role === "assistant")
  const tokens = (assistant?.info as any)?.tokens as
    | { input?: number; output?: number; reasoning?: number }
    | undefined

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
    <div class="stream-status">
      <div class="stream-head">
        <IconSpinner size={14} class="spin" />
        <span class="stream-label">OpenCode 正在思考…</span>
        <span class="stream-time">{fmtTime(elapsed)}</span>
        {bits.length > 0 && <span class="stream-tokens">{bits.join(" · ")} tokens</span>}
      </div>
      {reasoningPreview && (
        <div class="stream-reasoning">
          <span class="stream-reasoning-label">思考内容</span>
          <span class="stream-reasoning-text">{reasoningPreview.slice(0, 300)}</span>
        </div>
      )}
    </div>
  )
}
