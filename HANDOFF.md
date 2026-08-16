# 交付文档 — OpenCode 助手插件（opencode-gui-plugin）

> 给接手开发者的交接说明。本文档包含：项目现状、已完成的修复（1.0.8）、核心未解决问题的完整证据链、复现方法、以及下一步该查的方向。

---

## 0. TL;DR

用户核心问题（至今未解决）：

> **对话框在流式对话期间完全不显示任何更新。切换左侧选项卡 / 关闭重开插件后，历史消息才"补加载"出来。**

`1.0.8` 已重写 webview 端流式逻辑，且 **jsdom 端到端测试证明 webview 渲染逻辑完全正常**。但最后一个实验暴露了一个矛盾点：

- 用**插件真实 `client.ts` 的 subscribe 逻辑**直连真实 opencode 服务器 → 事件正常到达。
- 用**插件真实 `manager.ts`**（内部调用同一个 client）→ 事件流里**只有 `server.connected` 和 `server.heartbeat`，完全没有 session 事件**（`message.updated` / `message.part.delta` 一个都没有）。

这个矛盾是找出用户 bug 的**最关键线索**，详见 §4。

---

## 1. 项目现状

| 项 | 值 |
|---|---|
| 路径 | `d:\code\OpenCode\plugin` |
| 版本 | 已升到 **1.0.8**（package.json + CHANGELOG 已更新） |
| 打包产物 | `opencode-gui-plugin-1.0.8.vsix`（420 KB，已在项目根目录） |
| opencode 版本 | 本地已装 **1.18.18**（编译为 exe，无法读源码，只能抓事件流观察） |
| Git | 仓库所有文件均为 untracked，**尚未有任何提交** |

技术栈：TypeScript + esbuild 双端打包（Node 扩展 + Webview）、Preact + @preact/signals、markdown-it + highlight.js。

架构（事件流路径）：

```
opencode serve (SSE /event)
   → src/client.ts  subscribe() 解析 SSE
   → src/manager.ts  OpenCodeManager.emit("event")
   → src/panel.ts  ChatHost 转发 webview.postMessage({type:"event", event})
   → webview/api.ts  window "message" 监听
   → webview/App.tsx  store.handleEvent(msg.event)
   → webview/store.ts  更新 signals → 组件重渲染
```

---

## 2. 已完成的修复（1.0.8，已打包）

对标 Claude Code 的流式体验重构，以下改动均**已通过 tsc --noEmit**：

| 文件 | 改动 |
|---|---|
| `webview/store.ts` | 重写流式核心：`applyDelta`（`message.part.delta` 增量正确追加，缺失 part/消息**自动创建占位**不再丢增量，支持 `field=text/reasoning/output`）；`upsertPart`（`message.part.updated` 全量替换）；`patchMessage` **只替换受影响消息**（其余保持引用稳定，配合 memo 避免每次增量重渲染整列）；`fullTexts` Map 防御全量+增量重复追加；新增 `lastActiveTool` computed |
| `webview/ToolCall.tsx` | 运行时自动展开、显示命令输入、执行计时、完成自动展示输出、错误态清晰、防御性支持 output 增量 |
| `webview/MessageView.tsx` | `memo` 化（`preact/compat` 的 memo）、流式闪烁光标（`<span class="stream-cursor">`）、生成中标记 |
| `webview/ActivityBar.tsx` | **新增**粘性活动栏：生成期间始终可见，显示当前工具/耗时/思考预览 + 醒目的**停止**按钮（调用 store 的 `abortSession`） |
| `webview/Chat.tsx` | 智能自动滚动（用户上翻不再强制滚底）、接入 ActivityBar |
| `webview/styles.css` | 新增活动栏/流式光标/工具运行态样式 |
| 已删除 | `webview/StreamStatus.tsx`（被 ActivityBar 取代） |

版本号：`package.json` → `1.0.8`；`CHANGELOG.md` 已补 1.0.8 条目。

---

## 3. 已验证的结论（证据链）

### 3.1 opencode 1.18.18 真实事件格式（本地抓包确认）

通过 `opencode serve` + 订阅 `/event` + 发送真实提示词抓取到的事件序列：

