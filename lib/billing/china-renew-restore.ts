import type { AccessState, PaymentProvider } from "@prisma/client";
import { PAYMENT_PROVIDER } from "@/lib/billing/runtime-constants";

export type ChinaRenewRestoreIntent =
  | "PURCHASE"
  | "RENEW"
  | "RESTORE"
  | "REACTIVATE"
  | "HOLD";

export type ChinaRenewRestoreSummary = {
  intent: ChinaRenewRestoreIntent;
  currentAction: string;
  whyThisState: string;
  refreshPath: string;
  currentBoundary: string;
  noPortalNote: string;
};

function getProviderLabel(provider: PaymentProvider, english: boolean) {
  if (provider === PAYMENT_PROVIDER.ALIPAY) {
    return english ? "Alipay" : "支付宝";
  }

  return english ? "WeChat Pay" : "微信支付";
}

function getAccessStateLabel(accessState: AccessState, english: boolean) {
  if (english) {
    return accessState.toLowerCase();
  }

  switch (accessState) {
    case "TRIALING":
      return "试用中";
    case "ACTIVE":
      return "已激活";
    case "GRACE":
      return "宽限期";
    case "READ_ONLY":
      return "只读";
    case "CANCELED":
      return "已取消";
    default:
      return accessState;
  }
}

export function getChinaRenewRestoreIntent(accessState: AccessState): ChinaRenewRestoreIntent {
  switch (accessState) {
    case "TRIALING":
      return "PURCHASE";
    case "GRACE":
      return "RENEW";
    case "READ_ONLY":
      return "RESTORE";
    case "CANCELED":
      return "REACTIVATE";
    case "ACTIVE":
    default:
      return "HOLD";
  }
}

export function getChinaCheckoutActionLabel(input: {
  accessState: AccessState;
  provider: PaymentProvider;
  english: boolean;
}) {
  const providerLabel = getProviderLabel(input.provider, input.english);
  const intent = getChinaRenewRestoreIntent(input.accessState);

  if (intent === "PURCHASE") {
    return input.english
      ? `Purchase Helm Team with ${providerLabel}`
      : `用${providerLabel}购买 Helm Team`;
  }

  if (intent === "RENEW") {
    return input.english
      ? `Renew with ${providerLabel}`
      : `用${providerLabel}续费恢复`;
  }

  if (intent === "RESTORE") {
    return input.english
      ? `Restore access with ${providerLabel}`
      : `用${providerLabel}恢复访问`;
  }

  if (intent === "REACTIVATE") {
    return input.english
      ? `Reactivate with ${providerLabel}`
      : `用${providerLabel}重新激活`;
  }

  return input.english ? "Already active" : "当前已激活";
}

