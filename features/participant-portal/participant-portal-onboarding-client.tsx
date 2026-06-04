"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ParticipantPortalAccessStatus } from "@prisma/client";
import { toast } from "sonner";
import { WorkspaceGuidancePanel } from "@/components/shared/workspace-guidance-panel";
import { WorkspaceSurfacePreferences } from "@/components/shared/workspace-surface-preferences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { completeParticipantPortalOnboardingAction } from "@/features/participant-portal/actions";
import { formatParticipantPortalDateLabel } from "@/features/participant-portal/participant-portal-date-labels";
import type { ParticipantPortalInvitePreview } from "@/features/participant-portal/queries";
import { getParticipantPortalInviteStateCopy } from "@/lib/auth/participant-portal-invite-state";
import { formatDateLabel } from "@/lib/utils";

type UiLocale = "zh-CN" | "en-US";

const portalStatusLabels: Record<ParticipantPortalAccessStatus, { zh: string; en: string }> = {
  INVITED: { zh: "已邀请", en: "Invited" },
  ACTIVE: { zh: "已激活", en: "Active" },
  SUSPENDED: { zh: "已暂停", en: "Suspended" },
  ARCHIVED: { zh: "已归档", en: "Archived" },
};

type ParticipantPortalOnboardingClientProps = {
  locale: UiLocale;
  token: string;
  preview: ParticipantPortalInvitePreview;
};