**文本流式：**
```
message.part.updated  { properties: { part: {type:"text", text:""}, ... } }   ← 先建空 part
message.part.delta    { properties: { sessionID, messageID, partID, field:"text", delta:"完成" } }  ← 增量
message.part.updated  { properties: { part: {type:"text", text:"完成"}, ... } }   ← 全量
```

**工具调用**（bash）：
```
message.part.updated  part.state.status: pending → running×N → completed
```
**关键**：工具输出**不在 running 状态中流式出现**（`state.output` 为空），只在 `completed` 时才有完整 `output`。SSE 不流式工具输出。

`message.part.updated` 的 schema 是 `{ sessionID, part, time }`，**没有 delta 字段**；`message.part.delta` 的 schema 是 `{ sessionID, messageID, partID, field, delta }`。

### 3.2 webview 端渲染逻辑 —— jsdom 端到端测试通过 ✅

用 jsdom 加载**构建产物** `dist/webview.js`（stub 掉 `acquireVsCodeApi`），模拟 `hello` 快照 + 完整事件序列，结果全部正确：

```
hello 加载 → 会话标题/已连接 显示 ✓
session.status busy → 活动栏"OpenCode 正在处理…"出现 ✓
message.updated → 消息 meta 出现 ✓
part.updated + 2×part.delta → "你好，世界" 流式显示 ✓
session.idle → 文本保留 ✓
```

说明 **webview 端（store 信号更新 → 组件重渲染）本身没有 bug**。

### 3.3 扩展端 client 订阅 —— 直连真实服务器通过 ✅

`oc-test/pipeline.js` 复刻 `client.ts` 的 subscribe 逻辑，直连真实 opencode，收到全部 session 事件：
`message.part.delta: ["完成"]`、`message.updated: 6`、`message.part.updated: 5`、`session.idle` 到达。

---

## 4. 核心未解决问题 + 关键矛盾线索 ⚠️

### 4.1 用户报告的现象

> 每次对话流式期间无任何显示更新；只有切换左侧选项卡 / 关闭重开插件后，历史消息才"补加载"出来。

这个现象（"重开能看到、实时不更新"）最符合两种可能：
- **(A)** 实时事件根本没到 webview（扩展端问题）；
- **(B)** 事件到了但被 `handleEvent` 丢弃（如 `part.sessionID !== currentId.value` 匹配失败）。

### 4.2 关键矛盾：真实 manager.ts 收不到 session 事件 ⚠️⚠️

用 esbuild 打包**插件真实 `manager.ts`**（`oc-test/manager-test.ts`），连真实 opencode，发送真实提示词后：

```
[manager state] connecting → connected
session: ses_xxx（创建成功）
prompt sent（promptAsync 未报错）
[manager event] server.connected
[manager event] server.heartbeat ×6
=== SUMMARY ===  events at manager emitter: 7
  deltas for this session: 0     ← 没有
  part.updated: 0                ← 没有
  message.updated: 0             ← 没有
```

**SSE 连接是活的（心跳在流动），但 session 事件一个都没到 manager 的 `event` emitter。**

而 §3.3 用同样的 subscribe 逻辑（pipeline.js）却全部收到。两者唯一差异是走 manager 的完整链路。

**这个矛盾必须优先查**。它直接指向用户 bug 就在扩展端。可能原因（需逐一排查）：
1. **连到了残留的旧服务器**：`manager.start()` 会先 ping 已有服务，若端口上有残留的 `opencode serve`（之前测试未杀干净），会连到它。而 `promptAsync` 用的是同一个 client 同一个 baseUrl，理论上同服……但残留服务可能状态异常。
2. **`finishConnect`/`startEventStream` 的时序**：manager 在 `start()` 里先 ping、再 `finishConnect()` 订阅。若订阅的 SSE 连接建立成功但请求已被 `cancelEvent()` abort 掉（例如被重复调用 startEventStream），则会静默失去事件。
3. **manager 测试本身是测试假象**：可能提示词那一轮生成确实没产生事件（模型不可用/上游失败）。**重新跑 `manager-test.ts` 并打印 `promptAsync` 返回 + 给足等待时间验证**。
4. **`manager.on("event")` 监听注册时机**晚于 `start()`（本测试是注册后才 start，应无此问题）。

> 排查方法：重跑 `oc-test/manager-test.ts`，加打印 `promptAsync` 的 HTTP 状态、打印每个事件的完整 `type`（不过滤）、确认端口上无残留 `opencode serve`（`netstat -ano | grep 4188`）。

