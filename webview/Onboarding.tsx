import { useEffect, useState } from "preact/hooks"
import { setOnboarded, checkOpencode, installOpencode, toast } from "./store"
import { t, lang, setLang } from "./i18n"
import { IconCheck, IconWarn, IconSpinner, IconCopy } from "./icons"
import { call } from "./api"

export function Onboarding() {
  const [checking, setChecking] = useState(true)
  const [installed, setInstalled] = useState<boolean | null>(null)
  const [hasNpm, setHasNpm] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installOut, setInstallOut] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    void (async () => {
      const r = await checkOpencode()
      setInstalled(r.installed)
      setHasNpm(r.npm)
      setChecking(false)
    })()
  }, [])

  const doInstall = async () => {
    setInstalling(true)
    setInstallOut("")
    const r = await installOpencode()
    setInstallOut(r.output)
    setInstalling(false)
    const c = await checkOpencode()
    setInstalled(c.installed)
    if (c.installed) toast(t("ob.installDone"), "success")
  }

  const copyCmd = async () => {
    await call("copyToClipboard", { text: "npm install -g opencode-ai" })
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div class="onboarding">
      <div class="ob-card">
        <div class="ob-mark">OC</div>
        <h1 class="ob-title">{t("ob.title")}</h1>
        <p class="ob-sub">{t("ob.sub")}</p>

        <div class="ob-lang">
          <span class="ob-label">{t("ob.chooseLang")}</span>
          <div class="ob-lang-options">
            <button
              class={`ob-lang-btn${lang.value === "en" ? " selected" : ""}`}
              onClick={() => setLang("en")}
            >
              English
            </button>
            <button
              class={`ob-lang-btn${lang.value === "zh" ? " selected" : ""}`}
              onClick={() => setLang("zh")}
            >
              中文
            </button>
          </div>
        </div>

        <div class="ob-status">
          {checking ? (
            <span class="ob-checking">
              <IconSpinner size={14} class="spin" /> {t("ob.checking")}
            </span>
          ) : installed ? (
            <span class="ob-ok">
              <IconCheck size={14} /> {t("ob.installed")}
            </span>
          ) : (
            <span class="ob-bad">
              <IconWarn size={14} /> {t("ob.notInstalled")}
            </span>
          )}
        </div>

        {!checking && !installed && (
          <div class="ob-install">
            <button class="btn btn-primary" onClick={doInstall} disabled={installing}>
              {installing ? (
                <>
                  <IconSpinner size={14} class="spin" /> {t("ob.installing")}
                </>
              ) : (
                t("ob.installNow")
              )}
            </button>
            <button class="btn btn-ghost" onClick={copyCmd} title={t("ob.copyCmd")}>
              {copied ? <IconCheck size={13} /> : <IconCopy size={13} />} {t("ob.copyCmd")}
            </button>
            <p class="ob-note">{hasNpm ? t("ob.npmNote") : t("ob.manualNote")}</p>
            {installOut && <pre class="ob-output">{installOut}</pre>}
          </div>
        )}

        <div class="ob-actions">
          <button class="btn btn-primary" onClick={() => setOnboarded(true)} disabled={checking}>
            {installed ? t("ob.enter") : t("ob.enterAnyway")}
          </button>
        </div>
      </div>
    </div>
  )
}
