import { useState } from "preact/hooks"
import {
  filteredSessions,
  currentId,
  currentSession,
  sessionUsage,
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
  appVersion,
  updateSetting,
  toast,
} from "./store"
import { call } from "./api"
import { t, lang, setLang } from "./i18n"
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

function fmtTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n))
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
          <button class="icon-btn new-btn" onClick={() => void createSession()} title={t("sidebar.newSession")}>
            <IconPlus size={16} />
          </button>
          <button class="icon-btn" onClick={closeSidebar} title={t("sidebar.close")}>
            <IconClose size={16} />
          </button>
        </div>
      </div>

      <div class="sidebar-tabs">
        <button
          class={`sidebar-tab${sidebarTab.value === "sessions" ? " active" : ""}`}
          onClick={() => (sidebarTab.value = "sessions")}
        >
          {t("sessions.tab")}
        </button>
        <button
          class={`sidebar-tab${sidebarTab.value === "settings" ? " active" : ""}`}
          onClick={() => (sidebarTab.value = "settings")}
        >
          <IconSettings size={13} />
          {t("settings.tab")}
        </button>
      </div>

      {sidebarTab.value === "sessions" ? (
        <>
          <div class="sidebar-search">
            <IconSearch size={14} />
            <input
              placeholder={t("sidebar.search")}
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
              <div class="session-empty">{t("sidebar.empty")}</div>
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
            {connected.value
              ? `${t("sidebar.connected")} · v${version.value}`
              : connError.value || t("sidebar.notConnected")}
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
  const usage = sessionUsage.value

  const restart = async () => {
    try {
      await call("restartServer")
      toast(t("settings.reconnect"), "info")
    } catch {
      /* 状态由连接事件驱动 */
    }
  }

  const savePort = () => {
    const n = parseInt(port, 10)
    if (!Number.isNaN(n)) void updateSetting("port", n)
    else toast("PORT_INVALID", "warning")
  }

  return (
    <div class="settings-panel">
      <section class="settings-section">
        <h3>{t("settings.service")}</h3>
        <Row label={t("settings.status")}>
          {connected.value ? (
            <span class="pill ok">{t("sidebar.connected")}</span>
          ) : (
            <span class="pill bad">{t("sidebar.notConnected")}</span>
          )}
        </Row>
        <Row label={t("settings.version")}>{version.value || "—"}</Row>
        <Row label={t("settings.url")}>{server.value.url || "—"}</Row>
        <Row label={t("settings.directory")}>{directory.value || "—"}</Row>
        <div class="settings-actions">
          <button class="btn btn-primary btn-sm" onClick={restart} title={t("settings.reconnect")}>
            {t("settings.reconnect")}
          </button>
        </div>
      </section>

      <section class="settings-section">
        <h3>{t("settings.env")}</h3>
        <div class="settings-field">
          <label>{t("settings.commandPath")}</label>
          <input
            value={cmdPath}
            onInput={(e) => setCmdPath((e.target as HTMLInputElement).value)}
            onBlur={() => void updateSetting("commandPath", cmdPath.trim() || "opencode")}
          />
        </div>
        <div class="settings-field">
          <label>{t("settings.port")}</label>
          <input value={port} onInput={(e) => setPort((e.target as HTMLInputElement).value)} onBlur={savePort} />
        </div>
        <div class="settings-field">
          <label>{t("settings.defaultModel")}</label>
          <div class="settings-readonly">{config.value.model ?? t("settings.defaultModelValue")}</div>
        </div>
        <div class="settings-field">
          <label>{t("settings.language")}</label>
          <select class="settings-select" value={lang.value} onChange={(e) => setLang((e.target as HTMLSelectElement).value as "zh" | "en")}>
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </div>
      </section>

      <section class="settings-section">
        <h3>{t("settings.modelsAgents")}</h3>
        <Row label={t("settings.modelCount")}>
          {modelCount}（{providers.value.length}）
        </Row>
        <Row label={t("settings.agents")}>{agents.value.map((a) => a.name).join("、") || "—"}</Row>
      </section>

      <section class="settings-section">
        <h3>{t("settings.usage")}</h3>
        <Row label={t("settings.session")}>{currentSession.value?.title || "—"}</Row>
        <Row label={t("settings.messages")}>
          AI {usage.assistantMessages} · {t("msg.you")} {usage.userMessages}
        </Row>
        <Row label={t("settings.toolCalls")}>{usage.toolCalls}</Row>
        <Row label={t("settings.totalTokens")}>{fmtTokens(usage.total)}</Row>
        <Row label={t("settings.tokenDetail")}>
          {t("tok.input")} {fmtTokens(usage.input)} · {t("tok.output")} {fmtTokens(usage.output)} ·{" "}
          {t("tok.reasoning")} {fmtTokens(usage.reasoning)}
        </Row>
        <Row label={t("settings.cacheIO")}>
          {t("tok.read")} {fmtTokens(usage.cacheRead)} · {t("tok.write")} {fmtTokens(usage.cacheWrite)}
        </Row>
        <Row label={t("settings.cost")}>${usage.cost.toFixed(4)}</Row>
      </section>

      <section class="settings-section">
        <h3>{t("settings.about")}</h3>
        <Row label={t("settings.plugin")}>
          {t("app.name")} v{appVersion.value || "—"}
        </Row>
        <Row label={t("settings.publisher")}>dboycht</Row>
        <Row label={t("settings.backend")}>{version.value || "—"}</Row>
        <div class="settings-actions">
          <a class="about-link" href="https://github.com/dboycht/opencodeguiplugin" target="_blank" rel="noreferrer">
            github.com/dboycht/opencodeguiplugin
          </a>
        </div>
      </section>

      <section class="settings-section settings-tip">{t("settings.tip")}</section>
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
