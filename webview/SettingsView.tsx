import { providers, agents, commands, connected, version, connError, directory, config, view } from "./store"
import { call } from "./api"
import { IconBack, IconWarn } from "./icons"

export function SettingsView() {
  const modelCount = providers.value.reduce((n, p) => n + Object.keys(p.models).length, 0)

  const restart = async () => {
    try {
      await call("restartServer")
    } catch (err) {
      /* 状态由连接事件驱动 */
    }
  }

  return (
    <div class="settings">
      <div class="settings-header">
        <button class="icon-btn" onClick={() => (view.value = "chat")} title="返回">
          <IconBack size={16} />
        </button>
        <span class="settings-title">设置</span>
      </div>

      <div class="settings-body">
        <section class="settings-section">
          <h3>服务状态</h3>
          <Row label="连接状态">
            {connected.value ? (
              <span class="pill ok">已连接</span>
            ) : (
              <span class="pill bad">{connError.value || "未连接"}</span>
            )}
          </Row>
          <Row label="版本">{version.value || "—"}</Row>
          <Row label="工作目录">{directory.value || "—"}</Row>
          <div class="settings-actions">
            <button class="btn btn-primary" onClick={restart}>
              重新连接
            </button>
          </div>
        </section>

        <section class="settings-section">
          <h3>模型与代理</h3>
          <Row label="模型数量">
            {modelCount} 个（{providers.value.length} 个提供商）
          </Row>
          <Row label="默认模型">{config.value.model ?? "（使用 opencode 默认）"}</Row>
          <Row label="代理">
            {agents.value.map((a) => a.name).join("、") || "—"}
          </Row>
        </section>

        <section class="settings-section">
          <h3>命令</h3>
          <div class="settings-commands">
            {commands.value.length === 0 && <span class="muted">暂无自定义命令</span>}
            {commands.value.map((c) => (
              <div key={c.name} class="command-row">
                <code>/{c.name}</code>
                <span>{c.description ?? c.template}</span>
              </div>
            ))}
          </div>
        </section>

        {!connected.value && (
          <section class="settings-section">
            <div class="settings-warn">
              <IconWarn size={14} />
              <span>
                无法连接 opencode 服务。请确认已安装 opencode 并在 VS Code 设置中配置
                `opencode.commandPath`。
              </span>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: any }) {
  return (
    <div class="settings-row">
      <span class="settings-row-label">{label}</span>
      <span class="settings-row-value">{children}</span>
    </div>
  )
}
