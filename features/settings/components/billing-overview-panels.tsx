"use client";

import type { ComponentProps } from "react";
import { OperatingFoundationSummaryCard } from "@/components/shared/operating-foundation-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ACCESS_STATE } from "@/lib/billing/runtime-constants";
import { getChinaCheckoutActionLabel } from "@/lib/billing/china-renew-restore";
import { formatDateLabel } from "@/lib/utils";
import { accessStateLabels } from "@/features/settings/formatters/labels";
import type { SettingsClientProps } from "@/features/settings/types/settings-client-props";
import { Info } from "./settings-display";

type BillingOverviewData = Pick<
  SettingsClientProps["data"],
  | "workspace"
  | "organizationSummary"
  | "billingOverview"
  | "seatSummary"
  | "lifecycleBoundarySummary"
  | "workerEntitlementSummary"
  | "workerCommercialOverview"
  | "chinaRenewRestoreSummary"
>;

type BillingOverviewPanelsProps = {
  billingOperatingFoundationSummary: ComponentProps<typeof OperatingFoundationSummaryCard>;
  billingPortalModeLabel: string;
  billingState: SettingsClientProps["billingState"];
  canManageBilling: boolean;
  chinaCheckoutButtonsVisible: boolean;
  data: BillingOverviewData;
  english: boolean;
  formatMoney: (cents: number) => string;
  openBillingPortal: () => void;
  paymentAvailableRailsLabel: string;
  paymentCallbackModeLabel: string;
  paymentCheckoutModeLabel: string;
  paymentLifecycleConnectionLabel: string;
  paymentLifecycleMappingModeLabel: string;
  paymentLifecycleSourceLabel: string;
  paymentProviderLabel: string;
  paymentRailNarrative: string;
  paymentRailStageLabel: string;
  paymentRegionLabel: string;
  paymentSubscriptionLabel: string;
  pending: boolean;
  refreshBilling: () => void;
  startCheckout: (
    provider?: SettingsClientProps["data"]["billingOverview"]["providerOptions"][number]["provider"],
  ) => void;
  workerEntitlementNarrative: string;
};

