import { signal } from "@preact/signals"
import { call } from "./api"

export type Lang = "zh" | "en"
export const lang = signal<Lang>("en")

type Dict = Record<string, string>

const zh: Dict = {
  "app.name": "OpenCode 助手",
  "app.publisher": "dboycht",

  // 侧边栏
  "sessions.tab": "会话",
  "settings.tab": "设置",
  "sidebar.search": "搜索会话…",
  "sidebar.newSession": "新建会话",
  "sidebar.close": "收起侧栏（Esc）",
  "sidebar.empty": "暂无会话，点击右上角 + 新建",
  "sidebar.defaultAgent": "默认",
  "sidebar.connected": "已连接",
  "sidebar.notConnected": "未连接",

  // 设置页
  "settings.service": "服务",
  "settings.status": "状态",
  "settings.version": "版本",
  "settings.url": "地址",
  "settings.directory": "目录",
  "settings.reconnect": "重连",
  "settings.env": "环境配置",
  "settings.commandPath": "命令路径（commandPath）",
  "settings.port": "端口（port）",
  "settings.defaultModel": "默认模型",
  "settings.defaultModelValue": "（使用 opencode 默认）",
  "settings.modelsAgents": "模型与代理",
  "settings.modelCount": "模型数量",
  "settings.agents": "代理",
  "settings.usage": "使用记录",
  "settings.session": "会话",
  "settings.messages": "消息数",
  "settings.toolCalls": "工具调用",
  "settings.totalTokens": "总 Token",
  "settings.tokenDetail": "Token 明细",
  "settings.cacheIO": "缓存读写",
  "settings.cost": "成本",
  "settings.about": "关于",
  "settings.plugin": "插件",
  "settings.publisher": "发布者",
  "settings.backend": "OpenCode 后端",
  "settings.language": "语言",
  "settings.tip": "更改连接配置后需点击「重连」生效；命令路径与端口会写入 VS Code 设置（opencode.*）。",

  // 对话
  "chat.manage": "会话",
  "chat.tasks": "任务",
  "chat.emptyTitle": "开始与 OpenCode 对话",
  "chat.emptySub": "描述你的需求，AI 将读取、编辑代码并执行命令。可以试试：",
  "chat.newSession": "新会话",
  "chat.notConnected": "未连接到 opencode 服务",
  "chat.reconnect": "重连",
  "chat.thinking": "OpenCode 正在思考…",
  "chat.example1": "帮我看看这个项目的整体结构，并说明它是做什么的",
  "chat.example2": "重构当前打开的文件，让代码更清晰",
  "chat.example3": "写一个函数，用来…",

  // 输入区
  "composer.placeholder": "向 OpenCode 提问…（Enter 发送，Shift+Enter 换行，输入 / 查看命令）",
  "composer.attach": "附件",
  "composer.send": "发送",
  "composer.stop": "停止",
  "composer.hint": "Enter 发送 · Shift+Enter 换行 · / 命令",
  "composer.model": "模型",
  "composer.agent": "智能体",
  "composer.command": "命令",
  "composer.searchModel": "搜索模型…",
  "composer.searchCommand": "搜索命令…",
  "composer.empty": "未找到匹配命令",

  // 审批模式
  "approval.title": "审批模式",
  "approval.ask": "默认询问",
  "approval.askDesc": "编辑、命令等操作都询问你",
  "approval.accept-edits": "自动接受编辑",
  "approval.accept-editsDesc": "自动接受文件编辑，命令仍询问",
  "approval.accept-all": "全部自动",
  "approval.accept-allDesc": "自动接受所有操作，不打断",
  "approval.plan": "计划模式",
  "approval.planDesc": "只读，拒绝编辑和命令执行",

  // 权限
  "perm.need": "需要授权",
  "perm.once": "允许一次",
  "perm.always": "始终允许",
  "perm.reject": "拒绝",

  // 活动栏
  "activity.processing": "OpenCode 正在处理…",
  "activity.using": "使用",
  "activity.thinking": "思考中",
  "activity.firstToken": "首 token {s}s",
  "activity.firstTokenTip": "从发送消息到收到第一个 token 的时间",
  "activity.stop": "停止",

  // 消息
  "msg.you": "你",
  "msg.generating": "正在生成…",
  "msg.thinking": "思考过程",
  "msg.expand": "展开",
  "msg.collapse": "收起",
  "msg.copy": "复制回复",
  "msg.revert": "回退到此消息之前",
  "msg.errorSuffix": "（可点击回退后重试）",

  // 工具
  "tool.input": "输入",
  "tool.running": "执行中，等待输出…",

  // token 短标签
  "tok.input": "输入",
  "tok.output": "输出",
  "tok.reasoning": "思考",
  "tok.read": "读",
  "tok.write": "写",

  // 上下文
  "context.title": "上下文占用：{used} / {limit} tokens（{pct}%）",
  "context.none": "暂无上下文统计",

  // 输入提示
  "composer.atHint": "输入 @ 引用文件",
  "composer.atEmpty": "未找到匹配文件",

  // Plan 审批
  "plan.title": "计划审批",
  "plan.files": "个文件",
  "plan.viewDiff": "查看差异",
  "plan.apply": "应用",
  "plan.reject": "拒绝",
  "plan.close": "关闭",
  "plan.noChanges": "计划已完成，暂无文件变更",

  // 首次引导
  "ob.title": "欢迎使用 OpenCode 助手",
  "ob.sub": "OpenCode 是基于 AI 的编程助手。先做几项检查即可开始。",
  "ob.chooseLang": "选择界面语言",
  "ob.checking": "正在检测 opencode…",
  "ob.installed": "已检测到 opencode",
  "ob.notInstalled": "未检测到 opencode",
  "ob.installNow": "一键安装 opencode",
  "ob.installing": "安装中，请稍候…",
  "ob.npmNote": "将执行：npm install -g opencode-ai（约需 1-3 分钟）。安装后请重启 VS Code。",
  "ob.manualNote": "未检测到 npm。请打开终端手动执行安装命令。",
  "ob.installDone": "安装完成！请重启 VS Code 后重新打开插件。",
  "ob.enter": "开始使用",
  "ob.enterAnyway": "跳过，直接进入",
  "ob.copyCmd": "复制安装命令",
  "ob.copied": "已复制",
}

