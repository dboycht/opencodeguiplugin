import { useEffect, useRef, useState } from "preact/hooks"
import { messages, currentSession, isBusy, todos, pendingPermissions, shareSession, forkSession, summarizeSession, deleteSession, toggleSidebar } from "./store"
import { MessageView } from "./MessageView"
import { Composer } from "./Composer"
import { PermissionCard } from "./PermissionCard"
import { IconShare, IconBranch, IconBook, IconTrash, IconSpinner, IconMenu } from "./icons"

export function Chat() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showTodos, setShowTodos] = useState(false)
  const session = currentSession.value
  const list = messages.value
  const busy = isBusy.value

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [list.length, busy])

  return (
    <div class="chat">
      <div class="chat-header">
        <button class="icon-btn chat-menu" onClick={toggleSidebar} title="切换会话列表">
          <IconMenu size={15} />
        </button>
        <div class="chat-title">
          <span class="chat-title-text">{session?.title ?? "新会话"}</span>
        </div>
        <div class="chat-actions">
          {todos.value.length > 0 && (
            <button class="btn btn-ghost" onClick={() => setShowTodos((v) => !v)} title="任务列表">
              <IconBook size={14} />
              <span>任务 {todos.value.filter((t) => t.status === "completed").length}/{todos.value.length}</span>
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

      <div class="chat-scroll" ref={scrollRef}>
        {list.length === 0 && !busy && (
          <div class="empty-state">
            <div class="empty-title">开始与 OpenCode 对话</div>
            <div class="empty-sub">描述你的需求，AI 将读取、编辑代码并执行命令。</div>
          </div>
        )}
        {list.map((m, i) => (
          <MessageView key={m.info.id} message={m} last={i === list.length - 1} />
        ))}
        {busy && (
          <div class="busy-indicator">
            <IconSpinner size={14} class="spin" />
            <span>OpenCode 正在思考…</span>
          </div>
        )}
      </div>

      {pendingPermissions.value.map((p) => (
        <PermissionCard key={p.id} permission={p} />
      ))}

      <Composer />
    </div>
  )
}
