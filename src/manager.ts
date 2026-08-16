import { EventEmitter } from "node:events"
import { spawn, type ChildProcess } from "node:child_process"
import { OpenCodeClient } from "./client"
import type { OpenCodeEvent } from "./types"

export interface OpenCodeManagerOptions {
  commandPath: string
  hostname: string
  port: number
  connectMode: "auto" | "manual"
  directory?: string
}

export type ConnectionState = "disconnected" | "connecting" | "connected" | "error"

export class OpenCodeManager extends EventEmitter {
  client: OpenCodeClient | null = null
  state: ConnectionState = "disconnected"
  lastError = ""
  version = ""
  private child: ChildProcess | null = null
  private cancelEvent: () => void = () => {}
  private disposed = false

  constructor(public options: OpenCodeManagerOptions) {
    super()
  }

  get baseUrl(): string {
    return `http://${this.options.hostname}:${this.options.port}`
  }

  setDirectory(dir?: string) {
    this.options.directory = dir
    this.client = this.newClient()
  }

  private newClient(): OpenCodeClient {
    const password = process.env.OPENCODE_SERVER_PASSWORD
    const username = process.env.OPENCODE_SERVER_USERNAME || "opencode"
    const auth = password ? { username, password } : undefined
    return new OpenCodeClient(this.baseUrl, this.options.directory, auth)
  }

  private setState(state: ConnectionState, error = "") {
    this.state = state
    this.lastError = error
    this.emit("state", state, error)
  }

  async start(): Promise<void> {
    if (this.state === "connecting" || this.state === "connected") return
    this.setState("connecting")
    const client = this.newClient()
    this.client = client

    // 先尝试连接已有服务
    try {
      const health = await this.ping(client)
      if (health) {
        this.finishConnect()
        return
      }
    } catch {
      /* 未连接，继续尝试启动 */
    }

    if (this.options.connectMode === "manual") {
      this.setState("error", "未检测到运行中的 opencode 服务（连接模式：手动）。")
      return
    }

    // 启动 opencode serve
    try {
      await this.spawnServer()
    } catch (err) {
      this.setState("error", (err as Error).message)
      return
    }

    // 轮询等待健康
    const deadline = Date.now() + 30000
    while (Date.now() < deadline && !this.disposed) {
      await sleep(400)
      try {
        const health = await this.ping(client)
        if (health) {
          this.finishConnect()
          return
        }
      } catch {
        /* keep polling */
      }
    }
    this.setState("error", "启动 opencode 服务超时。")
  }

  private async ping(client: OpenCodeClient): Promise<boolean> {
    try {
      const health = await client.health()
      this.version = health?.version ?? this.version
      return health?.healthy === true
    } catch {
      return false
    }
  }

  private spawnServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      const cmd = this.options.commandPath
      const args = ["serve", "--hostname", this.options.hostname, "--port", String(this.options.port)]
      let settled = false
      let child: ChildProcess
      try {
        child = spawn(cmd, args, {
          shell: process.platform === "win32",
          stdio: ["ignore", "pipe", "pipe"],
        })
      } catch (err) {
        reject(err as Error)
        return
      }
      this.child = child

      child.stdout?.on("data", (d: Buffer) => this.emit("serverLog", d.toString()))
      child.stderr?.on("data", (d: Buffer) => this.emit("serverLog", d.toString()))

      const onExit = (code: number | null) => {
        this.child = null
        if (this.state === "connected" || this.state === "connecting") {
          this.setState("error", `opencode 服务进程退出（代码 ${code ?? "?"}）。`)
        }
        if (!settled) {
          settled = true
          reject(new Error(`opencode 服务进程启动后立即退出（代码 ${code ?? "?"}）。`))
        }
      }
      child.on("exit", onExit)
      child.on("error", (err) => {
        if (!settled) {
          settled = true
          reject(new Error(`无法启动 opencode（请检查配置 opencode.commandPath）：${err.message}`))
        }
      })

      // 若 5 秒内进程未退出，视为启动成功（后续由健康检查确认）
      setTimeout(() => {
        if (!settled) {
          settled = true
          resolve()
        }
      }, 5000)
    })
  }

  private finishConnect() {
    this.setState("connected")
    // 订阅事件流
    this.cancelEvent()
    this.cancelEvent = this.client?.subscribe(
      (ev: OpenCodeEvent) => this.emit("event", ev),
      (err) => this.emit("eventError", err),
    ) ?? (() => {})
  }

  stop() {
    this.cancelEvent()
    this.child?.kill()
    this.child = null
    this.setState("disconnected")
  }

  dispose() {
    this.disposed = true
    this.stop()
    this.removeAllListeners()
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