### 4.3 次要待排查

- `handleEvent` 里的 `if (part.sessionID !== currentId.value) return`：若 `currentId` 与事件 `sessionID` 不一致（如多会话切换竞态、hello 快照覆盖 currentId），事件会被整批丢弃。需确认真实场景下两者始终一致。
- Webview 在真实 VS Code 环境的 `window "message"` 接收（jsdom 已验证渲染，但未在真机 VS Code 验证）。

---

## 5. 复现/验证用脚本（均在 `C:\Users\micak\oc-test\`）

| 脚本 | 作用 |
|---|---|
| `pipeline.js` | 复刻 client.subscribe 直连真实服务器，验证事件到达（✅ 已通过） |
| `manager-test.ts` | 用 esbuild 打包真实 manager.ts 测事件送达（⚠️ 结果矛盾，见 §4.2） |
| `repro2.js` | jsdom 加载 dist/webview.js，验证 webview 渲染（✅ 已通过） |
| `debug.js` | jsdom 消息投递调试 |
| `repro.js` | 早期复现脚本（时序有问题，已弃用） |

运行方式：`cd C:\Users\micak\oc-test && npm install`（jsdom 已装），`node xxx.js`；ts 文件用 `npx esbuild manager-test.ts --bundle --platform=node --target=node20 --format=cjs --outfile=out.js --external:node:events --external:node:child_process && node out.js`。

`opencode` 可执行文件路径：`C:\Users\micak\AppData\Roaming\npm\node_modules\opencode-ai\bin\opencode.exe`（node spawn 不带 shell 时不会自动用 PATH，需用全路径）。

### 手动复现流式现象（不开 VS Code）

```bash
opencode serve --hostname 127.0.0.1 --port 4096 &
# 订阅 /event，创建会话，POST /session/{id}/prompt_async，观察事件
```

---

## 6. 环境信息

- Windows 11（win32，Git Bash）
- VS Code `engines.vscode ^1.85.0`，插件用 Node 20 / fetch（无运行时依赖）
- opencode 1.18.18，用户配置了多个提供商，含免费模型 `opencode/laguna-s-2.1-free`（本调试用它跑测试，不花钱）
- 构建：`npm run build`（esbuild）；打包：`npm run package`（= esbuild + vsce package）；类型检查：`npm run typecheck`
- 用户 opencode 数据在 `C:\Users\micak\.opencode\opencode.db`（会话与终端 TUI 共享）
- 调试期间创建过 3 个测试会话（plugin-probe 等）**已全部删除**；临时文件已清理；无残留 `opencode serve`（确认 4123/4187/4188 无监听）

---

## 7. 给接手 AI 的下一步建议

按优先级：

1. **重跑 `manager-test.ts` 定位 §4.2 矛盾**——这是离用户 bug 最近的一环：
   - 确认 `promptAsync` 返回 204 且该轮真的生成了文本（打印返回、给足 60s+）；
   - 确认端口 4188 无残留旧服务；
   - 打印 `manager` 收到的**每一个**事件的 type（不要只打印 session 事件）。
   - 若确认 manager 收不到 → 问题在 manager/client 的事件订阅或生命周期；若收得到 → 那 §4.2 是测试假象，转查 §4.3 的 webview/currentId 匹配。
2. **若确定扩展端事件正常**：在真机 VS Code 里加日志（`console.log` 到 Output 面板）确认 webview 是否收到 `event` 消息、`handleEvent` 是否把事件丢弃（打印 `currentId` 与事件 `sessionID`）。
3. **关注 `currentId` 与事件 `sessionID` 匹配**：最可能是多会话/自动建会话竞态导致事件被 `return` 丢弃。
4. 修好后重新 `npm run package` 生成 `opencode-gui-plugin-1.0.8.vsix`（版本号已在 1.0.8）。

## 8. 注意事项

- **不要在用户没要求时执行 `git commit`**（仓库尚无提交）。
- 探针/测试不要污染用户真实会话（用完后删掉测试 session）。
- 修改后跑 `npm run typecheck`（`noUnusedLocals: true`，注意未使用变量）。
- vsce 打包会自动跑 `--production` 构建（压缩版），`dist/webview.js` 从 2.2MB 变 1.2MB 属正常。
