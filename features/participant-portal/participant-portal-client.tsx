"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type {
  ParticipantPortalAccessStatus,
  PayoutProfileStatus,
  RevenueBeneficiaryType,
  RevenueLedgerStatus,
  RevenueSourceType,
} from "@prisma/client";
import { toast } from "sonner";
import { WorkspaceGuidancePanel } from "@/components/shared/workspace-guidance-panel";
import { WorkspaceSurfacePreferences } from "@/components/shared/workspace-surface-preferences";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { logoutAction } from "@/features/auth/actions";
import { updateParticipantPortalProfileAction } from "@/features/participant-portal/actions";
import type { ParticipantPortalData } from "@/features/participant-portal/queries";
import { formatDateLabel } from "@/lib/utils";

type UiLocale = "zh-CN" | "en-US";

const portalStatusLabels: Record<ParticipantPortalAccessStatus, { zh: string; en: string }> = {
  INVITED: { zh: "已邀请", en: "Invited" },
  ACTIVE: { zh: "已激活", en: "Active" },
  SUSPENDED: { zh: "已暂停", en: "Suspended" },
  ARCHIVED: { zh: "已归档", en: "Archived" },
};

const payoutProfileStatusLabels: Record<PayoutProfileStatus, { zh: string; en: string }> = {
  ACTIVE: { zh: "资料可用", en: "Profile ready" },
  INACTIVE: { zh: "暂不使用", en: "Inactive" },
};

const sourceLabels: Record<RevenueSourceType, { zh: string; en: string }> = {
  ORGANIZATION_BASE_FEE: { zh: "组织基础费", en: "Organization base fee" },
  ACTIVE_SEAT: { zh: "额外活跃席位", en: "Additional active seat" },
  ADD_ON_WORKER: { zh: "能力贡献收入", en: "Worker revenue" },
  CUSTOM_IMPLEMENTATION: { zh: "定制实施", en: "Custom implementation" },
  CUSTOM_MAINTENANCE: { zh: "定制维护", en: "Custom maintenance" },
  SALES_REFERRAL: { zh: "销售转介绍", en: "Sales referral" },
};

const payoutStatusLabels: Record<"PENDING" | "APPROVED" | "EXPORTED" | "PAID" | "REVERSED", { zh: string; en: string }> = {
  PENDING: { zh: "待结算", en: "Pending" },
  APPROVED: { zh: "已批准", en: "Approved" },
  EXPORTED: { zh: "已导出", en: "Exported" },
  PAID: { zh: "已支付", en: "Paid" },
  REVERSED: { zh: "已冲回", en: "Reversed" },
};

const beneficiaryLabels: Record<RevenueBeneficiaryType, { zh: string; en: string }> = {
  PLATFORM: { zh: "平台", en: "Platform" },
  WORKER_PUBLISHER: { zh: "能力贡献方", en: "Worker contributor" },
  SALES_REFERRAL: { zh: "销售转介绍方", en: "Sales referrer" },
  CUSTOM_SERVICES: { zh: "定制交付伙伴", en: "Custom partner" },
};

const revenueLedgerStatusLabels: Record<RevenueLedgerStatus, { zh: string; en: string }> = {
  PENDING: { zh: "待结算", en: "Pending" },
  APPROVED: { zh: "已批准", en: "Approved" },
  PAID: { zh: "已支付", en: "Paid" },
  REVERSED: { zh: "已冲回", en: "Reversed" },
};

