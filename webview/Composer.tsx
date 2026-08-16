import { useRef } from "preact/hooks"
import { computed } from "@preact/signals"
import { currentId, drafts, attachments, isBusy, sendPrompt, abortSession } from "./store"
import { call } from "./api"
import { ModelPicker } from "./ModelPicker"
import { AgentPicker } from "./AgentPicker"
import { IconSend, IconStop, IconFile, IconClose } from "./icons"
import type { Part } from "../src/types"

function toFileUrl(p: string): string {
  const n = p.replaceAll("\\", "/")
  return n.startsWith("/") ? `file://${n}` : `file:///${n}`
}

export function Composer() {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const draft = computed(() => drafts.value[currentId.value ?? ""] ?? "")
  const files = computed(() => {
    const id = currentId.value
    return id ? attachments.value[id] ?? [] : []
  })

  const setDraft = (v: string) => {
    const id = currentId.value
    if (id) drafts.value = { ...drafts.value, [id]: v }
  }

  const attachFiles = async () => {
    const picked = (await call<{ path: string; name: string }[]>("pickFiles")) ?? []
    if (picked.length === 0) return
    const id = currentId.value
    if (!id) return
    const list = attachments.value[id] ?? []
    const newParts: Part[] = picked.map((f, i) => ({
      id: `f:${Date.now()}:${i}`,
      sessionID: id,
      messageID: "",
      type: "file",
      mime: "text/plain",
      filename: f.name,
      url: toFileUrl(f.path),
    }))
    attachments.value = { ...attachments.value, [id]: [...list, ...newParts] }
  }

  const removeAttachment = (partId: string) => {
    const id = currentId.value
    if (!id) return
    attachments.value = { ...attachments.value, [id]: files.value.filter((p) => p.id !== partId) }
  }

  const submit = async () => {
    const text = draft.value.trim()
    if (!text) return
    setDraft("")
    await sendPrompt(text)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      void submit()
    }
  }

  const onInput = (e: Event) => {
    const t = e.target as HTMLTextAreaElement
    setDraft(t.value)
    t.style.height = "auto"
    t.style.height = `${Math.min(t.scrollHeight, 240)}px`
  }

  const busy = isBusy.value

  return (
    <div class="composer">
      {files.value.length > 0 && (
        <div class="composer-files">
          {files.value.map((p) => (
            <span key={p.id} class="chip">
              <IconFile size={13} />
              <span class="chip-text">{(p as any).filename}</span>
              <button class="chip-close" onClick={() => removeAttachment(p.id)}>
                <IconClose size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div class="composer-box">
        <textarea
          ref={taRef}
          class="composer-input"
          placeholder="向 OpenCode 提问…（Enter 发送，Shift+Enter 换行）"
          rows={1}
          value={draft.value}
          onInput={onInput}
          onKeyDown={onKeyDown}
        />
        <div class="composer-toolbar">
          <div class="composer-left">
            <button class="icon-btn" onClick={attachFiles} title="添加文件">
              <IconFile size={15} />
            </button>
            <ModelPicker />
            <AgentPicker />
          </div>
          <div class="composer-right">
            {busy ? (
              <button class="btn btn-stop" onClick={() => void abortSession()} title="中断生成">
                <IconStop size={14} />
                <span>停止</span>
              </button>
            ) : (
              <button class="btn btn-send" onClick={() => void submit()} disabled={!draft.value.trim()} title="发送">
                <IconSend size={14} />
                <span>发送</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
