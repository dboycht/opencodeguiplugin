import type { Permission } from "../src/types"
import { respondPermission } from "./store"
import { IconWarn } from "./icons"

export function PermissionCard({ permission }: { permission: Permission }) {
  const pattern = Array.isArray(permission.pattern)
    ? permission.pattern.join(", ")
    : permission.pattern

  return (
    <div class="permission-card">
      <div class="permission-head">
        <span class="permission-ic"><IconWarn size={14} /></span>
        <div class="permission-info">
          <div class="permission-title">{permission.title || "需要授权"}</div>
          <div class="permission-detail">
            {permission.type}
            {pattern ? ` · ${pattern}` : ""}
          </div>
        </div>
      </div>
      <div class="permission-actions">
        <button class="btn btn-allow" onClick={() => void respondPermission(permission.id, "once")}>
          允许一次
        </button>
        <button class="btn btn-allow-all" onClick={() => void respondPermission(permission.id, "always", true)}>
          始终允许
        </button>
        <button class="btn btn-deny" onClick={() => void respondPermission(permission.id, "reject")}>
          拒绝
        </button>
      </div>
    </div>
  )
}
