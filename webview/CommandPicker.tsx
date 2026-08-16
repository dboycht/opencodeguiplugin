import { useRef, useState } from "preact/hooks"
import { commands, sendCommand } from "./store"
import { IconCommand, IconChevron, IconSearch } from "./icons"

export function CommandPicker() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  const list = commands.value.filter(
    (c) => !q || c.name.includes(q.toLowerCase()) || (c.description ?? "").toLowerCase().includes(q.toLowerCase()),
  ).slice(0, 30)

  return (
    <div class="picker" ref={ref}>
      <button class="picker-trigger" onClick={() => setOpen((v) => !v)} title="运行原生命令（/命令）">
        <IconCommand size={14} />
        <span class="picker-label">命令</span>
        <IconChevron size={14} />
      </button>
      {open && (
        <div class="picker-menu command-menu">
          <div class="picker-search">
            <IconSearch size={14} />
            <input
              placeholder="搜索命令…"
              value={q}
              onInput={(e) => setQ((e.target as HTMLInputElement).value)}
            />
          </div>
          <div class="picker-list">
            {list.map((c) => (
              <button
                key={c.name}
                class="picker-item"
                onClick={() => {
                  setOpen(false)
                  setQ("")
                  void sendCommand(c.name, "")
                }}
              >
                <IconCommand size={13} />
                <span class="picker-item-name">
                  <code class="command-name">/{c.name}</code>
                  {c.description ? <span class="command-desc">{c.description}</span> : null}
                </span>
              </button>
            ))}
            {list.length === 0 && <div class="picker-empty">未找到匹配命令</div>}
          </div>
        </div>
      )}
    </div>
  )
}
