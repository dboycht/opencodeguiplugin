import { useState } from "preact/hooks"
import { approvalMode, APPROVAL_MODES } from "./store"
import { IconChevron, IconCheck, IconShield } from "./icons"

export function ApprovalModePicker() {
  const [open, setOpen] = useState(false)
  const current = APPROVAL_MODES.find((m) => m.id === approvalMode.value) ?? APPROVAL_MODES[0]

  return (
    <div class="picker">
      <button class="picker-trigger approval-trigger" onClick={() => setOpen((v) => !v)} title={`审批模式：${current.desc}`}>
        <IconShield size={14} class={`approval-${current.id}`} />
        <span class="picker-label">{current.label}</span>
        <IconChevron size={14} />
      </button>
      {open && (
        <div class="picker-menu picker-menu-right approval-menu">
          <div class="picker-group-title">审批模式</div>
          <div class="picker-list">
            {APPROVAL_MODES.map((m) => {
              const selected = approvalMode.value === m.id
              return (
                <button
                  key={m.id}
                  class={`picker-item approval-item${selected ? " selected" : ""}`}
                  onClick={() => {
                    approvalMode.value = m.id
                    setOpen(false)
                  }}
                >
                  <IconShield size={14} class={`approval-${m.id}`} />
                  <span class="picker-item-name">
                    <span class="approval-label">{m.label}</span>
                    <span class="approval-desc">{m.desc}</span>
                  </span>
                  {selected && <IconCheck size={14} />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
