import MarkdownIt from "markdown-it"
import hljs from "highlight.js"

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(code: string, lang: string): string {
    const safe = hljs.getLanguage(lang) ? lang : "plaintext"
    try {
      const out = hljs.highlight(code, { language: safe }).value
      return `<div class="code-block"><div class="code-head"><span class="code-lang">${escapeHtml(safe)}</span><button class="copy-btn" data-code="${encodeURIComponent(code)}" title="复制代码">复制</button></div><pre><code class="hljs">${out}</code></pre></div>`
    } catch {
      return `<div class="code-block"><div class="code-head"><span class="code-lang">${escapeHtml(safe)}</span><button class="copy-btn" data-code="${encodeURIComponent(code)}" title="复制代码">复制</button></div><pre><code class="hljs">${escapeHtml(code)}</code></pre></div>`
    }
  },
})

md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  tokens[idx].attrSet("target", "_blank")
  tokens[idx].attrSet("rel", "noreferrer noopener")
  return self.renderToken(tokens, idx, options)
}

export function renderMarkdown(src: string): string {
  if (!src) return ""
  return md.render(src)
}

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}
