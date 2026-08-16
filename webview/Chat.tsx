import { useEffect, useRef, useState } from "preact/hooks"
import {
  messages,
  currentSession,
  isBusy,
  todos,
  pendingPermissions,
  shareSession,
  forkSession,
  summarizeSession,
  deleteSession,
  toggleSidebar,
  connected,
  connError,
  sendPrompt,
} from "./store"
import { call } from "./api"
import { t } from "./i18n"
import { MessageView } from "./MessageView"
import { Composer } from "./Composer"
import { PermissionCard } from "./PermissionCard"
import { ActivityBar } from "./ActivityBar"
import { IconShare, IconBranch, IconBook, IconTrash, IconMenu, IconWarn } from "./icons"

const EXAMPLES = ["chat.example1", "chat.example2", "chat.example3"]

export function Chat() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickRef = useRef(true) // 用户是否仍停留在底部附近（智能滚动）
  const [showTodos, setShowTodos] = useState(false)
  const session = currentSession.value
  const list = messages.value
  const busy = isBusy.value

  // 切换会话后恢复跟随底部
  useEffect(() => {
    stickRef.current = true
  }, [session?.id])

  // 智能自动滚动：仅在用户位于底部附近时才跟随最新内容
  useEffect(() => {
    const el = scrollRef.current
    if (el && stickRef.current) el.scrollTop = el.scrollHeight
  }, [list, busy])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const runExample = (text: string) => void sendPrompt(text)

  return (
    <div class="chat">
      <div class="chat-header">
        <button class="btn btn-ghost btn-sm chat-menu" onClick={toggleSidebar} title={t("sidebar.close")}>
          <IconMenu size={14} />
          <span>{t("chat.manage")}</span>
        </button>
        <div class="chat-title">
          <span class="chat-title-text">{session?.title ?? t("chat.newSession")}</span>
        </div>
        <div class="chat-actions">
          {todos.value.length > 0 && (
            <button class="btn btn-ghost btn-sm" onClick={() => setShowTodos((v) => !v)} title={t("chat.tasks")}>
              <IconBook size={14} />
              <span>
                {t("chat.tasks")} {todos.value.filter((t) => t.status === "completed").length}/{todos.value.length}
              </span>
            </button>
          )}
          {session && (
            <>
              <button class="icon-btn" onClick={() => void shareSession(session.id)} title="分享会话">
                <IconShare size={14} />
              </button>
              <button class="icon-btn" onClick={() => void forkSession(session.id)} title="复制会话">
                <IconBranch size={14} />
              </button>
              <button class="icon-btn" onClick={() => void summarizeSession(session.id)} title="生成摘要">
                <IconBook size={14} />
              </button>
              <button class="icon-btn danger" onClick={() => void deleteSession(session.id)} title="删除会话">
                <IconTrash size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {!connected.value && (
        <div class="conn-banner">
          <IconWarn size={14} />
          <span>{connError.value || t("chat.notConnected")}</span>
          <button class="btn btn-ghost btn-sm" onClick={() => void call("restartServer")} title={t("chat.reconnect")}>
            {t("chat.reconnect")}
          </button>
        </div>
      )}

      {/* 粘性活动栏：生成期间始终可见，含醒目的停止按钮 */}
      {busy && <ActivityBar />}

      {showTodos && todos.value.length > 0 && (
        <div class="todos">
          {todos.value.map((t) => (
            <div key={t.id} class={`todo todo-${t.status.replace("_", "-")}`}>
              <span class="todo-status">
                {t.status === "completed" ? "✓" : t.status === "in_progress" ? "▶" : "○"}
              </span>
              <span class="todo-content">{t.content}</span>
            </div>
          ))}
        </div>
      )}

      <div class="chat-scroll" ref={scrollRef} onScroll={onScroll}>
        {list.length === 0 && !busy && (
          <div class="empty-state">
            <div class="empty-mark">OC</div>
            <div class="empty-title">{t("chat.emptyTitle")}</div>
            <div class="empty-sub">{t("chat.emptySub")}</div>
            <div class="empty-examples">
              {EXAMPLES.map((key) => (
                <button key={key} class="example-chip" onClick={() => runExample(t(key))}>
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
        )}
        {list.map((m, i) => (
          <MessageView key={m.info.id} message={m} last={i === list.length - 1} />
        ))}
      </div>

      {pendingPermissions.value.map((p) => (
        <PermissionCard key={p.id} permission={p} />
      ))}

      <Composer />
    </div>
  )
}
