import { useState } from "preact/hooks"
import {
  filteredSessions,
  currentId,
  selectSession,
  createSession,
  deleteSession,
  renameSession,
  shareSession,
  search,
  connected,
  version,
  connError,
  isBusy,
  closeSidebar,
  sidebarTab,
  sidebarOpen,
  server,
  directory,
  providers,
  agents,
  config,
  updateSetting,
  toast,
} from "./store"
import { call } from "./api"
import {
  IconPlus,
  IconSearch,
  IconTrash,
  IconEdit,
  IconShare,
  IconSettings,
  IconClose,
  IconSpinner,
} from "./icons"
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

  const pick = (id: string) => {
    void selectSession(id)
    closeSidebar()
  }

  return (
    <div class={`sidebar${sidebarOpen.value ? " open" : ""}`}>
      <div class="sidebar-head">
        <div class="brand">
          <span class="brand-mark">OC</span>
          <span class="brand-name">OpenCode</span>
        </div>
        <div class="sidebar-head-actions">
          <button class="icon-btn new-btn" onClick={() => void createSession()} title="新建会话">
            <IconPlus size={16} />
          </button>
          <button class="icon-btn" onClick={closeSidebar} title="收起侧栏（Esc）">
            <IconClose size={16} />
          </button>
        </div>
      </div>

      <div class="sidebar-tabs">
        <button
          class={`sidebar-tab${sidebarTab.value === "sessions" ? " active" : ""}`}
          onClick={() => (sidebarTab.value = "sessions")}
        >
          会话
        </button>
        <button
          class={`sidebar-tab${sidebarTab.value === "settings" ? " active" : ""}`}
          onClick={() => (sidebarTab.value = "settings")}
        >
          <IconSettings size={13} />
          设置
        </button>
      </div>

      {sidebarTab.value === "sessions" ? (
        <>
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
                    if (!active) pick(s.id)
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
        </>
      ) : (
        <SettingsPanel />
      )}

      <div class="sidebar-foot">
        <div class="foot-status">
          {connected.value ? <span class="dot ok" /> : <span class="dot bad" />}
          <span class="foot-status-text">
            {connected.value ? `已连接 · v${version.value}` : connError.value || "未连接"}
          </span>
        </div>
      </div>
    </div>
  )
}

function SettingsPanel() {
  const [cmdPath, setCmdPath] = useState(server.value.commandPath)
  const [port, setPort] = useState(String(server.value.port))
  const modelCount = providers.value.reduce((n, p) => n + Object.keys(p.models).length, 0)

  const restart = async () => {
    try {
      await call("restartServer")
      toast("正在重新连接…", "info")
    } catch {
      /* 状态由连接事件驱动 */
    }
  }

  const savePort = () => {
    const n = parseInt(port, 10)
    if (!Number.isNaN(n)) void updateSetting("port", n)
    else toast("端口必须是数字", "warning")
  }

  return (
    <div class="settings-panel">
      <section class="settings-section">
        <h3>服务</h3>
        <Row label="状态">
          {connected.value ? <span class="pill ok">已连接</span> : <span class="pill bad">未连接</span>}
        </Row>
        <Row label="版本">{version.value || "—"}</Row>
        <Row label="地址">{server.value.url || "—"}</Row>
        <Row label="目录">{directory.value || "—"}</Row>
        <div class="settings-actions">
          <button class="btn btn-primary btn-sm" onClick={restart} title="重新连接 opencode 服务">
            重连
          </button>
        </div>
      </section>

      <section class="settings-section">
        <h3>环境配置</h3>
        <div class="settings-field">
          <label>命令路径（commandPath）</label>
          <input
            value={cmdPath}
            onInput={(e) => setCmdPath((e.target as HTMLInputElement).value)}
            onBlur={() => void updateSetting("commandPath", cmdPath.trim() || "opencode")}
          />
        </div>
        <div class="settings-field">
          <label>端口（port）</label>
          <input value={port} onInput={(e) => setPort((e.target as HTMLInputElement).value)} onBlur={savePort} />
        </div>
        <div class="settings-field">
          <label>默认模型</label>
          <div class="settings-readonly">{config.value.model ?? "（使用 opencode 默认）"}</div>
        </div>
      </section>

      <section class="settings-section">
        <h3>模型与代理</h3>
        <Row label="模型数量">
          {modelCount} 个（{providers.value.length} 提供商）
        </Row>
        <Row label="代理">{agents.value.map((a) => a.name).join("、") || "—"}</Row>
      </section>

      <section class="settings-section settings-tip">
        更改连接配置后需点击「重连」生效；命令路径与端口会写入 VS Code 设置（opencode.*）。
      </section>
    </div>
  )
}

function Row({ label, children }: { label: string; children: any }) {
  return (
    <div class="settings-row">
      <span class="settings-row-label">{label}</span>
      <span class="settings-row-value">{children}</span>
    </div>
  )
}
