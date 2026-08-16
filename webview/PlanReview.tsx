import { planDiffs, applyPlanFile, rejectPlanFile, closePlanPreview } from "./store"
import { call } from "./api"
import { t } from "./i18n"
import { IconFile, IconClose, IconCheck, IconWarn } from "./icons"

export function PlanReview() {
  const diffs = planDiffs.value
  if (diffs.length === 0) return null

  return (
    <div class="plan-review">
      <div class="plan-review-head">
        <span class="plan-review-title">📋 {t("plan.title")}</span>
        <span class="plan-review-count">
          {diffs.length} {t("plan.files")}
        </span>
        <span class="plan-review-spacer" />
        <button class="icon-btn" onClick={closePlanPreview} title={t("plan.close")}>
          <IconClose size={14} />
        </button>
      </div>
      <div class="plan-review-list">
        {diffs.map((d) => (
          <div key={d.file} class="plan-file">
            <IconFile size={14} />
            <span class="plan-file-name" title={d.file}>
              {d.file}
            </span>
            <span class="plan-file-stats">
              <span class="add">+{d.additions}</span>
              <span class="del">-{d.deletions}</span>
            </span>
            <div class="plan-file-actions">
              <button
                class="btn btn-ghost btn-sm"
                onClick={() => void call("showDiff", { path: d.file, before: d.before, after: d.after })}
                title={t("plan.viewDiff")}
              >
                <IconWarn size={12} />
                {t("plan.viewDiff")}
              </button>
              <button class="btn btn-allow btn-sm" onClick={() => void applyPlanFile(d.file, d.after)} title={t("plan.apply")}>
                <IconCheck size={12} />
                {t("plan.apply")}
              </button>
              <button class="btn btn-deny btn-sm" onClick={() => void rejectPlanFile(d.file)} title={t("plan.reject")}>
                {t("plan.reject")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
