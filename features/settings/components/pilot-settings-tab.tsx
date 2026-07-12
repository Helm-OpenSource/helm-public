"use client";

import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import type { UiLocale } from "@/lib/i18n/config";
import type { UiMessages } from "@/lib/i18n/messages";
import type { WorkspaceFeatureFlags } from "@/lib/workspace-ops";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TabsContent } from "@/components/ui/tabs";
import { StatusHint } from "./settings-display";

const workspaceFeatureFlagLabels = {
  multilingualUi: { en: "Multilingual shell", zh: "多语言界面" },
  diagnosticsCenter: { en: "Diagnostics center", zh: "诊断中心" },
  crmFirstImports: { en: "CRM-first imports", zh: "客户关系系统优先导入" },
  captureAudio: { en: "Capture audio", zh: "现场采集音频" },
  llmEnhancement: { en: "LLM enhancement", zh: "模型增强" },
  evolutionSignals: { en: "Evolution signals", zh: "演进信号" },
  swarmReadOnlyWorkers: { en: "Swarm read-only workers", zh: "只读协作者" },
  controlTowerHome: { en: "Control tower home", zh: "控制塔首页" },
} as const;

type PilotDraft = {
  defaultLocale: UiLocale;
  pilotMode: boolean;
  captureConsentRequired: boolean;
  dataRetentionDays: number;
  featureFlags: WorkspaceFeatureFlags;
};

type PilotSettingsTabProps = {
  canManageOperationalControls: boolean;
  english: boolean;
  pending: boolean;
  pilotDraft: PilotDraft;
  pilotMessages: UiMessages["settings"]["pilot"];
  saveOperationalControls: () => void;
  setPilotDraft: Dispatch<SetStateAction<PilotDraft>>;
};

function formatWorkspaceFeatureFlagLabel(key: keyof typeof workspaceFeatureFlagLabels, english: boolean) {
  const label = workspaceFeatureFlagLabels[key];
  return english ? label.en : label.zh;
}

