import { useEffect } from "preact/hooks"
import { onMessage, sendReady } from "./api"
import * as store from "./store"
import { Sidebar } from "./Sidebar"
import { Chat } from "./Chat"
import { Toasts } from "./Toasts"
import { call } from "./api"

export function App() {
  useEffect(() => {
    const off = onMessage((msg) => {
      switch (msg.type) {
        case "hello":
          store.loadSnapshot(msg.snapshot)
          break
        case "event":
          store.handleEvent(msg.event)
          break
        case "connected":
          store.setConnected(msg.version)
          void store.refreshSessions()
          void store.refreshMessages()
          void store.refreshMeta()
          break
        case "disconnected":
          store.setDisconnected(msg.error)
          break
        case "command":
          if (msg.command === "newSession") void store.createSession()
          break
        case "insertPrompt":
          void handleInsert(msg.text, msg.autoSend)
          break
        default:
          break
      }
    })

    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest(".copy-btn") as HTMLElement | null
      if (!target) return
      const code = decodeURIComponent(target.dataset.code ?? "")
      void call("copyToClipboard", { text: code }).then(() => {
        target.textContent = "已复制"
        setTimeout(() => (target.textContent = "复制"), 1500)
      })
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") store.closeSidebar()
    }
    document.addEventListener("click", onClick)
    document.addEventListener("keydown", onKey)

    sendReady()
    return () => {
      off()
      document.removeEventListener("click", onClick)
      document.removeEventListener("keydown", onKey)
    }
  }, [])

  async function handleInsert(text: string, autoSend?: boolean) {
    if (!store.currentId.value) {
      await store.createSession()
    }
    const id = store.currentId.value
    if (!id) return
    const prev = store.drafts.value[id] ?? ""
    store.drafts.value = { ...store.drafts.value, [id]: prev ? `${prev}\n\n${text}` : text }
    if (autoSend) {
      void store.sendPrompt(store.drafts.value[id] ?? text)
    }
  }

  return (
    <div class="app">
      <div class="main">
        <Chat />
      </div>
      {store.sidebarOpen.value && <div class="drawer-backdrop" onClick={store.closeSidebar} />}
      <Sidebar />
      <Toasts />
    </div>
  )
}
