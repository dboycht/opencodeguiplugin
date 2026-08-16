import { memo } from "preact/compat"
import { useState } from "preact/hooks"
import type { MessageWithParts, Part, Message } from "../src/types"
import { renderMarkdown } from "./markdown"
import { ToolCall } from "./ToolCall"
import { IconUser, IconRobot, IconCopy, IconBack, IconCheck } from "./icons"
import { call } from "./api"
import { isBusy } from "./store"
import { t } from "./i18n"

function modelLabel(m: Message): string {
  if (m.role === "assistant") return `${m.providerID}/${m.modelID}`
  return `${m.model.providerID}/${m.model.modelID}`
}

/** 流式光标占位标记（渲染后替换为 <span class="stream-cursor">） */
const CURSOR_MARKER = "__OC_CURSOR__"

function formatTokens(m: MessageWithParts): string {
  const t = (m.info as any).tokens
  if (!t) return ""
  const bits: string[] = []
  if (t.input) bits.push(`输入 ${t.input}`)
  if (t.output) bits.push(`输出 ${t.output}`)
  if (t.reasoning) bits.push(`思考 ${t.reasoning}`)
  const cost = (m.info as any).cost
  if (bits.length === 0) return ""
  const costStr = cost ? ` · $${cost.toFixed(4)}` : ""
  return `tokens: ${bits.join(" / ")}${costStr}`
}

function MessageViewInner({ message, last }: { message: MessageWithParts; last?: boolean }) {
  const isUser = message.info.role === "user"
  const [copied, setCopied] = useState(false)
  // 仅当这是最后一条且会话仍在生成时，显示流式光标
  const streaming = !isUser && last === true && isBusy.value

  const textParts = message.parts.filter((p) => p.type === "text") as Array<Extract<Part, { type: "text" }>>
  const reasoning = message.parts.filter((p) => p.type === "reasoning")
  const tools = message.parts.filter((p) => p.type === "tool")
  const files = message.parts.filter((p) => p.type === "file")
  const error = (message.info as any).error

  const copyAll = async () => {
    const text = textParts.map((p) => p.text).join("\n\n")
    if (text) {
      await call("copyToClipboard", { text })
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  const revert = async () => {
    const { revertMessage } = await import("./store")
    void revertMessage(message.info.id)
  }

  return (
    <div class={`msg ${isUser ? "msg-user" : "msg-assistant"}`}>
      <div class="msg-avatar">
        {isUser ? <IconUser size={15} /> : <IconRobot size={15} />}
      </div>
      <div class="msg-body">
        <div class="msg-meta">
          {isUser ? (
            <span class="msg-role">{t("msg.you")}</span>
          ) : (
            <>
              <span class="msg-role">{modelLabel(message.info)}</span>
              {streaming && <span class="msg-streaming">{t("msg.generating")}</span>}
            </>
          )}
        </div>

        {error && (
          <div class="msg-error">
            {(error as any).data?.message ?? "Error"}
            {isUser ? "" : t("msg.errorSuffix")}
          </div>
        )}

        {!isUser && reasoning.length > 0 && (
          <Reasoning parts={reasoning} />
        )}

        {textParts.map((p, i) => {
          // 流式光标：追加标记到最后一个文本 part，渲染后替换为可样式化元素
          const isStreamingLast = streaming && i === textParts.length - 1
          let html = renderMarkdown(p.text + (isStreamingLast ? CURSOR_MARKER : ""))
          if (isStreamingLast) html = html.replaceAll(CURSOR_MARKER, '<span class="stream-cursor"></span>')
          return (
            <div
              key={p.id}
              class="md"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )
        })}

        {files.map((f) => (
          <div key={f.id} class="msg-file">
            <span class="msg-file-name">{(f as any).filename ?? (f as any).url}</span>
          </div>
        ))}

        {tools.map((t) => (
          <ToolCall key={t.id} part={t as any} />
        ))}

        <div class="msg-actions">
          {!isUser && textParts.length > 0 && (
            <button class="icon-btn" onClick={copyAll} title={t("msg.copy")}>
              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            </button>
          )}
          <button class="icon-btn" onClick={revert} title={t("msg.revert")}>
            <IconBack size={14} />
          </button>
        </div>

        {!isUser && last && formatTokens(message) && (
          <div class="msg-usage">{formatTokens(message)}</div>
        )}
      </div>
    </div>
  )
}

export const MessageView = memo(MessageViewInner)

function Reasoning({ parts }: { parts: Part[] }) {
  const [open, setOpen] = useState(false)
  const text = parts
    .filter((p): p is Extract<Part, { type: "reasoning" }> => p.type === "reasoning")
    .map((p) => p.text)
    .join("\n")
  return (
    <div class="reasoning">
      <button class="reasoning-head" onClick={() => setOpen((v) => !v)}>
        <span>🧠 {t("msg.thinking")}</span>
        <span class="reasoning-toggle">{open ? t("msg.collapse") : t("msg.expand")}</span>
      </button>
      {open && <div class="reasoning-body">{text}</div>}
    </div>
  )
}
