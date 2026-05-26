"use client";

import { cn } from "@/lib/utils";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";

type WorkspaceSurfacePreferencesProps = {
  idBase?: string;
  className?: string;
  showFormAssist?: boolean;
};

function PreferenceOption({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="workspace-preference-option"
      data-active={active ? "true" : "false"}
      aria-label={`${label}: ${description}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="workspace-preference-option-label">{label}</span>
      <span className="workspace-preference-option-description">
        {description}
      </span>
    </button>
  );
}

export function WorkspaceSurfacePreferences({
  idBase = "workspace-surface-preferences",
  className,
  showFormAssist = true,
}: WorkspaceSurfacePreferencesProps) {
  const {
    locale,
    layoutDensity,
    guidanceMode,
    formAssistEnabled,
    reducedMotion,
    setLayoutDensity,
    setGuidanceMode,
    setFormAssistEnabled,
  } = useWorkspaceUi();
  const english = locale === "en-US";
  const headingId = `${idBase}-heading`;
  const summaryId = `${idBase}-summary`;
  const densityId = `${idBase}-density`;
  const guidanceId = `${idBase}-guidance`;
  const assistId = `${idBase}-assist`;
  const motionId = `${idBase}-motion`;

  return (
    <section
      className={cn("workspace-preference-card", className)}
      aria-labelledby={headingId}
      aria-describedby={summaryId}
    >
      <details className="workspace-preference-disclosure">
        <summary
          id={headingId}
          className="workspace-preference-summary workspace-preference-summary-icon"
          aria-label={english ? "Display preferences" : "显示偏好"}
        >
          <span aria-hidden="true">{`""`}</span>
        </summary>

        <div className="workspace-preference-body">
          <p id={summaryId} className="sr-only">
            {english
              ? "These preferences adjust readability without changing governance truth."
              : "这些偏好只调整阅读方式，不改变判断依据。"}
          </p>

          <fieldset
            className="workspace-preference-group"
            aria-labelledby={densityId}
          >
            <legend id={densityId} className="workspace-preference-group-title">
              {english ? "Layout density" : "布局密度"}
            </legend>
            <div className="workspace-preference-option-row">
              <PreferenceOption
                active={layoutDensity === "comfortable"}
                label={english ? "Comfortable" : "舒展"}
                description={english ? "More breathing room for review." : "为判断和阅读保留更多留白。"}
                onClick={() => setLayoutDensity("comfortable")}
              />
              <PreferenceOption
                active={layoutDensity === "compact"}
                label={english ? "Compact" : "紧凑"}
                description={english ? "Higher density for operating review." : "提高单位屏幕的信息密度。"}
                onClick={() => setLayoutDensity("compact")}
              />
            </div>
          </fieldset>

          <fieldset
            className="workspace-preference-group"
            aria-labelledby={guidanceId}
          >
            <legend id={guidanceId} className="workspace-preference-group-title">
              {english ? "Guidance mode" : "引导模式"}
            </legend>
            <div className="workspace-preference-option-row">
              <PreferenceOption
                active={guidanceMode === "guided"}
                label={english ? "Guided" : "引导型"}
                description={english ? "Keep explanations, reminders and context visible." : "保持解释、提醒和上下文可见。"}
                onClick={() => setGuidanceMode("guided")}
              />
              <PreferenceOption
                active={guidanceMode === "focused"}
                label={english ? "Focused" : "聚焦型"}
                description={english ? "Hide secondary guidance and emphasize decisions." : "压缩次级说明，突出判断与动作。"}
                onClick={() => setGuidanceMode("focused")}
              />
            </div>
          </fieldset>

          {showFormAssist ? (
            <fieldset
              className="workspace-preference-group"
              aria-labelledby={assistId}
            >
              <legend id={assistId} className="workspace-preference-group-title">
                {english ? "Form assist" : "表单辅助"}
              </legend>
              <div className="workspace-preference-option-row">
                <PreferenceOption
                  active={formAssistEnabled}
                  label={english ? "Enabled" : "开启"}
                  description={english ? "Show preset suggestions and autofill helpers." : "显示预设建议和自动填充辅助。"}
                  onClick={() => setFormAssistEnabled(true)}
                />
                <PreferenceOption
                  active={!formAssistEnabled}
                  label={english ? "Minimal" : "最简"}
                  description={english ? "Hide helper prompts and keep only the form." : "隐藏辅助提示，只保留表单本体。"}
                  onClick={() => setFormAssistEnabled(false)}
                />
              </div>
            </fieldset>
          ) : null}

          <div
            className="workspace-preference-note"
            role="status"
            aria-labelledby={motionId}
          >
            <p id={motionId} className="workspace-preference-group-title">
              {english ? "Accessibility posture" : "无障碍姿态"}
            </p>
            <p className="workspace-preference-note-copy">
              {reducedMotion
                ? english
                  ? "Reduced motion is active from the current device preference."
                  : "当前设备已开启减少动效。"
                : english
                  ? "Standard motion is active; reduced-motion fallback remains available."
                  : "当前使用标准动效；减少动效回退仍可用。"}
            </p>
          </div>
        </div>
      </details>
    </section>
  );
}
