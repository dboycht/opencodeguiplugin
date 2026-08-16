import { useRef } from "preact/hooks"
import { computed } from "@preact/signals"
import { currentId, drafts, attachments, isBusy, sendPrompt, abortSession, commands } from "./store"
import { call } from "./api"
import { ModelPicker } from "./ModelPicker"
import { AgentPicker } from "./AgentPicker"
import { ApprovalModePicker } from "./ApprovalModePicker"
import { IconSend, IconStop, IconFile, IconClose, IconCommand } from "./icons"
import type { PromptPart } from "../src/types"

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

  // 斜杠命令菜单
  const slash = computed<string | null>(() => {
    const m = /^\/(\S*)$/.exec(draft.value)
    return m ? m[1] : null
  })
  const slashMatches = computed(() => {
    const q = slash.value
    if (q === null) return []
    return commands.value
      .filter((c) => c.name.startsWith(q) || (q === "" && true))
      .slice(0, 12)
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
    const newParts: PromptPart[] = picked.map((f, i) => ({
      id: `prt_${Date.now()}_${i}`,
      type: "file",
      mime: "text/plain",
      filename: f.name,
      url: toFileUrl(f.path),
    }))
    attachments.value = { ...attachments.value, [id]: [...list, ...newParts] }
  }

  const removeAttachment = (partId: string | undefined) => {
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

  const pickSlash = (name: string) => {
    setDraft(`/${name} `)
    taRef.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      if (slash.value !== null && slashMatches.value.length > 0) {
        pickSlash(slashMatches.value[0].name)
      } else {
        void submit()
      }
    }
    if (e.key === "Escape" && slash.value !== null) {
      e.preventDefault()
      setDraft("")
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
      {slash.value !== null && (
        <div class="slash-menu">
          {slashMatches.value.length === 0 ? (
            <div class="slash-empty">未找到匹配的命令，直接输入普通内容发送</div>
          ) : (
            slashMatches.value.map((c) => (
              <button key={c.name} class="slash-item" onClick={() => pickSlash(c.name)}>
                <IconCommand size={13} />
                <code>/{c.name}</code>
                <span class="slash-desc">{c.description ?? ""}</span>
              </button>
            ))
          )}
        </div>
      )}

      {files.value.length > 0 && (
        <div class="composer-files">
          {files.value.map((p) => (
            <span key={p.id} class="chip" title="已添加的上下文文件">
              <IconFile size={13} />
              <span class="chip-text">{(p as any).filename}</span>
              <button class="chip-close" onClick={() => removeAttachment(p.id)} title="移除文件">
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
          placeholder="向 OpenCode 提问…（Enter 发送，Shift+Enter 换行，输入 / 查看命令）"
          rows={1}
          value={draft.value}
          onInput={onInput}
          onKeyDown={onKeyDown}
        />
        <div class="composer-toolbar">
          <div class="composer-left">
            <button class="btn btn-ghost btn-sm" onClick={attachFiles} title="添加本地文件作为对话上下文">
              <IconFile size={14} />
              <span>附件</span>
            </button>
            <ModelPicker />
            <AgentPicker />
            <ApprovalModePicker />
          </div>
          <div class="composer-right">
            {busy ? (
              <button class="btn btn-stop" onClick={() => void abortSession()} title="中断当前生成">
                <IconStop size={14} />
                <span>停止</span>
              </button>
            ) : (
              <button class="btn btn-send" onClick={() => void submit()} disabled={!draft.value.trim()} title="发送消息">
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
