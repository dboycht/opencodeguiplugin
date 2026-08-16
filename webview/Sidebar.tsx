import { useState } from "preact/hooks"
import { filteredSessions, currentId, selectSession, createSession, deleteSession, renameSession, shareSession, search, view, connected, version, connError, isBusy } from "./store"
import { IconPlus, IconSearch, IconTrash, IconEdit, IconShare, IconSettings, IconSpinner } from "./icons"
import type { Session } from "../src/types"

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return "刚刚"
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} 天前`
  return new Date(ts).toLocaleDateString()
}

export function Sidebar() {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")

  const startEdit = (s: Session) => {
    setEditingId(s.id)
    setEditText(s.title)
  }

  const commitEdit = async () => {
    if (editingId) {
      await renameSession(editingId, editText.trim() || "未命名会话")
      setEditingId(null)
    }
  }

  return (
    <div class="sidebar">
      <div class="sidebar-head">
        <div class="brand">
          <span class="brand-mark">OC</span>
          <span class="brand-name">OpenCode</span>
        </div>
        <button class="icon-btn new-btn" onClick={() => void createSession()} title="新建会话">
          <IconPlus size={16} />
        </button>
      </div>

      <div class="sidebar-search">
        <IconSearch size={14} />
        <input
          placeholder="搜索会话…"
          value={search.value}
          onInput={(e) => (search.value = (e.target as HTMLInputElement).value)}
        />
      </div>

      <div class="session-list">
        {filteredSessions.value.map((s) => {
          const active = s.id === currentId.value
          const busy = isBusy.value && active
          return (
            <div
              key={s.id}
              class={`session-item${active ? " active" : ""}`}
              onClick={() => {
                if (!active) void selectSession(s.id)
              }}
            >
              <div class="session-main">
                {editingId === s.id ? (
                  <input
                    class="session-edit"
                    value={editText}
                    autoFocus
                    onInput={(e) => setEditText((e.target as HTMLInputElement).value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void commitEdit()
                      if (e.key === "Escape") setEditingId(null)
                    }}
                    onBlur={() => void commitEdit()}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <>
                    <div class="session-title">
                      {busy && <IconSpinner size={12} class="spin session-busy" />}
                      <span class="session-title-text">{s.title}</span>
                    </div>
                    <div class="session-time">
                      {timeAgo(s.time.updated)}
                      {s.share?.url ? " · 已分享" : ""}
                    </div>
                  </>
                )}
              </div>
              {active && editingId !== s.id && (
                <div class="session-actions" onClick={(e) => e.stopPropagation()}>
                  <button class="icon-btn" onClick={() => startEdit(s)} title="重命名">
                    <IconEdit size={13} />
                  </button>
                  <button class="icon-btn" onClick={() => void shareSession(s.id)} title="分享">
                    <IconShare size={13} />
                  </button>
                  <button class="icon-btn danger" onClick={() => void deleteSession(s.id)} title="删除">
                    <IconTrash size={13} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
        {filteredSessions.value.length === 0 && (
          <div class="session-empty">暂无会话，点击右上角 + 新建</div>
        )}
      </div>

      <div class="sidebar-foot">
        <button class="foot-item" onClick={() => (view.value = "settings")}>
          <IconSettings size={14} />
          <span>设置</span>
        </button>
        <div class="foot-status">
          {connected.value ? (
            <span class="dot ok" />
          ) : (
            <span class="dot bad" />
          )}
          <span class="foot-status-text">
            {connected.value ? `已连接 · v${version.value}` : connError.value || "未连接"}
          </span>
        </div>
      </div>
    </div>
  )
}
