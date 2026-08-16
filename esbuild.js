const esbuild = require("esbuild")
const fs = require("fs")
const path = require("path")

const production = process.argv.includes("--production")
const watch = process.argv.includes("--watch")

const outdir = path.join(__dirname, "dist")

/** @type {import('esbuild').BuildOptions} */
const extensionOptions = {
  entryPoints: [path.join(__dirname, "src", "extension.ts")],
  outfile: path.join(outdir, "extension.js"),
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  external: ["vscode"],
  sourcemap: !production,
  minify: production,
  logLevel: "info",
}

/** @type {import('esbuild').BuildOptions} */
const webviewOptions = {
  entryPoints: [path.join(__dirname, "webview", "main.tsx")],
  outfile: path.join(outdir, "webview.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome110",
  sourcemap: !production,
  minify: production,
  jsx: "automatic",
  jsxImportSource: "preact",
  define: { "process.env.NODE_ENV": production ? '"production"' : '"development"' },
  logLevel: "info",
}

function copyAssets() {
  fs.mkdirSync(outdir, { recursive: true })
  fs.copyFileSync(path.join(__dirname, "webview", "index.html"), path.join(outdir, "webview.html"))
  fs.copyFileSync(path.join(__dirname, "webview", "styles.css"), path.join(outdir, "webview.css"))
  fs.copyFileSync(path.join(__dirname, "media", "icon.svg"), path.join(outdir, "icon.svg"))
}

async function main() {
  copyAssets()
  if (watch) {
    const ctx = await Promise.all([
      esbuild.context(extensionOptions),
      esbuild.context(webviewOptions),
    ])
    await Promise.all(ctx.map((c) => c.watch()))
    console.log("watching...")
  } else {
    await Promise.all([esbuild.build(extensionOptions), esbuild.build(webviewOptions)])
    console.log("build complete")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
