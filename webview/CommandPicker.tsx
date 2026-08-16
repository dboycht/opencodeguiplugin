import { useState } from "preact/hooks"
import { commands, sendCommand } from "./store"
import { Dropdown } from "./Dropdown"
import { IconCommand, IconChevron, IconSearch } from "./icons"

export function CommandPicker() {
  const [q, setQ] = useState("")

  const list = commands.value
    .filter(
      (c) => !q || c.name.includes(q.toLowerCase()) || (c.description ?? "").toLowerCase().includes(q.toLowerCase()),
    )
    .slice(0, 30)

  return (
    <Dropdown
      width={300}
      align="right"
      trigger={(_, toggle) => (
        <button class="picker-trigger" onClick={toggle} title="运行原生命令（/命令）">
          <IconCommand size={14} />
          <span class="picker-label">命令</span>
          <IconChevron size={14} />
        </button>
      )}
    >
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
              setQ("")
              void sendCommand(c.name, "")
            }}
            title={c.description ?? `运行 /${c.name}`}
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
    </Dropdown>
  )
}