export function ParticipantPortalOnboardingClient({
  locale,
  token,
  preview,
}: ParticipantPortalOnboardingClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const english = locale === "en-US";
  const initialUsablePreview = preview.state === "usable" ? preview : null;
  const [draft, setDraft] = useState({
    displayName:
      initialUsablePreview?.payoutProfile?.displayName ?? initialUsablePreview?.access.displayName ?? "",
    legalName: initialUsablePreview?.payoutProfile?.legalName ?? "",
    contact: initialUsablePreview?.payoutProfile?.contact ?? initialUsablePreview?.access.contact ?? "",
    payoutMethodLabel: initialUsablePreview?.payoutProfile?.payoutMethodLabel ?? "",
    payoutDetailsReference: initialUsablePreview?.payoutProfile?.payoutDetailsReference ?? "",
    invoiceRequired: initialUsablePreview?.payoutProfile?.invoiceRequired ?? false,
    notes: initialUsablePreview?.payoutProfile?.notes ?? initialUsablePreview?.access.notes ?? "",
    termsAccepted: Boolean(initialUsablePreview?.access.termsAcceptedAt),
  });

  if (preview.state !== "usable") {
    const inviteStateCopy = getParticipantPortalInviteStateCopy(preview.state, english);

    return (
      <main className="min-h-screen bg-[color:var(--dark-inset-bg)] px-6 py-12 text-[color:var(--dark-inset-foreground)]">
        <div className="mx-auto max-w-3xl">
          <Card className="border-[color:var(--dark-inset-border)] bg-[color:var(--dark-inset-surface)]/80 text-[color:var(--dark-inset-foreground)]">
            <CardHeader>
              <CardTitle>{inviteStateCopy.title}</CardTitle>
              <CardDescription className="text-[color:var(--muted-foreground)]">
                {inviteStateCopy.description}
              </CardDescription>
            </CardHeader>
            {preview.inviteExpiresAt ? (
              <CardContent>
                <p className="text-sm text-[color:var(--muted-foreground)]">
                  {english
                    ? `Invite expired on ${formatParticipantPortalDateLabel(preview.inviteExpiresAt, english, formatDateLabel)}.`
                    : `邀请已于 ${formatDateLabel(preview.inviteExpiresAt)} 失效。`}
                </p>
              </CardContent>
            ) : null}
          </Card>
        </div>
      </main>
    );
  }

  const access = preview.access;
  const blocked = access.status === "SUSPENDED" || access.status === "ARCHIVED";
  const onboardingRecommendations = [
    {
      title: english ? "Your scope only" : "只是你自己的范围",
      body: english
        ? "Activates your portal scope. No payout, no wider finance view."
        : "只激活你的门户范围。不打款，不开放财务视图。",
    },
    {
      title: english ? "Smallest profile to hand off" : "最小够用的资料",
      body: english
        ? "Display name, contact, payout method, invoice — enough for manual review."
        : "显示名称、联系方式、结算方式、发票——人工复核够了。",
    },
    {
      title: english ? "Terms = scope, not automation consent" : "勾选 = 确认范围，不是同意自动化",
      body: english
        ? "Confirms self-only scope and review posture. Not a green-light for marketplace, tax, or auto-payout."
        : "确认的是仅本人可见和复核状态。不是公开市场、税务或自动打款的开关。",
    },
  ];
  const onboardingReminders = [
    {
      title: english ? "Best next move" : "最合适下一步",
      body: english
        ? "Profile → enter the portal → check the lines → then settlement."
        : "补资料 → 进门户 → 核对条目 → 再进入结算。",
    },
  ];

  const completeOnboarding = () => {
    startTransition(async () => {
      const result = await completeParticipantPortalOnboardingAction({
        token,
        ...draft,
        termsAccepted: true,
        locale,
      });

      if (!result.ok) {
        toast.error(result.error ?? (english ? "Failed to continue into the portal" : "进入门户失败"));
        return;
      }

      toast.success(english ? "Portal access is ready" : "门户访问已就绪");
      router.push(result.redirectTo ?? "/portal");
      router.refresh();
    });
  };

  return (
    <main className="surface-grid min-h-screen">
      <div className="mx-auto w-full max-w-[1120px] px-6 py-12 lg:px-10">
        <div className="workspace-surface-stack">
          <WorkspaceGuidancePanel
            defaultExpanded
            eyebrow={english ? "Portal onboarding guidance" : "门户开通引导"}
            title={english ? "Complete the narrow profile path before entering the portal" : "进入门户前，先完成这条窄而清晰的资料路径"}
            summary={english ? "This onboarding stays intentionally narrow: verify participant identity basics, keep payout posture reviewable, and stop before payout rails or broader finance tooling." : "这条引导刻意保持收口：确认贡献方基础资料，让结算状态可复核，并明确停在打款通道和更宽的财务工具之前。"}
            recommendations={onboardingRecommendations}
            reminders={onboardingReminders}
            boundary={english ? "Onboarding opens the portal only — no payout, KYC, or marketplace." : "开通只是打开门户——不打款、不做 KYC、不上市场。"}
          />

          <div className="workspace-surface-stack">
            <WorkspaceSurfacePreferences />
            <Card className="workspace-form-assist workspace-panel-muted">
              <CardContent className="space-y-3 py-5">
                <p className="workspace-eyebrow">
                  {english ? "Onboarding assist" : "开通辅助"}
                </p>
                <p className="text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
                  {english ? "Finish the profile before you try to optimize the details." : "先完成资料，再去优化细节。"}
                </p>
                <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
                  {english ? "Display name + payout method + terms acknowledgement is enough." : "显示名称、结算方式、条款确认——够了。"}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
            {english ? "Contributor portal access" : "贡献方门户访问"}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {english ? "Complete your portal profile and payout basics" : "完成你的门户资料与结算基础信息"}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--muted)]">
            {english
              ? "This is a narrow, controlled onboarding path for your own participant scope. It confirms who you are, keeps payout-profile basics reviewable, and stops before any payout rail, marketplace, or external finance console."
              : "这是一条窄而受控的贡献方开通路径，只针对你自己的参与范围。它会确认你的基础资料、补齐可复核的结算信息，并明确停在打款通道、公开市场和外部财务控制台之前。"}
          </p>
        </div>

        <Card className="border-[color:var(--dark-inset-border)] bg-[color:var(--dark-inset-surface)]/80 text-[color:var(--dark-inset-foreground)]">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{access.displayName}</CardTitle>
              <Badge variant="approval">
                {preview.participantClassLabel[english ? "en" : "zh"]}
              </Badge>
              <Badge variant={access.status === "ACTIVE" ? "success" : access.status === "INVITED" ? "info" : "neutral"}>
                {portalStatusLabels[access.status][english ? "en" : "zh"]}
              </Badge>
            </div>
            <CardDescription className="text-[color:var(--muted-foreground)]">
              {english
                ? `${access.workspace.name} invited ${access.inviteEmail}. You'll only see your own earnings and payout.`
                : `${access.workspace.name} 邀请了 ${access.inviteEmail}。你只能看到自己的收益和结算。`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Info label={english ? "Invite email" : "邀请邮箱"} value={access.inviteEmail} />
            <Info label={english ? "Workspace" : "组织"} value={access.workspace.name} />
            <Info label={english ? "Last invite issued" : "最近发放时间"} value={formatParticipantPortalDateLabel(access.lastInviteIssuedAt, english, formatDateLabel)} />
            <Info label={english ? "Invite expires" : "邀请失效时间"} value={formatParticipantPortalDateLabel(preview.inviteExpiresAt, english, formatDateLabel)} />
            <Info label={english ? "Terms accepted" : "条款确认"} value={formatParticipantPortalDateLabel(access.termsAcceptedAt, english, formatDateLabel)} />
          </CardContent>
        </Card>

        <Card className="border-[color:var(--dark-inset-border)] bg-[color:var(--dark-inset-surface)]/80 text-[color:var(--dark-inset-foreground)]">
          <CardHeader>
            <CardTitle>{english ? "Profile and payout basics" : "资料与结算基础信息"}</CardTitle>
            <CardDescription className="text-[color:var(--muted-foreground)]">
              {english
                ? "Used for attribution review and settlement prep. Not a payout system."
                : "用于归因复核和结算准备。不是直接打款系统。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={draft.displayName}
              onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
              placeholder={english ? "Display name" : "显示名称"}
              disabled={blocked}
            />
            <Input
              value={draft.legalName}
              onChange={(event) => setDraft((current) => ({ ...current, legalName: event.target.value }))}
              placeholder={english ? "Legal name" : "法定主体名称"}
              disabled={blocked}
            />
            <Input
              value={draft.contact}
              onChange={(event) => setDraft((current) => ({ ...current, contact: event.target.value }))}
              placeholder={english ? "Contact" : "联系方式"}
              disabled={blocked}
            />
            <Input
              value={draft.payoutMethodLabel}
              onChange={(event) => setDraft((current) => ({ ...current, payoutMethodLabel: event.target.value }))}
              placeholder={english ? "Payout method label" : "结算方式说明"}
              disabled={blocked}
            />
            <Input
              value={draft.payoutDetailsReference}
              onChange={(event) => setDraft((current) => ({ ...current, payoutDetailsReference: event.target.value }))}
              placeholder={english ? "Payout notes / reference" : "结算备注 / 引用"}
              disabled={blocked}
            />
            <label className="flex items-center justify-between rounded-2xl border border-[color:var(--dark-inset-border)] px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
              <span>{english ? "Invoice required" : "是否需要发票"}</span>
              <input
                type="checkbox"
                checked={draft.invoiceRequired}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, invoiceRequired: event.target.checked }))
                }
                disabled={blocked}
              />
            </label>
            <Input
              value={draft.notes}
              onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
              placeholder={english ? "Notes" : "备注"}
              disabled={blocked}
            />
            <label className="flex items-start gap-3 rounded-2xl border border-[color:var(--dark-inset-border)] px-4 py-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
              <input
                type="checkbox"
                className="mt-1"
                checked={draft.termsAccepted}
                onChange={(event) => setDraft((current) => ({ ...current, termsAccepted: event.target.checked }))}
                disabled={blocked}
              />
              <span>
                {english
                  ? "I understand this portal is self-only, payout remains off-platform/manual, and Helm does not expose payout rails, marketplace discovery, or workflow control here."
                  : "我理解这个门户只开放给我自己的范围，结算仍保持线下人工处理，Helm 不会在这里暴露打款通道、公开市场发现或流程控制。"}
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={completeOnboarding}
                disabled={
                  pending ||
                  blocked ||
                  draft.displayName.trim().length < 2 ||
                  draft.payoutMethodLabel.trim().length < 2 ||
                  !draft.termsAccepted
                }
              >
                {access.status === "ACTIVE"
                  ? english
                    ? "Continue to portal"
                    : "继续进入门户"
                  : english
                    ? "Complete onboarding"
                    : "完成开通"}
              </Button>
              {blocked ? (
                <Badge variant="danger">
                  {english
                    ? "This portal access is not currently available"
                    : "当前这个门户访问暂不可用"}
                </Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--dark-inset-border)] px-4 py-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
