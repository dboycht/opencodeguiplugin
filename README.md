# OpenCode 助手（opencode-vscode）

[项目地址](https://github.com/dboycht/opencodeguiplugin)

OpenCode 的 VS Code 图形界面插件。它把 [OpenCode](https://opencode.ai) 从终端搬进 VS Code，提供**中文图形界面**（非终端），并内置了对话管理、模型切换、工具调用可视化等丰富功能，对标市面上的 Cline、Continue、Copilot Chat 等常见 AI 编程插件。

> 原理：插件在本地启动（或连接）`opencode serve` 后端，通过其官方 HTTP/SSE 接口实时通信，因此能复用 opencode 全部的会话、模型、代理、权限与工具能力。

## 功能特性

- **中文图形界面**：完全基于 Webview 的中文 GUI，无需打开终端。
- **对话管理**：
  - 会话列表 + 搜索、新建、重命名、删除、复制（fork）、切换。
  - 会话分享（生成链接并自动复制）、生成摘要。
  - 消息回退（revert）到任意历史节点重试。
- **流式对话**：实时流式输出，支持 Markdown + 代码高亮 + 一键复制代码。
- **思考过程**：展示模型 reasoning，可折叠查看。
- **工具调用可视化**：bash、读文件、编辑、搜索、网络请求等工具调用，实时状态与展开输出。
- **任务列表（Todo）**：展示 opencode 的待办进度。
- **权限控制**：图形化「允许一次 / 始终允许 / 拒绝」授权弹窗。
- **模型 / 代理选择**：按提供商分组的下拉选择器，支持搜索。
- **上下文**：添加文件到对话、将编辑器选中代码一键加入/解释。
- **用量统计**：每条回复展示 token 与成本。
- **服务状态**：状态栏显示连接状态，设置页可查看服务信息并重连。
- **主题自适应**：自动跟随 VS Code 亮/暗主题。

## 安装与使用

### 前置要求

1. 安装 [OpenCode](https://opencode.ai)（`opencode` 命令需在 PATH 中）。
2. 已通过 `opencode auth login` 配置好至少一个模型提供商。

### 本地开发运行

```bash
npm install
npm run watch        # 监听编译
# 在 VS Code 中按 F5，选择「Run Extension」
```

### 打包

```bash
npm install -g @vscode/vsce
npm run package      # 生成 .vsix
```

然后在 VS Code 中：`扩展 → … → 从 VSIX 安装`。

## 使用说明

1. 点击 VS Code **左侧活动栏的 OpenCode 图标**（或 `Ctrl+Shift+P` 运行「OpenCode: 打开对话面板」）打开侧边栏。
2. 侧边栏内左侧为会话列表，顶部 `+` 新建会话；右上角 `☰` 可收起/展开会话列表（窄窗口下自动收起）。
3. 输入框下方选择模型与代理，输入问题后按 `Enter` 发送（`Shift+Enter` 换行）。
4. 点击输入框左侧文件图标可添加本地文件作为上下文。
5. 在编辑器中选中代码，运行「OpenCode: 将选中代码加入对话」或「解释选中代码」。
6. 底部「设置」可查看服务状态与重连。

## 配置项

在 VS Code 设置中搜索 `opencode`：

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `opencode.commandPath` | `opencode` | opencode 可执行文件路径或命令名 |
| `opencode.hostname` | `127.0.0.1` | 服务监听主机 |
| `opencode.port` | `4096` | 服务监听端口 |
| `opencode.autoStart` | `true` | 激活时自动启动服务 |
| `opencode.connectMode` | `auto` | `auto` 自动启动，`manual` 仅连接已运行服务 |
| `opencode.defaultModel` | `""` | 默认模型（`provider/model`），留空用 opencode 全局默认 |
| `opencode.uiLanguage` | `zh-CN` | 界面语言 |

## 常见问题

- **服务鉴权**：若环境中设置了 `OPENCODE_SERVER_PASSWORD`（启用 HTTP Basic Auth），插件会自动读取并使用它（用户名默认 `opencode`，可用 `OPENCODE_SERVER_USERNAME` 覆盖）。
- **会话共享**：会话数据存于 opencode 的本地数据库，插件与终端 TUI 看到的是同一份会话列表。
- **无法连接**：确认 `opencode` 已安装且在 PATH 中；若使用自建服务，可将 `opencode.connectMode` 设为 `manual` 并指向正确端口。

## 项目结构

```
plugin/
├── src/                  # 扩展（Node）端
│   ├── extension.ts      # 入口：命令、状态栏、生命周期
│   ├── manager.ts        # opencode 服务生命周期（spawn serve / 连接）
│   ├── client.ts         # opencode HTTP 客户端 + SSE 事件解析
│   ├── panel.ts          # Webview 面板 + 消息协议分发
│   ├── protocol.ts       # 扩展 ↔ Webview 消息协议
│   └── types.ts          # opencode API 类型（精简）
├── webview/              # Webview（浏览器）端
│   ├── App.tsx           # 根组件 + 事件分发
│   ├── store.ts          # 信号式状态管理（@preact/signals）
│   ├── api.ts            # postMessage 桥接
│   ├── markdown.ts       # Markdown + 代码高亮渲染
│   └── ...               # Sidebar / Chat / MessageView / ToolCall / Composer 等组件
├── esbuild.js            # 打包脚本（扩展 + Webview 双入口）
└── media/icon.svg        # 图标
```

## 技术栈

- TypeScript + esbuild（扩展与 Webview 双端打包）
- Preact + `@preact/signals`（轻量 UI 与响应式状态）
- markdown-it + highlight.js（Markdown 与代码高亮）
- opencode 官方 HTTP / SSE 接口（零额外后端依赖，原生 `fetch`）

## License

MIT