export function getChinaRenewRestoreSummary(input: {
  accessState: AccessState;
  english: boolean;
}): ChinaRenewRestoreSummary {
  const intent = getChinaRenewRestoreIntent(input.accessState);

  if (intent === "PURCHASE") {
    return {
      intent,
      currentAction: input.english
        ? "The organization is still in trial. China checkout is the path to turn trial into paid active access without hiding current core features first."
        : "当前组织仍在试用期。中国区购买入口用于把试用转成正式可用状态，而不是先隐藏当前核心功能。",
      whyThisState: input.english
        ? "Trial keeps the full current core product open. Payment only changes lifecycle and commercial posture."
        : "试用期会继续开放当前完整核心产品。支付只改变订阅状态和商业状态，不会先改成功能阉割版。",
      refreshPath: input.english
        ? "If notify arrives late, use refresh billing state to query the latest China order and map it back into Helm lifecycle truth."
        : "如果支付通知回来得慢，可以用“刷新订阅状态”主动查询最近一笔中国区订单，再把结果映射回 Helm 的订阅状态。",
      currentBoundary: input.english
        ? "This is still a narrow payment rail, not a finance console."
        : "这仍然只是窄支付通道，不是财务控制台。",
      noPortalNote: input.english
        ? "China rail still does not promise full portal parity in Sprint 1."
        : "中国区支付通道在当前版本仍然不承诺完整订阅门户能力。",
    };
  }

  if (intent === "RENEW") {
    return {
      intent,
      currentAction: input.english
        ? "The organization is in grace. Renewing here is the narrow restore path back to active paid access."
        : "当前组织处于宽限期。这里的续费用于把组织拉回正式可用状态。",
      whyThisState: input.english
        ? "Grace keeps viewing, export and restore-oriented actions open, while new high-cost processing stays paused."
        : "宽限期会继续开放查看、导出和恢复导向的动作，但新的高成本处理会保持暂停。",
      refreshPath: input.english
        ? "If payment already completed but notify has not landed yet, refresh will query the latest China order and try to sync the organization back to active."
        : "如果支付已经完成但通知还没回写，刷新会查询最近一笔中国区订单，并尝试把组织同步回可用状态。",
      currentBoundary: input.english
        ? "Renew here restores lifecycle access; it does not expand Helm into subscription operations tooling."
        : "这里的续费只恢复订阅访问，不会把 Helm 扩成订阅运营后台。",
      noPortalNote: input.english
        ? "China renew / restore currently stays inside checkout + notify/query sync instead of full portal management."
        : "当前中国区续费 / 恢复仍然停留在购买、通知和查询同步范围内，不是完整订阅门户管理。",
    };
  }

  if (intent === "RESTORE") {
    return {
      intent,
      currentAction: input.english
        ? "The organization is in read-only. Restore is the path back to active access after the grace window has already ended."
        : "当前组织处于只读。恢复访问就是在宽限期结束后，把组织重新拉回可用状态的路径。",
      whyThisState: input.english
        ? "Read-only keeps sign-in, viewing, export and restore-oriented settings actions open, while new high-cost processing stays blocked."
        : "只读状态会继续开放登录、查看、导出和恢复导向的设置动作，但新的高成本处理会保持阻止。",
      refreshPath: input.english
        ? "If notify is delayed, refresh can query the latest China order instead of asking the operator to read raw provider payloads."
        : "如果支付通知延迟，刷新会主动查询最近一笔中国区订单，而不是让运营同学去读支付渠道的原始回调。",
      currentBoundary: input.english
        ? "Restore is lifecycle-based and read-first. It does not hide existing records or exports."
        : "恢复路径仍然基于订阅状态，并优先保留读取能力，不会把既有记录和导出入口也一起隐藏掉。",
      noPortalNote: input.english
        ? "China restore still works without Stripe-style portal parity."
        : "中国区恢复路径当前仍然不依赖 Stripe 风格的完整订阅门户。",
    };
  }

  if (intent === "REACTIVATE") {
    return {
      intent,
      currentAction: input.english
        ? "The organization is marked canceled. Reactivation uses the same narrow China purchase path and then maps the result back into Helm lifecycle."
        : "当前组织已标记为已取消。重新激活会继续复用同一条中国区窄购买路径，再把结果映射回 Helm 的订阅状态。",
      whyThisState: input.english
        ? "Canceled still keeps read, export and restore paths visible so the workspace is not silently stranded."
        : "已取消状态仍然会保留读取、导出和恢复路径，避免工作区被无声搁置。",
      refreshPath: input.english
        ? "After checkout returns, refresh is the narrow operator path for delayed notify or query fallback."
        : "购买流程返回后，刷新就是处理通知延迟或查询兜底的窄运营路径。",
      currentBoundary: input.english
        ? "Reactivation does not replace Helm lifecycle truth with provider truth."
        : "重新激活不会让支付渠道记录取代 Helm 自己的订阅状态。",
      noPortalNote: input.english
        ? "China reactivation still does not imply full subscription management parity."
        : "中国区重新激活当前仍不意味着完整订阅管理能力。",
    };
  }

  return {
    intent,
    currentAction: input.english
      ? "The organization is already active. Do not start duplicate China checkout unless a new paid cycle is explicitly needed later."
      : "当前组织已经处于可用状态。除非后续进入新的续费周期，否则不要重复发起中国区购买流程。",
    whyThisState: input.english
      ? "Active paid access already keeps the full current core product open."
      : "正式可用状态已经会继续开放当前完整核心产品。",
    refreshPath: input.english
      ? "If payment just completed and lifecycle still looks stale, refresh can query the last China order and sync the current state."
      : "如果刚完成支付但订阅状态还没同步过来，可以用刷新去查询最近一笔中国区订单，再同步当前状态。",
    currentBoundary: input.english
      ? "Active organizations should not repurchase just to confirm status."
      : "已可用的组织不应该为了确认状态而重复购买。",
    noPortalNote: input.english
      ? "China rail still does not promise full portal parity, so refresh remains the main operator tool."
      : "中国区支付通道当前仍不承诺完整订阅门户能力，所以刷新仍然是主要运营工具。",
  };
}

