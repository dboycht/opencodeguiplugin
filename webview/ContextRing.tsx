import { computed } from "@preact/signals"
import { messages, model, providers } from "./store"

function fmtTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

export function ContextRing() {
  const info = computed(() => {
    const m = model.value
    let limit = 0
    if (m) {
      const p = providers.value.find((x) => x.id === m.providerID)
      limit = p?.models[m.modelID]?.limit?.context ?? 0
    }
    const assistant = [...messages.value].reverse().find((x) => x.info.role === "assistant")
    const tokens = (assistant?.info as any)?.tokens
    const used = (tokens?.input ?? 0) + (tokens?.output ?? 0)
    return { used, limit }
  })

  const { used, limit } = info.value
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const R = 15.915
  const C = 2 * Math.PI * R

  const color = pct > 90 ? "var(--danger)" : pct > 70 ? "var(--warn)" : "var(--accent)"

  return (
    <div
      class="context-ring"
      title={limit > 0 ? `上下文占用：${fmtTokens(used)} / ${fmtTokens(limit)} tokens（${pct}%）` : "暂无上下文统计"}
    >
      <svg width="34" height="34" viewBox="0 0 36 36">
        <circle class="ring-bg" cx="18" cy="18" r={R} />
        <circle
          class="ring-fg"
          cx="18"
          cy="18"
          r={R}
          stroke={color}
          stroke-dasharray={`${(C * pct) / 100} ${C}`}
        />
      </svg>
      <span class="ring-text" style={{ color }}>
        {pct}%
      </span>
    </div>
  )
}
