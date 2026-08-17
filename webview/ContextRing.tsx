import { computed } from "@preact/signals"
import { messages, model, providers, contextLimit } from "./store"
import { t2 } from "./i18n"

function fmtTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
}

/** 模型未提供且未自定义时的估算值 */
const FALLBACK_LIMIT = 200000

export function ContextRing() {
  const info = computed(() => {
    const custom = contextLimit.value
    const m = model.value
    let modelLimit = 0
    if (m) {
      const p = providers.value.find((x) => x.id === m.providerID)
      modelLimit = p?.models[m.modelID]?.limit?.context ?? 0
    }
    const assistant = [...messages.value].reverse().find((x) => x.info.role === "assistant")
    const tokens = (assistant?.info as any)?.tokens
    // 上下文占用 = 最后一次请求的总输入（input 已含历史与缓存命中，勿再加 cache.read，避免重复计数）
    const used = tokens?.input ?? 0
    // 优先级：自定义 > 模型自带 > 估算
    const known = custom > 0 || modelLimit > 0
    const limit = custom > 0 ? custom : modelLimit > 0 ? modelLimit : FALLBACK_LIMIT
    return { used, limit, known, custom }
  })

  const { used, limit, known, custom } = info.value
  const pct = Math.min(100, Math.round((used / limit) * 100))
  const R = 15.915
  const C = 2 * Math.PI * R
  const color = pct > 90 ? "var(--danger)" : pct > 70 ? "var(--warn)" : "var(--accent)"

  const title = custom > 0
    ? t2("context.titleCustom", { used: fmtTokens(used), limit: fmtTokens(limit), pct })
    : known
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
      <span class="context-ring-label">{used > 0 ? `${fmtTokens(used)}/${fmtTokens(limit)}` : "—"}</span>
    </div>
  )
}