export function BillingOverviewPanels({
  billingOperatingFoundationSummary,
  billingPortalModeLabel,
  billingState,
  canManageBilling,
  chinaCheckoutButtonsVisible,
  data,
  english,
  formatMoney,
  openBillingPortal,
  paymentAvailableRailsLabel,
  paymentCallbackModeLabel,
  paymentCheckoutModeLabel,
  paymentLifecycleConnectionLabel,
  paymentLifecycleMappingModeLabel,
  paymentLifecycleSourceLabel,
  paymentProviderLabel,
  paymentRailNarrative,
  paymentRailStageLabel,
  paymentRegionLabel,
  paymentSubscriptionLabel,
  pending,
  refreshBilling,
  startCheckout,
  workerEntitlementNarrative,
}: BillingOverviewPanelsProps) {
  const chinaRenewRestoreSummary = data.chinaRenewRestoreSummary;

  return (
    <>
      {data.organizationSummary.selfServeTrialWorkspace ? (
        <Card className="workspace-panel-muted border-[color:var(--border-strong)]">
          <CardContent className="space-y-3 py-5 text-sm leading-6 text-[color:var(--muted)]">
            <p className="font-semibold text-[color:var(--foreground)]">
              {english ? "Self-serve trial organization" : "当前是自助试用组织"}
            </p>
            <p>
              {english
                ? "This organization was created through self-serve signup. Trial, seats, included core workers, and active-organization runtime are already live. Use setup to finish persona and connector choices, then use billing overview here for lifecycle, purchase, and restore paths."
                : "这个组织是通过自助试用创建的。试用、席位、基础能力和当前组织运行状态已经到位。接下来在初始化向导里完成身份和连接器配置，再在这里查看生命周期、购买和恢复路径。"}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <OperatingFoundationSummaryCard {...billingOperatingFoundationSummary} />

      {billingState.status ? (
        <Card
          className={
            billingState.status === "checkout-completed" || billingState.status === "portal-returned"
              ? "border-[color:var(--status-success-border)] bg-[color:var(--status-success-bg)]/70"
              : "border-[color:var(--status-warning-border)] bg-[color:var(--status-warning-bg)]/70"
          }
        >
          <CardContent className="py-4 text-sm text-[color:var(--foreground)]">
            {billingState.message ??
              (billingState.status === "checkout-completed"
                ? english
                  ? "Checkout completed. Subscription status may take a moment to sync; use refresh if needed."
                  : "购买已完成。订阅状态可能需要一点时间同步；如有需要可手动刷新。"
                : billingState.status === "alipay-checkout-returned"
                  ? chinaRenewRestoreSummary?.refreshPath ??
                    (english
                      ? "Returned from Alipay. If the payment has already completed, refresh billing state to sync the organization lifecycle."
                      : "已从支付宝返回。如果支付已经完成，可手动刷新订阅状态，把组织状态同步回来。")
                  : billingState.status === "wechat-pay-checkout-returned"
                    ? chinaRenewRestoreSummary?.refreshPath ??
                      (english
                        ? "Returned from WeChat Pay. If the payment has already completed, refresh billing state to sync the organization lifecycle."
                        : "已从微信支付返回。如果支付已经完成，可手动刷新订阅状态，把组织状态同步回来。")
                    : billingState.status === "checkout-canceled"
                      ? english
                        ? "Checkout was canceled. Your trial and current workspace access remain unchanged."
                        : "购买已取消。你的试用和当前工作区访问状态不会被改变。"
                      : billingState.status === "alipay-checkout-canceled"
                        ? english
                          ? "Alipay checkout was canceled. Current lifecycle truth stays unchanged, and you can restart the China renew / restore path whenever you are ready."
                          : "支付宝支付已取消。当前订阅状态不会被改变；准备好后可以重新发起中国区续费 / 恢复路径。"
                        : billingState.status === "wechat-pay-checkout-canceled"
                          ? english
                            ? "WeChat Pay checkout was canceled. Current lifecycle truth stays unchanged, and you can restart the China renew / restore path whenever you are ready."
                            : "微信支付已取消。当前订阅状态不会被改变；准备好后可以重新发起中国区续费 / 恢复路径。"
                          : english
                            ? "Returned from the hosted subscription portal. Refresh status if you changed the subscription."
                            : "已从托管订阅管理页返回；如果你改了订阅，可手动刷新状态。")}
          </CardContent>
        </Card>
      ) : null}

      <Card className="workspace-panel-muted">
        <CardHeader>
          <CardTitle>{english ? "Organization summary" : "组织摘要"}</CardTitle>
          <CardDescription>
              {english
                ? "Workspace, lifecycle, payment rail, commercial state."
                : "工作区、订阅状态、支付通道、商业状态。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Info
            label={english ? "Organization" : "当前组织"}
            value={data.workspace?.name ?? (english ? "Unknown workspace" : "未知工作区")}
          />
          <Info
            label={english ? "Current state" : "当前状态"}
            value={accessStateLabels[data.billingOverview.currentState][english ? "en" : "zh"]}
          />
          <Info
            label={english ? "Current plan" : "当前方案"}
            value={formatBillingPlanLabel(data.billingOverview.currentPlan, english)}
          />
          <Info label={english ? "Base fee" : "组织基础费"} value={formatMoney(data.billingOverview.baseFeeCents)} />
          <Info label={english ? "Payment rail" : "当前支付通道"} value={paymentProviderLabel} />
          <Info label={english ? "Region" : "支付区域"} value={paymentRegionLabel} />
          <Info
            label={english ? "Included admin seats" : "包含管理员席位"}
            value={
              english
                ? `${data.billingOverview.includedAdminSeats}`
                : `${data.billingOverview.includedAdminSeats} 个`
            }
          />
          <Info
            label={english ? "Active seat posture" : "当前活跃席位"}
            value={english ? `${data.seatSummary.activeSeatCount}` : `${data.seatSummary.activeSeatCount} 个`}
          />
          <Info
            label={english ? "Additional active seat price" : "额外活跃席位单价"}
            value={formatMoney(data.billingOverview.activeSeatPriceCents)}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{english ? "Payment rail" : "支付接入"}</CardTitle>
            <CardDescription>
              {english
                ? "Global: hosted checkout + subscription. China: checkout + notify + lifecycle sync."
                : "全球：托管购买 + 订阅。中国：购买 + 通知 + 生命周期同步。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Info label={english ? "Provider" : "支付提供方"} value={paymentProviderLabel} />
              <Info label={english ? "Region" : "支付区域"} value={paymentRegionLabel} />
              <Info label={english ? "Checkout mode" : "购买模式"} value={paymentCheckoutModeLabel} />
              <Info label={english ? "Portal mode" : "门户模式"} value={billingPortalModeLabel} />
              <Info label={english ? "Callback mode" : "回调模式"} value={paymentCallbackModeLabel} />
              <Info
                label={english ? "Lifecycle mapping" : "订阅状态映射"}
                value={paymentLifecycleMappingModeLabel}
              />
              <Info
                label={english ? "Lifecycle source" : "订阅状态来源"}
                value={paymentLifecycleSourceLabel}
              />
              <Info
                label={english ? "Subscription status" : "支付侧订阅状态"}
                value={paymentSubscriptionLabel}
              />
              <Info label={english ? "Rail stage" : "支付通道阶段"} value={paymentRailStageLabel} />
              <Info
                label={english ? "Checkout readiness" : "购买可用性"}
                value={
                  data.billingOverview.checkoutReady
                    ? english
                      ? "Ready"
                      : "可购买"
                    : english
                      ? "Not now"
                      : "当前不可用"
                }
              />
              <Info
                label={english ? "Portal readiness" : "门户可用性"}
                value={
                  data.billingOverview.portalReady
                    ? english
                      ? "Ready"
                      : "可进入"
                    : english
                      ? "Not ready"
                      : "尚不可用"
                }
              />
              <Info
                label={english ? "Lifecycle sync" : "订阅状态同步"}
                value={paymentLifecycleConnectionLabel}
              />
              <Info
                label={english ? "Additional billable seats" : "额外计费席位"}
                value={
                  english
                    ? `${data.billingOverview.additionalBillableSeats}`
                    : `${data.billingOverview.additionalBillableSeats} 个`
                }
              />
              <Info
                label={english ? "Billing period end" : "当前计费周期结束"}
                value={formatDateLabel(data.billingOverview.billingPeriodEndsAt)}
              />
            </div>
            <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
              {paymentRailNarrative}
              <div className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                {english
                  ? `Current available rail set: ${paymentAvailableRailsLabel}. This remains a billing overview, not a finance console.`
                  : `当前可用支付通道集合：${paymentAvailableRailsLabel}。这里仍然只是订阅概览，不是财务控制台。`}
              </div>
              <div className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                {english
                  ? `Billing management is ${canManageBilling ? "enabled" : "read-only"} for the current role. Checkout, portal, and refresh stay capability-gated.`
                  : `当前角色的订阅管理为${canManageBilling ? "可操作" : "只读"}；购买、订阅门户和刷新继续受能力边界控制。`}
              </div>
            </div>
            {data.billingOverview.paymentRegion === "CN" && chinaRenewRestoreSummary ? (
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {english ? "China renew / restore path" : "中国区续费 / 恢复路径"}
                </p>
                <div className="mt-3 space-y-3 text-sm leading-6 text-[color:var(--muted)]">
                  <p>{chinaRenewRestoreSummary.currentAction}</p>
                  <p>{chinaRenewRestoreSummary.whyThisState}</p>
                  <p>{chinaRenewRestoreSummary.refreshPath}</p>
                  <p>{chinaRenewRestoreSummary.currentBoundary}</p>
                  <p className="text-xs text-[color:var(--muted-foreground)]">{chinaRenewRestoreSummary.noPortalNote}</p>
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {data.billingOverview.paymentRegion === "CN" ? (
                <>
                  {chinaCheckoutButtonsVisible
                    ? data.billingOverview.providerOptions.map((option) => (
                        <Button
                          key={option.provider}
                          onClick={() => startCheckout(option.provider)}
                          disabled={pending || !canManageBilling || !option.checkoutReady}
                          variant={option.current ? "default" : "secondary"}
                        >
                          {getChinaCheckoutActionLabel({
                            accessState: data.billingOverview.currentState,
                            provider: option.provider,
                            english,
                          })}
                        </Button>
                      ))
                    : null}
                  <Button
                    variant="secondary"
                    onClick={refreshBilling}
                    disabled={pending || !canManageBilling || !data.billingOverview.refreshReady}
                  >
                    {english ? "Refresh billing state" : "刷新订阅状态"}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    onClick={() => startCheckout()}
                    disabled={pending || !canManageBilling || !data.billingOverview.checkoutReady}
                  >
                    {data.organizationSummary.currentState === ACCESS_STATE.ACTIVE
                      ? english
                        ? "Already active"
                        : "当前已激活"
                      : data.organizationSummary.currentState === ACCESS_STATE.TRIALING
                        ? english
                          ? "Purchase Helm Team"
                          : "购买 Helm Team"
                        : english
                          ? "Restore paid access"
                          : "恢复付费订阅"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={openBillingPortal}
                    disabled={pending || !canManageBilling || !data.billingOverview.portalReady}
                  >
                    {english ? "Manage subscription" : "管理订阅"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={refreshBilling}
                    disabled={pending || !canManageBilling || !data.billingOverview.refreshReady}
                  >
                    {english ? "Refresh billing state" : "刷新订阅状态"}
                  </Button>
                </>
              )}
            </div>
            {data.billingOverview.paymentRegion === "CN" ? (
              <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-xs leading-6 text-[color:var(--muted-foreground)]">
                {chinaRenewRestoreSummary?.noPortalNote ??
                  (english
                    ? "Alipay / WeChat Pay: purchase, restore, lifecycle sync. Duplicate purchases are blocked."
                    : "支付宝 / 微信：购买、恢复、状态同步。已激活组织不会重复购买。")}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{english ? "Lifecycle summary" : "订阅状态摘要"}</CardTitle>
            <CardDescription>
              {english
                ? "What's open, what's paused, and why."
                : "什么开放、什么暂停、为什么。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Info
              label={english ? "Current state" : "当前状态"}
              value={accessStateLabels[data.billingOverview.currentState][english ? "en" : "zh"]}
            />
            <Info
              label={english ? "Trial started" : "试用开始"}
              value={formatDateLabel(data.billingOverview.trialStartedAt)}
            />
            <Info
              label={english ? "Trial ends" : "试用结束"}
              value={formatDateLabel(data.billingOverview.trialEndsAt)}
            />
            <Info
              label={english ? "Grace ends" : "宽限结束"}
              value={formatDateLabel(data.billingOverview.graceEndsAt)}
            />
            <Info
              label={english ? "Billing period end" : "计费周期结束"}
              value={formatDateLabel(data.billingOverview.billingPeriodEndsAt)}
            />
            <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
              {data.lifecycleBoundarySummary.note}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="theme-surface-panel-soft rounded-2xl px-4 py-4">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {english ? "Still available in this state" : "当前状态下仍然开放"}
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                  {data.lifecycleBoundarySummary.stillAvailable.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
              <div className="theme-surface-panel-soft rounded-2xl px-4 py-4">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">
                  {english ? "Paused high-cost processing" : "已暂停的高成本处理"}
                </p>
                {data.lifecycleBoundarySummary.pausedHighCostProcessing.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                    {data.lifecycleBoundarySummary.pausedHighCostProcessing.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                    {english
                      ? "No high-cost processing is paused in the current state."
                      : "当前状态下没有额外暂停的高成本处理。"}
                  </p>
                )}
              </div>
            </div>
            <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
              {data.lifecycleBoundarySummary.scopeNote}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{english ? "Worker entitlement summary" : "能力权益摘要"}</CardTitle>
            <CardDescription>
              {english
                ? "Core workers + monthly / per-use add-ons. Not a marketplace."
                : "基础能力 + 按月 / 按次增值能力。不是能力市场。"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <Info
                label={english ? "Included workers" : "基础能力"}
                value={
                  english
                    ? `${data.workerEntitlementSummary.includedActiveCount}`
                    : `${data.workerEntitlementSummary.includedActiveCount} 个`
                }
              />
              <Info
                label={english ? "Commercial add-ons active" : "已生效增值能力"}
                value={
                  english
                    ? `${data.workerEntitlementSummary.commercialActiveCount}`
                    : `${data.workerEntitlementSummary.commercialActiveCount} 个`
                }
              />
              <Info
                label={english ? "Monthly rails reserved" : "预留按月路径"}
                value={
                  english
                    ? `${data.workerEntitlementSummary.addOnMonthlyReservedCount}`
                    : `${data.workerEntitlementSummary.addOnMonthlyReservedCount} 条`
                }
              />
              <Info
                label={english ? "Per-use rails reserved" : "预留按次路径"}
                value={
                  english
                    ? `${data.workerEntitlementSummary.addOnPerUseReservedCount}`
                    : `${data.workerEntitlementSummary.addOnPerUseReservedCount} 条`
                }
              />
              <Info
                label={english ? "Windowed entitlements" : "带有效期权益"}
                value={
                  english
                    ? `${data.workerEntitlementSummary.windowedEntitlementCount}`
                    : `${data.workerEntitlementSummary.windowedEntitlementCount} 个`
                }
              />
              <Info
                label={english ? "Internal limit-backed rails" : "带内部上限路径"}
                value={
                  english
                    ? `${data.workerEntitlementSummary.internalLimitCount}`
                    : `${data.workerEntitlementSummary.internalLimitCount} 个`
                }
              />
            </div>
            <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
              {workerEntitlementNarrative}
            </div>
            <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
              {english
                ? "Current payment rails stay future-ready for monthly or per-use add-on expansion, but this page still stops at commercial wiring. There is no worker marketplace, creator payout, or app-store checkout matrix here."
                : "当前支付路径会继续为后续按月或按次增值能力扩展预留接线，但这里仍然只停在商业接线层。它不是能力市场、创作者结算面板，也不是应用商店购买矩阵。"}
            </div>
            {data.workerCommercialOverview.map((worker) => (
              <div key={worker.id} className="theme-surface-panel rounded-2xl px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{worker.label[english ? "en" : "zh"]}</p>
                  <Badge variant={worker.isIncludedCore ? "success" : "approval"}>
                    {worker.commercialMode[english ? "en" : "zh"]}
                  </Badge>
                  <Badge
                    variant={
                      worker.status === "ACTIVE"
                        ? "info"
                        : worker.status === "CANCELED"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {worker.status === "ACTIVE"
                      ? english
                        ? "Active"
                        : "生效中"
                      : worker.status === "CANCELED"
                        ? english
                          ? "Canceled"
                          : "已停用"
                        : english
                          ? "Inactive"
                          : "未生效"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                  {worker.description[english ? "en" : "zh"]}
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <Info
                    label={english ? "Commercial truth" : "商业真实状态"}
                    value={worker.commercialTruth[english ? "en" : "zh"]}
                  />
                  <Info
                    label={english ? "Usage path" : "使用路径"}
                    value={worker.usagePath[english ? "en" : "zh"]}
                  />
                  <Info
                    label={english ? "Future path" : "后续路径"}
                    value={worker.futurePath[english ? "en" : "zh"]}
                  />
                  <Info
                    label={english ? "Effective from" : "生效起点"}
                    value={formatDateLabel(worker.effectiveFrom)}
                  />
                  <Info
                    label={english ? "Effective until" : "生效截止"}
                    value={formatDateLabel(worker.effectiveTo)}
                  />
                  <Info
                    label={english ? "Internal limit" : "内部上限"}
                    value={
                      worker.internalLimit === null
                        ? english
                          ? "Not set"
                          : "未设置"
                        : english
                          ? `${worker.internalLimit}`
                          : `${worker.internalLimit} 次`
                    }
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function formatBillingPlanLabel(plan: string, english: boolean) {
  const normalized = plan.trim().toLowerCase();

  if (normalized === "helm_team_v1") {
    return english ? "Helm Team" : "Helm 团队方案";
  }

  return plan
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
