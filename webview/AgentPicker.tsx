import { agent, agents } from "./store"
import { Dropdown } from "./Dropdown"
import { IconChevron, IconCheck } from "./icons"

export function currentAgentLabel(): string {
  const a = agent.value
  if (!a) return "默认"
  return agents.value.find((x) => x.name === a)?.name ?? a
}

export function AgentPicker() {
  const primary = agents.value.filter((a) => a.mode !== "subagent")

  return (
    <Dropdown
      width={220}
      align="right"
      trigger={(_, toggle) => (
        <button class="picker-trigger" onClick={toggle} title="选择智能体（Agent）">
          <span class="picker-prefix">智能体</span>
          <span class="picker-label">{currentAgentLabel()}</span>
          <IconChevron size={14} />
        </button>
      )}
    >
      <div class="picker-group-title">智能体</div>
      <div class="picker-list">
        <button
          class={`picker-item${agent.value === null ? " selected" : ""}`}
          onClick={() => (agent.value = null)}
          title="使用默认智能体"
        >
          <span class="picker-item-name">默认</span>
          {agent.value === null && <IconCheck size={14} />}
        </button>
        {primary.map((a) => {
          const selected = agent.value === a.name
          return (
            <button
              key={a.name}
              class={`picker-item${selected ? " selected" : ""}`}
              onClick={() => (agent.value = a.name)}
              title={a.description ?? a.name}
            >
              <span class="picker-item-name">{a.name}</span>
              {selected && <IconCheck size={14} />}
            </button>
          )
        })}
      </div>
    </Dropdown>
  )
}