function formatMoneyAmount(amountCents: number, currency = "CNY") {
  const amount = amountCents / 100;
  return new Intl.NumberFormat(currency === "CNY" ? "zh-CN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="theme-surface-panel-soft rounded-2xl px-4 py-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

type ParticipantPortalClientProps = {
  locale: UiLocale;
  data: ParticipantPortalData;
};

export function ParticipantPortalClient({ locale, data }: ParticipantPortalClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const english = locale === "en-US";
  const currentAccess = data?.currentAccess ?? null;
  const payoutProfile = data?.payoutProfile ?? null;
  const [profileDraft, setProfileDraft] = useState({
    displayName: payoutProfile?.displayName ?? currentAccess?.displayName ?? data?.user.name ?? "",
    legalName: payoutProfile?.legalName ?? "",
    contact: payoutProfile?.contact ?? currentAccess?.contact ?? "",
    payoutMethodLabel: payoutProfile?.payoutMethodLabel ?? "",
    payoutDetailsReference: payoutProfile?.payoutDetailsReference ?? "",
    invoiceRequired: payoutProfile?.invoiceRequired ?? false,
    notes: payoutProfile?.notes ?? "",
  });
  const portalRecommendations = currentAccess
    ? [
        {
	          title: english ? "Keep the payout profile current" : "结算资料保持最新",
	          body: english
	            ? "Display name, payout method, notes — the minimum before settlement."
	            : "显示名称、结算方式、备注——结算前最低要求。",
	        },
	        {
	          title: english ? "Check status before asking for settlement" : "申请结算前先看状态",
	          body: english
	            ? "Pending / approved / exported / paid / reversed — see it before handoff."
	            : "待结算 / 已批 / 已导出 / 已支付 / 已冲回——交接前看清。",
	        },
	        {
	          title: english ? "Self-only scope" : "只是你自己",
	          body: english
	            ? "Only your contribution. Doesn't widen to other beneficiaries or payout rails."
	            : "只展示你自己的贡献。不扩到其他受益方或支付通道。",
	        },
      ]
    : [
        {
	          title: english ? "Ask for portal access first" : "先申请门户访问",
	          body: english
	            ? "Get an active participant-portal scope, then status will show here."
	            : "先获得激活的门户访问范围，状态才会出现。",
	        },
      ];
  const portalReminders = [
    {
      title: english ? "Boundary" : "边界",
	      body: english
	        ? "Records profile and status for internal review. Not a payout rail, marketplace, or KYC console."
	        : "记录资料和状态供内部复核。不是支付通道、市场或 KYC 控制台。",
    },
    {
      title: english ? "Best next move" : "最合适下一步",
	      body: english
	        ? "Status unclear? Check the lines first, then update profile, then escalate."
	        : "状态不清楚？先看归因明细、再更新资料，最后再升级。",
    },
  ];

  const saveProfile = () => {
    if (!currentAccess) {
      return;
    }

    startTransition(async () => {
      const result = await updateParticipantPortalProfileAction({
        accessId: currentAccess.id,
        ...profileDraft,
        locale,
      });

      if (!result.ok) {
        toast.error(result.error ?? (english ? "Failed to update payout profile" : "更新结算资料失败"));
        return;
      }

      toast.success(english ? "Payout profile updated" : "结算资料已更新");
      router.refresh();
    });
  };

  const signOut = () => {
    startTransition(async () => {
      await logoutAction();
      router.push("/");
      router.refresh();
    });
  };

  if (!data) {
    return null;
  }

  return (
    <main className="surface-grid min-h-screen">
      <div className="mx-auto w-full max-w-[1280px] px-6 py-10 lg:px-10">
        <div className="workspace-surface-stack">
          <WorkspaceGuidancePanel
            eyebrow={english ? "Participant portal guidance" : "贡献方门户引导"}
	            title={english ? "Your payout status, in plain view" : "你自己的结算状态，一眼看清"}
	            summary={english ? "Self-only, reviewable, clear status before any settlement handoff." : "只看自己、可复核、交接结算前先看清状态。"}
            recommendations={portalRecommendations}
            reminders={portalReminders}
	            boundary={english ? "Self-only and review-first. No payout, no marketplace, no admin scope." : "仅本人可见、先复核。不打款、不上市场、不开放管理权限。"}
          />

          <div className="workspace-surface-stack">
            <WorkspaceSurfacePreferences />
            <Card className="workspace-form-assist workspace-panel-muted">
              <CardContent className="space-y-3 py-5">
                <p className="workspace-eyebrow">
                  {english ? "Portal assist" : "门户辅助"}
                </p>
                <p className="text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
                  {english ? "Use the smallest review path before escalating to settlement." : "进入结算前，先走最小复核路径。"}
                </p>
                <p className="text-sm leading-7 text-[color:var(--muted-foreground)]">
	                  {english ? "Check the lines first; update profile only if something changed." : "先看归因明细；资料只在有变动时再改。"}
                </p>
              </CardContent>
            </Card>
          </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Participant portal" : "贡献方门户"}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
	              {english ? "Your attributed earnings and payout posture" : "你的归因收益与结算状态"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--muted)]">
              {english
                ? "This portal stays narrow: review only your own contribution scope, keep payout profile basics current, and track pending / approved / exported / paid / reversed posture before any off-platform settlement."
	                : "这个门户保持收口：只看你自己的贡献范围，更新结算资料，并跟踪待结算、已批准、已导出、已支付、已冲回状态。所有实际结算仍保持站外人工处理。"}
            </p>
          </div>
          <Button variant="secondary" onClick={signOut} disabled={pending}>
            {english ? "Sign out" : "退出登录"}
          </Button>
        </div>

        {currentAccess ? (
          <>
            <Card className="border-[color:var(--dark-inset-border)] bg-[color:var(--dark-inset-surface)]/70 text-[color:var(--dark-inset-foreground)]">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>{currentAccess.displayName}</CardTitle>
                  <Badge variant="approval">
                    {currentAccess.participantClassLabel[english ? "en" : "zh"]}
                  </Badge>
                  <Badge variant={currentAccess.status === "ACTIVE" ? "success" : currentAccess.status === "INVITED" ? "info" : "neutral"}>
                    {portalStatusLabels[currentAccess.status][english ? "en" : "zh"]}
                  </Badge>
                  <Badge variant="neutral">
                    {beneficiaryLabels[currentAccess.beneficiaryType][english ? "en" : "zh"]}
                  </Badge>
                </div>
                <CardDescription className="text-[color:var(--muted-foreground)]">
                  {english
                    ? `${currentAccess.workspace.name} — you see only your own attributed lines and payout status.`
                    : `${currentAccess.workspace.name}——你只能看到自己的归因收益和结算状态。`}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <Info label={english ? "Portal status" : "门户状态"} value={portalStatusLabels[currentAccess.status][english ? "en" : "zh"]} />
                <Info label={english ? "Invite email" : "邀请邮箱"} value={currentAccess.inviteEmail} />
                <Info label={english ? "Terms accepted" : "条款确认"} value={currentAccess.termsAcceptedAt ? formatDateLabel(currentAccess.termsAcceptedAt) : (english ? "Pending" : "待确认")} />
                <Info label={english ? "Activated at" : "激活时间"} value={formatDateLabel(currentAccess.activatedAt)} />
                <Info label={english ? "Beneficiary registry" : "受益方登记"} value={english ? "Registered" : "已登记"} />
              </CardContent>
            </Card>

            {data.accesses.length > 1 ? (
              <Card className="border-[color:var(--dark-inset-border)] bg-[color:var(--dark-inset-surface)]/70 text-[color:var(--dark-inset-foreground)]">
                <CardHeader>
                  <CardTitle>{english ? "Your visible scopes" : "你的可见范围"}</CardTitle>
                  <CardDescription className="text-[color:var(--muted-foreground)]">
                    {english
                      ? "Switch between scopes. Each one still only shows your own."
                      : "在多个范围之间切换；每个仍然只显示你自己的。"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {data.accesses.map((access) => (
                    <Link
                      key={access.id}
                      href={`/portal?access=${access.id}`}
                      className={`rounded-2xl border px-4 py-4 transition ${
                        access.id === currentAccess.id
                          ? "border-[var(--accent)] bg-[color:var(--border-strong)]/90"
                          : "border-[color:var(--dark-inset-border)] bg-[color:var(--dark-inset-bg)]/40 hover:border-[color:var(--border-strong)]"
                      }`}
                    >
                      <p className="text-sm font-semibold text-white">{access.displayName}</p>
                      <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                        {resolveAccessLabel(access.beneficiaryType, english)}
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">{portalStatusLabels[access.status][english ? "en" : "zh"]}</p>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            <div className="grid gap-6 xl:grid-cols-[1fr_1.25fr]">
              <Card className="border-[color:var(--dark-inset-border)] bg-[color:var(--dark-inset-surface)]/70 text-[color:var(--dark-inset-foreground)]">
                <CardHeader>
                  <CardTitle>{english ? "Profile and payout basics" : "资料与结算基础信息"}</CardTitle>
                  <CardDescription className="text-[color:var(--muted-foreground)]">
                    {english
                      ? "Display name, payout method, notes — for internal review only, not a payout rail."
                      : "显示名称、结算方式、备注——只作内部复核，不打款。"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    value={profileDraft.displayName}
                    onChange={(event) => setProfileDraft((current) => ({ ...current, displayName: event.target.value }))}
                    placeholder={english ? "Display name" : "显示名称"}
                  />
                  <Input
                    value={profileDraft.legalName}
                    onChange={(event) => setProfileDraft((current) => ({ ...current, legalName: event.target.value }))}
                    placeholder={english ? "Legal name" : "法定主体名称"}
                  />
                  <Input
                    value={profileDraft.contact}
                    onChange={(event) => setProfileDraft((current) => ({ ...current, contact: event.target.value }))}
                    placeholder={english ? "Contact" : "联系方式"}
                  />
                  <Input
                    value={profileDraft.payoutMethodLabel}
                    onChange={(event) => setProfileDraft((current) => ({ ...current, payoutMethodLabel: event.target.value }))}
                    placeholder={english ? "Payout method label" : "结算方式说明"}
                  />
                  <Input
                    value={profileDraft.payoutDetailsReference}
                    onChange={(event) => setProfileDraft((current) => ({ ...current, payoutDetailsReference: event.target.value }))}
                    placeholder={english ? "Payout notes / reference" : "结算备注 / 引用"}
                  />
                  <label className="flex items-center justify-between rounded-2xl border border-[color:var(--dark-inset-border)] px-4 py-3 text-sm text-[color:var(--muted-foreground)]">
                    <span>{english ? "Invoice required" : "是否需要发票"}</span>
                    <input
                      type="checkbox"
                      checked={profileDraft.invoiceRequired}
                      onChange={(event) =>
                        setProfileDraft((current) => ({ ...current, invoiceRequired: event.target.checked }))
                      }
                    />
                  </label>
                  <Input
                    value={profileDraft.notes}
                    onChange={(event) => setProfileDraft((current) => ({ ...current, notes: event.target.value }))}
                    placeholder={english ? "Internal notes" : "内部备注"}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      onClick={saveProfile}
                      disabled={
                        pending ||
                        currentAccess.status === "SUSPENDED" ||
                        currentAccess.status === "ARCHIVED" ||
                        profileDraft.displayName.trim().length < 2 ||
                        profileDraft.payoutMethodLabel.trim().length < 2
                      }
                    >
                      {english ? "Save payout profile" : "保存结算资料"}
                    </Button>
                    {payoutProfile ? (
                      <Badge variant={payoutProfile.status === "ACTIVE" ? "success" : "neutral"}>
                        {payoutProfileStatusLabels[payoutProfile.status][english ? "en" : "zh"]}
                      </Badge>
                    ) : (
                      <Badge variant="danger">{english ? "Profile missing" : "资料未建立"}</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-[color:var(--dark-inset-border)] bg-[color:var(--dark-inset-surface)]/70 text-[color:var(--dark-inset-foreground)]">
                <CardHeader>
                  <CardTitle>{english ? "Earnings summary" : "收益摘要"}</CardTitle>
                  <CardDescription className="text-[color:var(--muted-foreground)]">
                    {english
                      ? "Your own attributed revenue, payable balance, and settlement state."
                      : "你自己的归因收益、待结算金额、结算状态。"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <Info label={english ? "Attributed lines" : "归因条数"} value={english ? `${data.attributedRevenueSummary.lineCount}` : `${data.attributedRevenueSummary.lineCount} 条`} />
                  <Info label={english ? "Attributed revenue" : "归因收益"} value={formatMoneyAmount(data.attributedRevenueSummary.totalAmountCents)} />
                  <Info label={english ? "Payable-later total" : "待结算总额"} value={formatMoneyAmount(data.payoutSummary.totalAmountCents)} />
                  <Info
                    label={english ? "Current settlement note" : "当前结算说明"}
                    value={
                      english
                        ? "Helm exports CSV for off-platform/manual settlement; there is still no payout rail in product."
                        : "Helm 目前只支持导出 CSV 供线下人工结算使用，产品内仍不存在打款通道。"
                    }
                  />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="border-[color:var(--dark-inset-border)] bg-[color:var(--dark-inset-surface)]/70 text-[color:var(--dark-inset-foreground)]">
                <CardHeader>
                  <CardTitle>{english ? "Payout status breakdown" : "结算状态拆分"}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <Info label={payoutStatusLabels.PENDING[english ? "en" : "zh"]} value={formatMoneyAmount(data.statusBreakdown.pendingAmountCents)} />
                  <Info label={payoutStatusLabels.APPROVED[english ? "en" : "zh"]} value={formatMoneyAmount(data.statusBreakdown.approvedAmountCents)} />
                  <Info label={payoutStatusLabels.EXPORTED[english ? "en" : "zh"]} value={formatMoneyAmount(data.statusBreakdown.exportedAmountCents)} />
                  <Info label={payoutStatusLabels.PAID[english ? "en" : "zh"]} value={formatMoneyAmount(data.statusBreakdown.paidAmountCents)} />
                  <Info label={payoutStatusLabels.REVERSED[english ? "en" : "zh"]} value={formatMoneyAmount(data.statusBreakdown.reversedAmountCents)} />
                </CardContent>
              </Card>

              <Card className="border-[color:var(--dark-inset-border)] bg-[color:var(--dark-inset-surface)]/70 text-[color:var(--dark-inset-foreground)]">
                <CardHeader>
                  <CardTitle>{english ? "Source breakdown" : "来源拆分"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.sourceBreakdown.length ? (
                    data.sourceBreakdown.map((item) => (
                      <div key={item.sourceType} className="rounded-2xl border border-[color:var(--dark-inset-border)] px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-white">{sourceLabels[item.sourceType][english ? "en" : "zh"]}</p>
                          <Badge variant="info">{english ? `${item.lineCount} lines` : `${item.lineCount} 条`}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{formatMoneyAmount(item.totalAmountCents)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                      {english ? "No attributed revenue lines are visible yet." : "当前还没有可见的归因收益记录。"}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="border-[color:var(--dark-inset-border)] bg-[color:var(--dark-inset-surface)]/70 text-[color:var(--dark-inset-foreground)]">
                <CardHeader>
                  <CardTitle>{english ? "Attributed revenue lines" : "归因收益明细"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.attributionEntries.length ? (
                    data.attributionEntries.map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-[color:var(--dark-inset-border)] px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-white">{entry.sourceLabel}</p>
                          <Badge variant="info">{sourceLabels[entry.sourceType][english ? "en" : "zh"]}</Badge>
                          <Badge variant={entry.status === "PAID" ? "success" : entry.status === "REVERSED" ? "danger" : entry.status === "APPROVED" ? "approval" : "neutral"}>
                            {revenueLedgerStatusLabels[entry.status][english ? "en" : "zh"]}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <Info label={english ? "Attributed amount" : "归因金额"} value={formatMoneyAmount(entry.attributedAmountCents, entry.currency)} />
                          <Info label={english ? "Recognized at" : "入账时间"} value={formatDateLabel(entry.recognizedAt)} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                      {english ? "No attributed lines are visible yet." : "当前还没有可见的归因记录。"}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="border-[color:var(--dark-inset-border)] bg-[color:var(--dark-inset-surface)]/70 text-[color:var(--dark-inset-foreground)]">
                <CardHeader>
                  <CardTitle>{english ? "Payout posture lines" : "结算姿态明细"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.payoutEntries.length ? (
                    data.payoutEntries.map((entry) => {
                      const status = entry.settlementLine?.status ?? mapPayoutLedgerStatus(entry.status);
                      return (
                        <div key={entry.id} className="rounded-2xl border border-[color:var(--dark-inset-border)] px-4 py-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-white">{sourceLabels[entry.revenueAttributionLedger.sourceType][english ? "en" : "zh"]}</p>
                            <Badge variant={status === "PAID" ? "success" : status === "REVERSED" ? "danger" : status === "EXPORTED" ? "approval" : status === "APPROVED" ? "info" : "neutral"}>
                              {payoutStatusLabels[status][english ? "en" : "zh"]}
                            </Badge>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            <Info label={english ? "Amount" : "金额"} value={formatMoneyAmount(entry.payableAmountCents, entry.currency)} />
                            <Info label={english ? "Payable after" : "最早可结算"} value={formatDateLabel(entry.payableAfter)} />
                            <Info
                              label={english ? "Source record" : "来源记录"}
                              value={entry.revenueAttributionLedger.sourceReference ? (english ? "Linked" : "已关联") : (english ? "Not set" : "未设置")}
                            />
                          </div>
                          {entry.notes ? <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">{entry.notes}</p> : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
                      {english ? "No payout posture lines are visible yet." : "当前还没有可见的结算姿态记录。"}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <Card className="border-[color:var(--dark-inset-border)] bg-[color:var(--dark-inset-surface)]/70 text-[color:var(--dark-inset-foreground)]">
            <CardHeader>
              <CardTitle>{english ? "No participant portal access yet" : "当前还没有贡献方门户访问权限"}</CardTitle>
              <CardDescription className="text-[color:var(--muted-foreground)]">
                {english
                  ? "Ask the org owner or billing admin for a portal access link."
                  : "找组织负责人或计费管理员发放访问链接。"}
              </CardDescription>
            </CardHeader>
          </Card>
        )}
        </div>
      </div>
    </main>
  );
}

function resolveAccessLabel(beneficiaryType: RevenueBeneficiaryType, english: boolean) {
  return beneficiaryLabels[beneficiaryType][english ? "en" : "zh"];
}

function mapPayoutLedgerStatus(status: RevenueLedgerStatus) {
  if (status === "APPROVED") {
    return "APPROVED" as const;
  }

  if (status === "PAID") {
    return "PAID" as const;
  }

  if (status === "REVERSED") {
    return "REVERSED" as const;
  }

  return "PENDING" as const;
}
