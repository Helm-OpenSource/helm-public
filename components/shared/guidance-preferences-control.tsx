"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell, CheckCircle2 } from "lucide-react";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";

export function GuidancePreferencesControl() {
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const [preferences, setPreferences] = useState(() => {
    const defaultPreferences = {
      demoGuide: false,
      workspaceGuidance: false,
      formAssist: false,
      proactiveTips: false,
    };

    if (typeof window === "undefined") {
      return defaultPreferences;
    }

    const savedPrefs = window.localStorage.getItem("helm-guidance-preferences");
    if (!savedPrefs) {
      return defaultPreferences;
    }

    try {
      return {
        ...defaultPreferences,
        ...JSON.parse(savedPrefs),
      };
    } catch {
      return defaultPreferences;
    }
  });

  const [saved, setSaved] = useState(false);

  const handleToggle = (key: keyof typeof preferences) => {
    const newPrefs = {
      ...preferences,
      [key]: !preferences[key],
    };
    setPreferences(newPrefs);
    localStorage.setItem("helm-guidance-preferences", JSON.stringify(newPrefs));

    applyPreferences(newPrefs);
  };

  const applyPreferences = (prefs: typeof preferences) => {
    if (!prefs.demoGuide) {
      localStorage.setItem("helm-demo-guide-dismissed", "true");
    }
    if (!prefs.workspaceGuidance) {
      localStorage.setItem("helm-guidance-dismissed", "true");
    }
    if (!prefs.formAssist) {
      localStorage.setItem("helm-form-assist-dismissed", "true");
    }
  };

  const resetToDefault = () => {
    const defaultPrefs = {
      demoGuide: false,
      workspaceGuidance: false,
      formAssist: false,
      proactiveTips: false,
    };
    setPreferences(defaultPrefs);
    localStorage.setItem("helm-guidance-preferences", JSON.stringify(defaultPrefs));
    applyPreferences(defaultPrefs);
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem("helm-guidance-preferences", JSON.stringify(preferences));
    applyPreferences(preferences);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const allDisabled = Object.values(preferences).every(v => v === false);
  const preferenceItems = [
    {
      id: "demo-guide",
      key: "demoGuide" as const,
      label: english ? "Demo guidance" : "演示引导",
      description: english
        ? "Guidance and notes shown in demo mode"
        : "演示模式的引导和说明",
    },
    {
      id: "workspace-guidance",
      key: "workspaceGuidance" as const,
      label: english ? "Workspace guidance" : "工作区引导",
      description: english
        ? "In-workspace operating suggestions and prompts"
        : "工作区内的操作建议和提示",
    },
    {
      id: "form-assist",
      key: "formAssist" as const,
      label: english ? "Form assist" : "表单辅助",
      description: english
        ? "Help text and hints while filling forms"
        : "表单填写时的帮助和提示",
    },
    {
      id: "proactive-tips",
      key: "proactiveTips" as const,
      label: english ? "Proactive tips" : "主动提示",
      description: english
        ? "Suggestions and reminders proactively shown by Helm"
        : "系统主动提供的建议和提醒",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          {english ? "System guidance preferences" : "系统说明偏好设置"}
        </CardTitle>
        <CardDescription>
          {english
            ? "Control system guidance, explanatory notes, and tips so the workspace stays focused."
            : "控制系统引导、说明和提示的显示，减少界面烦扰。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {allDisabled && (
          <div className="flex items-center gap-2 rounded-lg bg-[color:var(--status-success-bg)] dark:bg-[color:var(--accent-success)]/20 p-3">
            <CheckCircle2 className="h-5 w-5 text-[color:var(--status-success-text)] dark:text-[color:var(--status-success-text)]" />
            <span className="text-sm font-medium text-[color:var(--status-success-text)] dark:text-[color:var(--status-success-text)]">
              {english
                ? "Simplified: all system guidance is turned off"
                : "已简化：所有系统说明都已关闭"}
            </span>
          </div>
        )}

        <div className="space-y-4">
          {preferenceItems.map((item) => (
            <PreferenceItem
              key={item.id}
              id={item.id}
              label={item.label}
              description={item.description}
              checked={preferences[item.key]}
              onChange={() => handleToggle(item.key)}
            />
          ))}
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button onClick={handleSave} className="flex-1">
            {saved ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {english ? "Saved" : "已保存"}
              </>
            ) : (
              english ? "Save settings" : "保存设置"
            )}
          </Button>
          <Button variant="outline" onClick={resetToDefault}>
            {english ? "Turn all off" : "全部关闭"}
          </Button>
        </div>

        <div className="text-xs text-[color:var(--muted-foreground)] dark:text-[color:var(--muted-foreground)] space-y-1 pt-4 border-t">
          <p>
            <strong>{english ? "Suggestion" : "建议"}</strong>
            {english
              ? ": Turn off unnecessary system guidance to keep the interface cleaner and the work more focused."
              : "：关闭不必要的系统说明可以让界面更清爽，操作更专注。"}
          </p>
          <p>
            <strong>{english ? "Note" : "注意"}</strong>
            {english
              ? ": You can turn these guidance notes back on whenever help is needed."
              : "：如果需要帮助，可以随时重新开启这些说明。"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function PreferenceItem({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <label htmlFor={id} className="font-medium text-[color:var(--foreground)] dark:text-[color:var(--dark-inset-foreground)]">
          {label}
        </label>
        <p className="text-sm text-[color:var(--muted-foreground)] dark:text-[color:var(--muted-foreground)]">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
