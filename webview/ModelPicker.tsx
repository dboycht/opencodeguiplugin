import { useState } from "preact/hooks"
import { model, providers } from "./store"
import { Dropdown } from "./Dropdown"
import { IconChevron, IconCheck, IconSearch } from "./icons"

export function currentModelLabel(): string {
  const m = model.value
  if (!m) return "选择模型"
  const p = providers.value.find((p) => p.id === m.providerID)
  const mm = p?.models[m.modelID]
  return mm?.name ?? m.modelID
}

export function ModelPicker() {
  const [q, setQ] = useState("")

  return (
    <Dropdown
      width={320}
      trigger={(_, toggle) => (
        <button class="picker-trigger" onClick={toggle} title="选择模型">
          <span class="picker-prefix">模型</span>
          <span class="picker-label">{currentModelLabel()}</span>
          <IconChevron size={14} />
        </button>
      )}
    >
      <div class="picker-search">
        <IconSearch size={14} />
        <input
          placeholder="搜索模型…"
          value={q}
          onInput={(e) => setQ((e.target as HTMLInputElement).value)}
        />
      </div>
      <div class="picker-list">
        {providers.value.map((p) => {
          const models = Object.values(p.models).filter(
            (m) =>
              !q || m.name.toLowerCase().includes(q.toLowerCase()) || m.id.toLowerCase().includes(q.toLowerCase()),
          )
          if (models.length === 0) return null
          return (
            <div key={p.id} class="picker-group">
              <div class="picker-group-title">{p.name}</div>
              {models.map((m) => {
                const selected = model.value?.modelID === m.id && model.value?.providerID === p.id
                return (
                  <button
                    key={m.id}
                    class={`picker-item${selected ? " selected" : ""}`}
                    onClick={() => {
                      model.value = { providerID: p.id, modelID: m.id }
                    }}
                    title={`${p.name} / ${m.name}`}
                  >
                    <span class="picker-item-name">{m.name}</span>
                    {m.status === "beta" && <span class="badge">beta</span>}
                    {selected && <IconCheck size={14} />}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </Dropdown>
  )
}
