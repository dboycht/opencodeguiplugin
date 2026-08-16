import { toasts } from "./store"
import { IconClose } from "./icons"

export function Toasts() {
  const list = toasts.value
  if (list.length === 0) return null
  return (
    <div class="toasts">
      {list.map((t) => (
        <div key={t.id} class={`toast toast-${t.variant}`}>
          {t.title && <div class="toast-title">{t.title}</div>}
          <div class="toast-message">{t.message}</div>
          <button
            class="toast-close"
            onClick={() => (toasts.value = toasts.value.filter((x) => x.id !== t.id))}
          >
            <IconClose size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
