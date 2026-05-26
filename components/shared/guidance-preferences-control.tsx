"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Bell, CheckCircle2 } from "lucide-react";

/**
 * 系统说明偏好设置
 *
 * 让用户可以控制各种系统说明和引导的显示
 */
export function GuidancePreferencesControl() {
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

    // 立即应用更改
    applyPreferences(newPrefs);
  };

  const applyPreferences = (prefs: typeof preferences) => {
    // 应用各种偏好设置
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          系统说明偏好设置
        </CardTitle>
        <CardDescription>
          控制系统引导、说明和提示的显示，减少界面烦扰
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 当前状态 */}
        {allDisabled && (
          <div className="flex items-center gap-2 rounded-lg bg-[color:var(--status-success-bg)] dark:bg-[color:var(--accent-success)]/20 p-3">
            <CheckCircle2 className="h-5 w-5 text-[color:var(--status-success-text)] dark:text-[color:var(--status-success-text)]" />
            <span className="text-sm font-medium text-[color:var(--status-success-text)] dark:text-[color:var(--status-success-text)]">
              已简化：所有系统说明都已关闭
            </span>
          </div>
        )}

        {/* 偏好选项 */}
        <div className="space-y-4">
          <PreferenceItem
            id="demo-guide"
            label="演示引导"
            description="演示模式的引导和说明"
            checked={preferences.demoGuide}
            onChange={() => handleToggle("demoGuide")}
          />
          <PreferenceItem
            id="workspace-guidance"
            label="工作区引导"
            description="工作区内的操作建议和提示"
            checked={preferences.workspaceGuidance}
            onChange={() => handleToggle("workspaceGuidance")}
          />
          <PreferenceItem
            id="form-assist"
            label="表单辅助"
            description="表单填写时的帮助和提示"
            checked={preferences.formAssist}
            onChange={() => handleToggle("formAssist")}
          />
          <PreferenceItem
            id="proactive-tips"
            label="主动提示"
            description="系统主动提供的建议和提醒"
            checked={preferences.proactiveTips}
            onChange={() => handleToggle("proactiveTips")}
          />
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3 pt-4 border-t">
          <Button onClick={handleSave} className="flex-1">
            {saved ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                已保存
              </>
            ) : (
              "保存设置"
            )}
          </Button>
          <Button variant="outline" onClick={resetToDefault}>
            全部关闭
          </Button>
        </div>

        {/* 说明文字 */}
        <div className="text-xs text-[color:var(--muted-foreground)] dark:text-[color:var(--muted-foreground)] space-y-1 pt-4 border-t">
          <p>💡 <strong>建议</strong>：关闭不必要的系统说明可以让界面更清爽，操作更专注。</p>
          <p>⚠️ <strong>注意</strong>：如果需要帮助，可以随时重新开启这些说明。</p>
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