function isChinaSuccessStatus(providerStatus: string | null | undefined) {
  return providerStatus === "TRADE_SUCCESS" || providerStatus === "TRADE_FINISHED" || providerStatus === "SUCCESS";
}

function isChinaPendingStatus(providerStatus: string | null | undefined) {
  return providerStatus === "WAIT_BUYER_PAY" || providerStatus === "NOTPAY" || providerStatus === "USERPAYING";
}

export function getChinaRefreshResultMessage(input: {
  accessState: AccessState;
  provider: PaymentProvider;
  providerStatus: string | null | undefined;
  english: boolean;
}) {
  const providerLabel = getProviderLabel(input.provider, input.english);

  if (isChinaSuccessStatus(input.providerStatus)) {
    return input.english
      ? `${providerLabel} payment is now reflected in Helm lifecycle: the organization has been refreshed into active access.`
      : `${providerLabel} 的支付结果已经映射回 Helm 订阅状态：当前组织已刷新到可用状态。`;
  }

  if (isChinaPendingStatus(input.providerStatus)) {
    return input.english
      ? `${providerLabel} still reports the latest order as pending. The organization will stay ${getAccessStateLabel(input.accessState, true)} until payment completes and sync is refreshed again.`
      : `${providerLabel} 仍把最近一笔订单标记为待完成。当前组织会继续保持${getAccessStateLabel(input.accessState, false)}，直到支付完成并再次刷新同步。`;
  }

  return input.english
    ? `${providerLabel} did not confirm a completed payment yet. The organization will stay ${getAccessStateLabel(input.accessState, true)} until a later renew / restore succeeds.`
    : `${providerLabel} 还没有确认成功支付。当前组织会继续保持${getAccessStateLabel(input.accessState, false)}，直到后续续费 / 恢复真正成功。`;
}

export function getChinaRefreshMissingOrderMessage(input: {
  accessState: AccessState;
  english: boolean;
}) {
  const intent = getChinaRenewRestoreIntent(input.accessState);

  if (intent === "PURCHASE") {
    return input.english
      ? "There is no China payment order to refresh yet. Start purchase first if you want to move this organization from trialing into paid active access."
      : "当前还没有可刷新的中国支付订单。如果要把组织从试用拉到正式可用状态，请先发起购买。";
  }

  if (intent === "RENEW") {
    return input.english
      ? "There is no China payment order to refresh yet. Start renew first if you want to restore this organization from grace."
      : "当前还没有可刷新的中国支付订单。如果要把组织从宽限期拉回可用状态，请先发起续费。";
  }

  if (intent === "RESTORE") {
    return input.english
      ? "There is no China payment order to refresh yet. Start restore first if you want to reopen access from read-only."
      : "当前还没有可刷新的中国支付订单。如果要把组织从只读拉回可用状态，请先发起恢复支付。";
  }

  if (intent === "REACTIVATE") {
    return input.english
      ? "There is no China payment order to refresh yet. Start reactivation first if you want to move this organization back onto an active paid path."
      : "当前还没有可刷新的中国支付订单。如果要把组织重新拉回正式可用状态，请先发起重新激活。";
  }

  return input.english
    ? "There is no pending China payment order to refresh right now. Active organizations should use refresh only after a recent payment attempt or delayed notify."
    : "当前没有待刷新的中国支付订单。已可用的组织只应在最近发起过支付或怀疑通知延迟时使用刷新。";
}

export function getChinaDuplicateCheckoutMessage(input: {
  english: boolean;
}) {
  return input.english
    ? "This organization already has active paid access. China Sprint 1 avoids duplicate purchase here; use refresh if you are only confirming delayed payment sync."
    : "当前组织已经处于正式可用状态。中国区当前版本会避免在这里重复购买；如果你只是确认支付回写延迟，请先使用刷新状态。";
}