export function PilotSettingsTab({
  canManageOperationalControls,
  english,
  pending,
  pilotDraft,
  pilotMessages,
  saveOperationalControls,
  setPilotDraft,
}: PilotSettingsTabProps) {
  return (
    <TabsContent value="pilot">
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>{pilotMessages.title}</CardTitle>
            <CardDescription>{pilotMessages.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!canManageOperationalControls ? (
              <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
                {english
                  ? "Operational controls stay limited to owner or admin. This tab remains readable, but changing locale, retention, pilot flags or capture controls requires governance capability."
                  : "运营控制仅开放给负责人或管理员。这个标签页仍可读，但修改语言、保留期、试点开关或现场采集控制需要治理能力。"}
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[color:var(--foreground)]">{pilotMessages.locale}</label>
                <Select
                  disabled={!canManageOperationalControls || pending}
                  value={pilotDraft.defaultLocale}
                  onValueChange={(value) =>
                    setPilotDraft((current) => ({
                      ...current,
                      defaultLocale: value === "en-US" ? "en-US" : "zh-CN",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh-CN">{english ? "Chinese" : "中文"}</SelectItem>
                    <SelectItem value="en-US">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[color:var(--foreground)]">{pilotMessages.retention}</label>
                <Select
                  disabled={!canManageOperationalControls || pending}
                  value={String(pilotDraft.dataRetentionDays)}
                  onValueChange={(value) =>
                    setPilotDraft((current) => ({
                      ...current,
                      dataRetentionDays: Number(value),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">{english ? "30 days" : "30 天"}</SelectItem>
                    <SelectItem value="60">{english ? "60 days" : "60 天"}</SelectItem>
                    <SelectItem value="90">{english ? "90 days" : "90 天"}</SelectItem>
                    <SelectItem value="180">{english ? "180 days" : "180 天"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{pilotMessages.pilotMode}</p>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
                      {english
                        ? "Keep the workspace in a guarded pilot state with diagnostics, explicit boundaries and operational prompts."
                        : "保持试点模式，持续展示诊断、运营边界和试跑提示。"}
                    </p>
                  </div>
                  <Switch
                    disabled={!canManageOperationalControls || pending}
                    checked={pilotDraft.pilotMode}
                    onCheckedChange={(checked) =>
                      setPilotDraft((current) => ({
                        ...current,
                        pilotMode: checked,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{pilotMessages.consent}</p>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--muted-foreground)]">
                      {english
                        ? "Require an explicit consent confirmation before live capture starts."
                        : "在开始现场采集前要求明确确认录音 / 转写授权。"}
                    </p>
                  </div>
                  <Switch
                    disabled={!canManageOperationalControls || pending}
                    checked={pilotDraft.captureConsentRequired}
                    onCheckedChange={(checked) =>
                      setPilotDraft((current) => ({
                        ...current,
                        captureConsentRequired: checked,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="theme-surface-panel space-y-3 rounded-2xl px-4 py-4">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">{pilotMessages.flags}</p>
              <div className="grid gap-3 md:grid-cols-2">
                {(Object.entries(pilotDraft.featureFlags) as Array<[keyof WorkspaceFeatureFlags, boolean]>).map(([key, value]) => (
                  <div key={key} className="theme-surface-panel-soft flex items-center justify-between rounded-2xl px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-[color:var(--foreground)]">
                        {formatWorkspaceFeatureFlagLabel(key, english)}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                        {english
                          ? "Control whether this trial-facing surface is visible."
                          : "控制该试点能力是否对当前工作区可见。"}
                      </p>
                    </div>
                    <Switch
                      disabled={!canManageOperationalControls || pending}
                      checked={value}
                      onCheckedChange={(checked) =>
                        setPilotDraft((current) => ({
                          ...current,
                          featureFlags: {
                            ...current.featureFlags,
                            [key]: checked,
                          },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="workspace-panel-muted rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
              {pilotMessages.hint}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={saveOperationalControls} disabled={pending || !canManageOperationalControls}>
                {pilotMessages.save}
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/diagnostics">{pilotMessages.diagnostics}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{english ? "Current trial boundary" : "当前试点边界"}</CardTitle>
            <CardDescription>
              {english
                ? "Check language, diagnostics and capture consent before a customer demo."
                : "演示前先确认语言、诊断和现场采集授权。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusHint
              tone={pilotDraft.featureFlags.multilingualUi ? "success" : "warning"}
              title={pilotDraft.featureFlags.multilingualUi ? (english ? "Multilingual shell is enabled" : "多语言界面已开启") : (english ? "Multilingual shell is disabled" : "多语言界面当前关闭")}
              body={pilotDraft.featureFlags.multilingualUi
                ? (english ? "CRM onboarding, diagnostics and capture controls can now be shown in English." : "客户关系系统导入、诊断页和现场采集控制现在可以切到英文。")
                : (english ? "HubSpot / Salesforce-facing pages will stay in Chinese until you enable the multilingual flag." : "如果不开启多语言开关，HubSpot / Salesforce 客户仍会看到中文页面。")}
            />
            <StatusHint
              tone={pilotDraft.featureFlags.diagnosticsCenter ? "success" : "warning"}
              title={pilotDraft.featureFlags.diagnosticsCenter ? (english ? "Diagnostics center is visible" : "试点诊断页已开启") : (english ? "Diagnostics center is hidden" : "试点诊断页当前关闭")}
              body={pilotDraft.featureFlags.diagnosticsCenter
                ? (english ? "The workspace can expose quality, import and capture health to the trial team." : "工作区可以直接展示建议质量、导入健康度和现场采集健康度。")
                : (english ? "Turn this on before a design partner pilot so the team can inspect quality regressions." : "设计合作伙伴试点前建议打开，便于团队及时发现质量回归。")}
            />
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  );
}
