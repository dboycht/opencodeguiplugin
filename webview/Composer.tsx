import { useRef, useState } from "preact/hooks"
import { computed } from "@preact/signals"
import {
  currentId,
  drafts,
  attachments,
  isBusy,
  sendPrompt,
  abortSession,
  commands,
  history,
  searchFiles,
} from "./store"
import { call } from "./api"
import { t } from "./i18n"
import { ModelPicker } from "./ModelPicker"
import { AgentPicker } from "./AgentPicker"
import { ApprovalModePicker } from "./ApprovalModePicker"
import { CommandPicker } from "./CommandPicker"
import { ContextRing } from "./ContextRing"
import { IconSend, IconStop, IconFile, IconClose, IconCommand } from "./icons"
import type { PromptPart } from "../src/types"

function toFileUrl(p: string): string {
  const n = p.replaceAll("\\", "/")
  return n.startsWith("/") ? `file://${n}` : `file:///${n}`
}

function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
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

  // @ 引用文件
  const [atOpen, setAtOpen] = useState(false)
  const [atItems, setAtItems] = useState<string[]>([])
  const [atIndex, setAtIndex] = useState(0)
  const atTimer = useRef<number | null>(null)

  // 输入历史（↑/↓）
  const histIdxRef = useRef(-1)
  const savedDraftRef = useRef("")

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

  const loadAt = (q: string) => {
    if (atTimer.current) window.clearTimeout(atTimer.current)
    atTimer.current = window.setTimeout(async () => {
      const items = await searchFiles(q)
      setAtItems(items)
      setAtIndex(0)
    }, 200)
  }

  const pickAt = (path: string) => {
    const m = /(^|\s)@([^\s@]*)$/.exec(draft.value)
    const id = currentId.value
    if (!id) return
    if (m) {
      setDraft(draft.value.slice(0, m.index + m[1].length))
    }
    const parts = attachments.value[id] ?? []
    attachments.value = {
      ...attachments.value,
      [id]: [
        ...parts,
        { id: `prt_at_${Date.now()}`, type: "file", mime: "text/plain", filename: basename(path), url: toFileUrl(path) },
      ],
    }
    setAtOpen(false)
    taRef.current?.focus()
  }

  const navHistory = (dir: number) => {
    const hist = history.value
    if (hist.length === 0) return
    if (histIdxRef.current === -1) savedDraftRef.current = draft.value
    let ni = histIdxRef.current + dir
    ni = Math.max(-1, Math.min(ni, hist.length - 1))
    histIdxRef.current = ni
    setDraft(ni === -1 ? savedDraftRef.current : hist[hist.length - 1 - ni])
    taRef.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    // @ 弹窗优先处理
    if (atOpen) {
      if (e.key === "ArrowUp") {
        e.preventDefault()
        if (atItems.length) setAtIndex((i) => (i <= 0 ? atItems.length - 1 : i - 1))
        return
      }
      if (e.key === "ArrowDown") {
        e.preventDefault()
        if (atItems.length) setAtIndex((i) => (i >= atItems.length - 1 ? 0 : i + 1))
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        if (atItems.length) pickAt(atItems[atIndex])
        return
      }
      if (e.key === "Escape") {
        e.preventDefault()
        setAtOpen(false)
        return
      }
    }

    if (e.key === "ArrowUp") {
      e.preventDefault()
      navHistory(-1)
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      navHistory(1)
      return
    }
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      if (slash.value !== null && slashMatches.value.length > 0) pickSlash(slashMatches.value[0].name)
      else void submit()
      return
    }
    if (e.key === "Escape" && slash.value !== null) {
      e.preventDefault()
      setDraft("")
    }
  }

  const onInput = (e: Event) => {
    const t = e.target as HTMLTextAreaElement
    const val = t.value
    setDraft(val)
    t.style.height = "auto"
    t.style.height = `${Math.min(t.scrollHeight, 240)}px`

    // @ 引用检测：draft 尾部 @query
    const atMatch = /(^|\s)@([^\s@]*)$/.exec(val)
    if (atMatch) {
      setAtOpen(true)
      loadAt(atMatch[2])
    } else {
      setAtOpen(false)
      if (atTimer.current) {
        window.clearTimeout(atTimer.current)
        atTimer.current = null
      }
    }
  }

  const busy = isBusy.value

  return (
    <div class="composer">
      {atOpen && (
        <div class="at-popup">
          {atItems.length === 0 ? (
            <div class="slash-empty">@ {t("composer.atEmpty")}</div>
          ) : (
            atItems.map((p, i) => (
              <button
                key={p}
                class={`at-item${i === atIndex ? " selected" : ""}`}
                onMouseEnter={() => setAtIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pickAt(p)
                }}
              >
                <IconFile size={13} />
                <span class="at-name">{basename(p)}</span>
                <span class="at-path">{p}</span>
              </button>
            ))
          )}
        </div>
      )}

      {slash.value !== null && (
        <div class="slash-menu">
          {slashMatches.value.length === 0 ? (
            <div class="slash-empty">{t("composer.empty")}</div>
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
            <span key={p.id} class="chip" title={(p as any).filename}>
              <IconFile size={13} />
              <span class="chip-text">{(p as any).filename}</span>
              <button class="chip-close" onClick={() => removeAttachment(p.id)} title={t("composer.attach")}>
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
          placeholder={`${t("composer.placeholder")} · ${t("composer.atHint")}`}
          rows={1}
          value={draft.value}
          onInput={onInput}
          onKeyDown={onKeyDown}
        />
        <div class="composer-toolbar">
          <div class="composer-pickers">
            <button class="btn btn-ghost btn-sm" onClick={attachFiles} title={t("composer.attach")}>
              <IconFile size={14} />
              <span>{t("composer.attach")}</span>
            </button>
            <ModelPicker />
            <AgentPicker />
            <ApprovalModePicker />
            <CommandPicker />
          </div>
          <div class="composer-actions">
            <ContextRing />
            <span class="composer-hint">{t("composer.hint")}</span>
            {busy ? (
              <button class="btn btn-stop" onClick={() => void abortSession()} title={t("composer.stop")}>
                <IconStop size={14} />
                <span>{t("composer.stop")}</span>
              </button>
            ) : (
              <button class="btn btn-send" onClick={() => void submit()} disabled={!draft.value.trim()} title={t("composer.send")}>
                <IconSend size={14} />
                <span>{t("composer.send")}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
