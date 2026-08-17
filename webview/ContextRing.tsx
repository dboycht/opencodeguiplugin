import { computed } from "@preact/signals"
import { messages, model, providers } from "./store"
import { t2 } from "./i18n"

function fmtTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

/** 模型未提供上下文上限时的估算值 */
const FALLBACK_LIMIT = 200000

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
    // 上下文占用 = 输入（含缓存命中）+ 缓存读取
    const used = (tokens?.input ?? 0) + (tokens?.cache?.read ?? 0)
    const known = limit > 0
    return { used, limit: known ? limit : FALLBACK_LIMIT, known }
  })

  const { used, limit, known } = info.value
  const pct = Math.min(100, Math.round((used / limit) * 100))
  const R = 15.915
  const C = 2 * Math.PI * R
  const color = pct > 90 ? "var(--danger)" : pct > 70 ? "var(--warn)" : "var(--accent)"

  const title = known
    ? t2("context.title", { used: fmtTokens(used), limit: fmtTokens(limit), pct })
    : t2("context.titleGuess", { used: fmtTokens(used), pct })

  return (
    <div class="context-ring-wrap" title={title}>
      <div class="context-ring">
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
          {used > 0 ? `${pct}%` : "0"}
        </span>
      </div>
      <span class="context-ring-label">{used > 0 ? `${fmtTokens(used)}${known ? `/${fmtTokens(limit)}` : ""}` : "—"}</span>
    </div>
  )
}