const en: Dict = {
  "app.name": "OpenCode Assistant",
  "app.publisher": "dboycht",

  "sessions.tab": "Sessions",
  "settings.tab": "Settings",
  "sidebar.search": "Search sessions…",
  "sidebar.newSession": "New session",
  "sidebar.close": "Collapse sidebar (Esc)",
  "sidebar.empty": "No sessions yet. Click + to create one.",
  "sidebar.defaultAgent": "Default",
  "sidebar.connected": "Connected",
  "sidebar.notConnected": "Not connected",

  "settings.service": "Service",
  "settings.status": "Status",
  "settings.version": "Version",
  "settings.url": "Address",
  "settings.directory": "Directory",
  "settings.reconnect": "Reconnect",
  "settings.env": "Environment",
  "settings.commandPath": "Command path (commandPath)",
  "settings.port": "Port",
  "settings.defaultModel": "Default model",
  "settings.defaultModelValue": "(use opencode default)",
  "settings.modelsAgents": "Models & Agents",
  "settings.modelCount": "Models",
  "settings.agents": "Agents",
  "settings.usage": "Usage",
  "settings.session": "Session",
  "settings.messages": "Messages",
  "settings.toolCalls": "Tool calls",
  "settings.totalTokens": "Total tokens",
  "settings.tokenDetail": "Token detail",
  "settings.cacheIO": "Cache R/W",
  "settings.cost": "Cost",
  "settings.about": "About",
  "settings.plugin": "Plugin",
  "settings.publisher": "Publisher",
  "settings.backend": "OpenCode backend",
  "settings.language": "Language",
  "settings.tip": "Changes apply after clicking Reconnect. commandPath & port are saved to VS Code settings (opencode.*).",

  "chat.manage": "Chat",
  "chat.tasks": "Tasks",
  "chat.emptyTitle": "Start a conversation with OpenCode",
  "chat.emptySub": "Describe your task; the AI reads, edits code and runs commands. Try:",
  "chat.newSession": "New session",
  "chat.notConnected": "Not connected to opencode service",
  "chat.reconnect": "Reconnect",
  "chat.thinking": "OpenCode is thinking…",
  "chat.example1": "Explain the overall structure of this project and what it does",
  "chat.example2": "Refactor the currently open file to be cleaner",
  "chat.example3": "Write a function that…",

  "composer.placeholder": "Ask OpenCode… (Enter to send, Shift+Enter for newline, / for commands)",
  "composer.attach": "Attach",
  "composer.send": "Send",
  "composer.stop": "Stop",
  "composer.hint": "Enter send · Shift+Enter newline · / commands",
  "composer.model": "Model",
  "composer.agent": "Agent",
  "composer.command": "Command",
  "composer.searchModel": "Search models…",
  "composer.searchCommand": "Search commands…",
  "composer.empty": "No matching command",

  "approval.title": "Approval mode",
  "approval.ask": "Ask",
  "approval.askDesc": "Ask before edits & commands",
  "approval.accept-edits": "Accept edits",
  "approval.accept-editsDesc": "Auto-accept file edits, still ask for commands",
  "approval.accept-all": "Accept all",
  "approval.accept-allDesc": "Auto-accept everything, no interruption",
  "approval.plan": "Plan",
  "approval.planDesc": "Read-only, reject edits & commands",

  "perm.need": "Permission required",
  "perm.once": "Allow once",
  "perm.always": "Always allow",
  "perm.reject": "Reject",

  "activity.processing": "OpenCode is working…",
  "activity.using": "using",
  "activity.thinking": "Thinking",
  "activity.firstToken": "First token {s}s",
  "activity.firstTokenTip": "Time from send to first token",
  "activity.stop": "Stop",

  "msg.you": "You",
  "msg.generating": "Generating…",
  "msg.thinking": "Thinking",
  "msg.expand": "Expand",
  "msg.collapse": "Collapse",
  "msg.copy": "Copy reply",
  "msg.revert": "Revert to before this message",
  "msg.errorSuffix": " (click revert to retry)",

  "tool.input": "Input",
  "tool.running": "Running, waiting for output…",

  "tok.input": "Input",
  "tok.output": "Output",
  "tok.reasoning": "Reasoning",
  "tok.read": "Read",
  "tok.write": "Write",

  "context.title": "Context used: {used} / {limit} tokens ({pct}%)",
  "context.none": "No context stats yet",

  "composer.atHint": "Type @ to reference a file",
  "composer.atEmpty": "No matching file",

  "plan.title": "Plan Review",
  "plan.files": "files",
  "plan.viewDiff": "View diff",
  "plan.apply": "Apply",
  "plan.reject": "Reject",
  "plan.close": "Close",
  "plan.noChanges": "Plan done, no file changes",

  "ob.title": "Welcome to OpenCode Assistant",
  "ob.sub": "OpenCode is an AI coding assistant. Let's run a few checks first.",
  "ob.chooseLang": "Choose interface language",
  "ob.checking": "Checking for opencode…",
  "ob.installed": "opencode detected",
  "ob.notInstalled": "opencode not found",
  "ob.installNow": "Install opencode",
  "ob.installing": "Installing, please wait…",
  "ob.npmNote": "This will run: npm install -g opencode-ai (takes 1-3 min). Please restart VS Code after install.",
  "ob.manualNote": "npm not found. Please run the install command in a terminal manually.",
  "ob.installDone": "Install complete! Please restart VS Code and reopen the extension.",
  "ob.enter": "Get started",
  "ob.enterAnyway": "Skip for now",
  "ob.copyCmd": "Copy install command",
  "ob.copied": "Copied",
}

export function t(key: string): string {
  return dict[lang.value][key] ?? zh[key] ?? key
}

/** 支持 {s} 占位替换 */
export function t2(key: string, vars: Record<string, string | number>): string {
  let s = t(key)
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
  return s
}

export function setLang(l: Lang) {
  if (lang.value === l) return
  lang.value = l
  void call("savePrefs", { language: l })
}

const dict: Record<Lang, Dict> = { zh, en }
