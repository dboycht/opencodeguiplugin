/// <reference lib="dom" />
import type { WebviewMessage, WebviewCall } from "../src/protocol"
import type { OpenCodeEvent } from "../src/types"

declare global {
  interface Window {
    acquireVsCodeApi: () => VSCodeApi
  }
}

interface VSCodeApi {
  postMessage(msg: unknown): void
  getState(): unknown
  setState(state: unknown): void
}

const vscode = window.acquireVsCodeApi()

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void }
const pending = new Map<string, Pending>()
let seq = 0

type Listener = (msg: WebviewMessage) => void
const listeners = new Set<Listener>()

export function onMessage(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

window.addEventListener("message", (e) => {
  const msg = e.data as WebviewMessage
  if (!msg || typeof msg !== "object") return
  if (msg.type === "result") {
    const p = pending.get(msg.id)
    if (p) {
      pending.delete(msg.id)
      if (msg.ok) p.resolve(msg.data)
      else p.reject(new Error(msg.error || "请求失败"))
    }
    return
  }
  for (const l of listeners) l(msg)
})

export function post(msg: WebviewCall): void {
  vscode.postMessage(msg)
}

export function call<T = unknown>(method: WebviewCall["method"], params?: unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = `wv:${++seq}`
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
    post({ id, method, params } as WebviewCall)
  })
}

export function sendReady(): void {
  post({ id: "ready", method: "ready" })
}

export type { WebviewMessage, OpenCodeEvent }
