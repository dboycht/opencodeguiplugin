import { approvalMode, APPROVAL_MODES } from "./store"
import { Dropdown } from "./Dropdown"
import { t } from "./i18n"
import { IconChevron, IconCheck, IconShield } from "./icons"

export function ApprovalModePicker() {
  const current = APPROVAL_MODES.find((m) => m.id === approvalMode.value) ?? APPROVAL_MODES[0]

  return (
    <Dropdown
      width={260}
      align="right"
      trigger={(_, toggle) => (
        <button
          class="picker-trigger approval-trigger"
          onClick={toggle}
          title={t(`approval.${current.id}Desc`)}
        >
          <IconShield size={14} class={`approval-${current.id}`} />
          <span class="picker-label">{t(`approval.${current.id}`)}</span>
          <IconChevron size={14} />
        </button>
      )}
    >
      <div class="picker-group-title">{t("approval.title")}</div>
      <div class="picker-list">
        {APPROVAL_MODES.map((m) => {
          const selected = approvalMode.value === m.id
          return (
            <button
              key={m.id}
              class={`picker-item approval-item${selected ? " selected" : ""}`}
              onClick={() => (approvalMode.value = m.id)}
              title={t(`approval.${m.id}Desc`)}
            >
              <IconShield size={14} class={`approval-${m.id}`} />
              <span class="picker-item-name">
                <span class="approval-label">{t(`approval.${m.id}`)}</span>
                <span class="approval-desc">{t(`approval.${m.id}Desc`)}</span>
              </span>
              {selected && <IconCheck size={14} />}
            </button>
          )
        })}
      </div>
    </Dropdown>
  )
}
