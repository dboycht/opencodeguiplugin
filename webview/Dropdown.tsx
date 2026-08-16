import { useRef, useState, useEffect } from "preact/hooks"
import type { ComponentChildren } from "preact"

interface DropdownProps {
  trigger: (open: boolean, toggle: () => void) => any
  children: ComponentChildren
  width?: number
  align?: "left" | "right"
}

/**
 * 智能下拉：用 fixed 定位 + 视口边界钳制，避免窄屏/多行布局下菜单被遮挡。
 * 支持点击外部关闭、Esc 关闭。
 */
export function Dropdown({ trigger, children, width = 320, align = "left" }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; bottom: number; width: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const toggle = () => {
    if (open) {
      setOpen(false)
      return
    }
    const t = wrapRef.current
    if (!t) return
    const rect = t.getBoundingClientRect()
    const margin = 6
    const w = Math.min(width, window.innerWidth - 16)
    let left = align === "right" ? rect.right - w : rect.left
    const maxLeft = Math.max(8, window.innerWidth - w - 8)
    left = Math.min(Math.max(8, left), maxLeft)
    const bottom = window.innerHeight - rect.top + margin
    setPos({ left, bottom, width: w })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const el = e.target as Node
      if (wrapRef.current?.contains(el) || menuRef.current?.contains(el)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div class="picker" ref={wrapRef}>
      {trigger(open, toggle)}
      {open && pos && (
        <div
          class="picker-menu"
          ref={menuRef}
          style={{ position: "fixed", left: `${pos.left}px`, bottom: `${pos.bottom}px`, width: `${pos.width}px` }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
