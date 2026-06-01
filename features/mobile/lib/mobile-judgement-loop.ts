import type {
  MustPushItem,
  MobileHeroAction,
  MobileHeroEvidenceRef,
  MobileHeroState,
  MobileJudgementLoopModel,
} from "../types";

export const MOBILE_BANNED_ACTION_WORDS: readonly string[] = [
  // Chinese high-risk commitment words
  "确认",
  "同意",
  "完成",
  "已发送",
  "已答复",
  "批准",
  "承诺",
  "自动发送",
  "自动审批",
  "自动写回",
  "通知客户",
  "发送邮件",
  "搞定",
  // Pre-existing Chinese banned words
  "立即发送",
  "自动提交",
  "代为签署",
  "自动执行",
  "批量操作",
  "强制推送",
  "覆盖审核",
  // English banned words
  "bypass",
  "auto-send",
  "auto-submit",
  "force-push",
  "override review",
];

export function containsUnsafeMobileCopy(text: string): boolean {
  const lower = text.toLowerCase();
  return MOBILE_BANNED_ACTION_WORDS.some((w) =>
    lower.includes(w.toLowerCase())
  );
}

function deriveState(item: MustPushItem): MobileHeroState {
  if (item.boundaryNote?.type === "out_of_scope") return "cross_tenant_denied";
  if (item.type === "proof_or_review_required" || item.score < 50)
    return "evidence_insufficient";
  return "normal";
}

const BUSINESS_SOURCE_LABEL: Record<MustPushItem["type"], { zh: string; en: string }> = {
  overdue_commitment: { zh: "机会台账 · 逾期承诺", en: "Opportunity ledger · overdue commitment" },
  blocked_decision: { zh: "复核队列 · 待判断", en: "Review queue · pending decision" },
  stalled_opportunity: { zh: "机会台账 · 停滞机会", en: "Opportunity ledger · stalled opportunity" },
  meeting_follow_up: { zh: "会议记录 · 待跟进", en: "Meeting record · follow-up due" },
  customer_waiting: { zh: "客户线程 · 等待回复", en: "Customer thread · waiting on us" },
  proof_or_review_required: { zh: "客户资料 · 待补证据", en: "Customer record · evidence needed" },
};

function buildEvidence(item: MustPushItem, english: boolean): MobileHeroEvidenceRef | null {
  if (!item.reason) return null;
  return {
    sourceHint: english
      ? BUSINESS_SOURCE_LABEL[item.type].en
      : BUSINESS_SOURCE_LABEL[item.type].zh,
    helmInterpretation: item.reason,
  };
}

function buildActions(
  item: MustPushItem,
  state: MobileHeroState,
  english: boolean,
): MobileHeroAction[] {
  const base = item.primaryAction.href;
  const itemId = item.id;

  const reviewHref = `/approvals?source=mobile&itemId=${encodeURIComponent(itemId)}`;
  const evidenceHref = `#mobile-evidence`;
  const insufficientHref = `/approvals?source=mobile&itemId=${encodeURIComponent(itemId)}&posture=evidence_insufficient`;

  const actions: MobileHeroAction[] = [];

  if (state === "cross_tenant_denied") {
    // Must not leak item/title/reason/evidence; only safe internal navigation
    actions.push({ label: "返回首页", href: "/mobile", variant: "primary" });
    actions.push({ label: "返回工作区首页", href: "/dashboard", variant: "secondary" });
    return actions;
  }

  if (state === "evidence_insufficient") {
    actions.push({ label: "进入复核", href: reviewHref, variant: "primary" });
    actions.push({
      label: "标为证据不足",
      href: insufficientHref,
      variant: "secondary",
    });
    const outcomeHref = resolveSafeOutcomeHref(item);
    if (outcomeHref) {
      actions.push({
        label: english ? "Track outcome" : "进入结果回收",
        href: outcomeHref,
        variant: "secondary",
      });
    }
    return actions;
  }

  // normal
  actions.push({ label: "进入复核", href: reviewHref, variant: "primary" });
  actions.push({ label: "查看证据", href: evidenceHref, variant: "secondary" });
  const outcomeHref = resolveSafeOutcomeHref(item);
  if (outcomeHref) {
    actions.push({
      label: english ? "Track outcome" : "进入结果回收",
      href: outcomeHref,
      variant: "secondary",
    });
  }
  if (typeof base === "string" && isSafeInternalNavigationHref(base)) {
    actions.push({
      label: "打开桌面端处理",
      href: base,
      variant: "secondary",
    });
  }
  return actions;
}

function isSafeInternalNavigationHref(href: string): boolean {
  return (
    href.startsWith("/") &&
    !href.startsWith("//") &&
    !href.startsWith("/api/") &&
    !href.includes("\\") &&
    !/[\x00-\x1F\x7F]/.test(href) &&
    !/^\/[a-z][a-z0-9+.-]*:/i.test(href)
  );
}

function resolveSafeOutcomeHref(item: MustPushItem): string | null {
  const href = item.outcomeCheckpoint?.reviewHref;
  if (!href) return null;
  return isSafeInternalNavigationHref(href) ? href : null;
}

const STATE_HEADLINE: Record<MobileHeroState, string> = {
  normal: "今天先处理这件事",
  evidence_insufficient: "证据不足，请人工复核",
  conflict: "存在冲突，待裁定",
  connector_down: "连接器离线",
  cross_tenant_denied: "跨租户操作，超出当前授权范围",
  empty: "暂无待处理事项",
};

const STATE_SUBTEXT: Record<MobileHeroState, string> = {
  normal: "先看客户在等什么，再决定是否进入复核。",
  evidence_insufficient: "当前评分或证据不足，建议先进入人工复核。",
  conflict: "多条信号存在矛盾，请人工裁定后再推进。",
  connector_down: "数据源暂时不可用，判断结果仅供参考。",
  cross_tenant_denied: "该操作涉及当前工作区授权范围以外的资源，当前仅提供安全返回入口。",
  empty: "当前没有需要处理的推进项。",
};

export function buildMobileJudgementLoop({
  items,
  english = false,
}: {
  items: MustPushItem[];
  english?: boolean;
}): MobileJudgementLoopModel {
  if (items.length === 0) {
    return {
      state: "empty",
      item: null,
      headline: english ? "Nothing pending" : STATE_HEADLINE.empty,
      subtext: english
        ? "No push items at this time."
        : STATE_SUBTEXT.empty,
      evidence: null,
      actions: [],
    };
  }

  const item = items[0];
  const state = deriveState(item);
  const actions = buildActions(item, state, english);

  // Safety check — actions must not contain banned wording
  for (const action of actions) {
    if (containsUnsafeMobileCopy(action.label) || containsUnsafeMobileCopy(action.href)) {
      throw new Error(
        `Mobile action contains unsafe copy: "${action.label}" / "${action.href}"`
      );
    }
  }

  // cross_tenant_denied must not leak item identity or evidence
  if (state === "cross_tenant_denied") {
    return {
      state,
      item: null,
      headline: STATE_HEADLINE.cross_tenant_denied,
      subtext: STATE_SUBTEXT.cross_tenant_denied,
      evidence: null,
      actions,
    };
  }

  const evidence = buildEvidence(item, english);
  const subtext =
    state === "evidence_insufficient"
      ? english
        ? `${item.reason} Review the evidence before moving it forward.`
        : `${item.reason} 先进入人工复核。`
      : item.reason;

  return {
    state,
    item,
    headline: item.title,
    subtext,
    evidence,
    actions,
  };
}
