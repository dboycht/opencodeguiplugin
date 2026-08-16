import { agent, agents } from "./store"
import { Dropdown } from "./Dropdown"
import { t } from "./i18n"
import { IconChevron, IconCheck } from "./icons"

export function currentAgentLabel(): string {
  const a = agent.value
  if (!a) return t("sidebar.defaultAgent")
  return agents.value.find((x) => x.name === a)?.name ?? a
}

export function AgentPicker() {
  const primary = agents.value.filter((a) => a.mode !== "subagent")

  return (
    <Dropdown
      width={220}
      align="right"
      trigger={(_, toggle) => (
        <button class="picker-trigger" onClick={toggle} title={t("composer.agent")}>
          <span class="picker-prefix">{t("composer.agent")}</span>
          <span class="picker-label">{currentAgentLabel()}</span>
          <IconChevron size={14} />
        </button>
      )}
    >
      <div class="picker-group-title">{t("composer.agent")}</div>
      <div class="picker-list">
        <button
          class={`picker-item${agent.value === null ? " selected" : ""}`}
          onClick={() => (agent.value = null)}
          title={t("sidebar.defaultAgent")}
        >
          <span class="picker-item-name">{t("sidebar.defaultAgent")}</span>
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
