import {
  OPERATING_SIGNAL_ALLOWED_NEXT_ACTION_SET,
  type OperatingSignalDataPosture,
  type OperatingSignalFlowEvent,
  type OperatingSignalFlowFixturePack,
  type OperatingSignalFlowSnapshot,
} from "@/lib/operating-signal-flow/contract";
import { isEnglishLocale, type UiLocale } from "@/lib/i18n/config";

export type OperatingSignalFlowStageStatus = "flowing" | "review" | "blocked" | "learned";

export type OperatingSignalFlowDisplayStage = {
  id: string;
  label: string;
  value: string;
  detail: string;
  status: OperatingSignalFlowStageStatus;
};

export type OperatingSignalFlowPressureSignal = {
  id: string;
  label: string;
  detail: string;
  blocker: string;
  source: string;
  object: string;
  evidence: string;
  href: string;
  status: "blocked" | "review";
};

export type OperatingSignalFlowJourneyStep = {
  id: string;
  index: number;
  timeLabel: string;
  title: string;
  detail: string;
  transition: string;
  source: string;
  object: string;
  evidence: string;
  trace: string;
  nextActionLabel: string;
  href: string;
  blocker: string | null;
  status: OperatingSignalFlowStageStatus;
};

export type OperatingSignalFlowJourney = {
  caseId: string;
  title: string;
  subtitle: string;
  signalKey: string;
  traceId: string;
  summaryItems: Array<{ label: string; value: string; detail: string }>;
  steps: OperatingSignalFlowJourneyStep[];
};

export type OperatingSignalFlowLifecyclePhase = {
  id: string;
  label: string;
  detail: string;
  count: number;
  stateLabels: string[];
  status: Exclude<OperatingSignalFlowStageStatus, "blocked">;
};

export type OperatingSignalFlowLifecycleBranch = {
  id: string;
  label: string;
  detail: string;
  count: number;
  states: string[];
  blockers: string[];
  href: string;
  status: "blocked" | "review" | "learned";
};

export type OperatingSignalFlowFamilyEvolutionCell = {
  phaseId: string;
  phaseLabel: string;
  count: number;
  stateLabels: string[];
  blockers: string[];
  status: OperatingSignalFlowStageStatus;
};

export type OperatingSignalFlowFamilyEvolution = {
  id: string;
  label: string;
  count: number;
  sourceSummary: string;
  objectSummary: string;
  evidenceSummary: string;
  pressureLabel: string;
  cells: OperatingSignalFlowFamilyEvolutionCell[];
};

export type OperatingSignalFlowLifecycleGraph = {
  title: string;
  subtitle: string;
  autoLineLabel: string;
  autoLineDetail: string;
  evolutionTitle: string;
  evolutionDetail: string;
  businessItems: Array<{ label: string; value: string; detail: string }>;
  phases: OperatingSignalFlowLifecyclePhase[];
  branches: OperatingSignalFlowLifecycleBranch[];
  familyEvolution: OperatingSignalFlowFamilyEvolution[];
  coverage: Array<{ label: string; value: string; detail: string }>;
};

export type OperatingSignalFlowPostureHighlight = {
  dataPosture: Extract<OperatingSignalDataPosture, "empty" | "fixture" | "degraded">;
  label: string;
  title: string;
  detail: string;
  caseId: string;
  eventCount: number;
  animationPolicy: OperatingSignalFlowSnapshot["animationPolicy"];
  boundaryStatementVisible: boolean;
  fixtureBannerVisible: boolean;
};

export type OperatingSignalFlowDisplayModel = {
  headline: string;
  summary: string;
  postureLabel: string;
  windowLabel: string;
  boundary: string;
  dataPosture: OperatingSignalDataPosture;
  boundaryStatementVisible: boolean;
  fixtureBannerVisible: boolean;
  animationPolicy: OperatingSignalFlowSnapshot["animationPolicy"];
  fixtureBanner: string;
  stats: Array<{ label: string; value: number }>;
  aiPosture: Array<{ label: string; value: string }>;
  stages: OperatingSignalFlowDisplayStage[];
  journey: OperatingSignalFlowJourney;
  lifecycle: OperatingSignalFlowLifecycleGraph;
  postureHighlights: OperatingSignalFlowPostureHighlight[];
  pressureSignals: OperatingSignalFlowPressureSignal[];
  selectedPressure: {
    title: string;
    blocker: string;
    note: string;
    source: string;
    object: string;
    evidence: string;
    href: string;
  } | null;
};

const familyLabels = {
  commitment: { zh: "客户承诺", en: "Customer commitment" },
  advancement: { zh: "推进机会", en: "Advancing opportunity" },
  risk: { zh: "经营风险", en: "Operating risk" },
  pacing: { zh: "节奏变化", en: "Pacing change" },
  receipt: { zh: "客户回执", en: "Customer receipt" },
  evidence_gap: { zh: "证据缺口", en: "Evidence gap" },
  boundary_attempt: { zh: "谨慎动作", en: "Sensitive action" },
} as const;

const signalFamilyOrder = [
  "commitment",
  "evidence_gap",
  "pacing",
  "advancement",
  "risk",
  "boundary_attempt",
  "receipt",
] as const;

const customerAssetAliases: Record<string, { zh: string; en: string }> = {
  "Account:alias-e": { zh: "Beacon Retail", en: "Beacon Retail" },
  "Account:alias-n": { zh: "GreenPeak Health", en: "GreenPeak Health" },
  "Commitment:alias-a": {
    zh: "Nimbus 法务/交付时间表承诺",
    en: "Nimbus legal and delivery timeline commitment",
  },
  "Commitment:alias-l": {
    zh: "Nimbus 三方协同承诺",
    en: "Nimbus three-party coordination commitment",
  },
  "Contact:alias-i": { zh: "Ben Carter", en: "Ben Carter" },
  "Deal:alias-b": { zh: "Beacon 零售网络恢复单", en: "Beacon retail recovery deal" },
  "Deal:alias-d": { zh: "Aya Nakamura 候选人推进", en: "Aya Nakamura candidate progression" },
  "Deal:alias-h": { zh: "Beacon 零售网络恢复单", en: "Beacon retail recovery deal" },
  "Deal:alias-k": { zh: "Acme 年度经营动作控制台试点", en: "Acme annual operating console pilot" },
  "Meeting:alias-j": { zh: "GreenPeak 职位推进同步", en: "GreenPeak hiring sync" },
  "Workspace:demo": { zh: "客户承诺边界场景", en: "customer commitment boundary scene" },
  "capture:alias-f": {
    zh: "Acme 试点承诺型外发草稿",
    en: "Acme pilot commitment-sensitive send draft",
  },
  "capture:alias-g": { zh: "权限异常输入", en: "Permission-sensitive input" },
  "crm:alias-a": { zh: "Nimbus 实施与法务联动项目", en: "Nimbus implementation and legal coordination" },
  "crm:alias-d": { zh: "GreenPeak 职位推进 CRM", en: "GreenPeak recruiting CRM" },
  "crm:alias-h": { zh: "Beacon 试点恢复 CRM", en: "Beacon pilot recovery CRM" },
  "crm:alias-i": { zh: "Ben Carter 候选人推进", en: "Ben Carter candidate progression" },
  "crm:alias-i-new": { zh: "Ben Carter 最新候选人信号", en: "Ben Carter latest candidate signal" },
  "crm:alias-k": { zh: "Acme 试点推进记录", en: "Acme pilot advancement record" },
  "crm:alias-k-canonical": { zh: "Acme canonical 推进信号", en: "Acme canonical advancement signal" },
  "crm:alias-n": { zh: "GreenPeak 账号权限复核", en: "GreenPeak account permission review" },
  "decision:alias-a": { zh: "Nimbus 三方同步已拍板", en: "Nimbus three-party sync decision" },
  "dingtalk:alias-c": { zh: "钉钉客户群连接健康度", en: "DingTalk customer group health" },
  "dingtalk:alias-c:health": { zh: "钉钉连接恢复信号", en: "DingTalk connection recovery signal" },
  "email:alias-b": { zh: "Beacon pilot rescue 邮件", en: "Beacon pilot rescue email" },
  "email:alias-j": { zh: "GreenPeak 面试时间撤回邮件", en: "GreenPeak interview slot retraction email" },
  "email:alias-l": { zh: "Nimbus internal dependencies 邮件", en: "Nimbus internal dependencies email" },
  "email:alias-l-canonical": { zh: "Nimbus canonical 承诺邮件", en: "Nimbus canonical commitment email" },
  "fixture:alias-m": { zh: "未关联客户材料", en: "Unlinked customer material" },
  "fixture:alias-m-stale": { zh: "过期客户来源", en: "Stale customer source" },
  "learning:alias-a": { zh: "Nimbus 协同打法记忆", en: "Nimbus coordination memory" },
  "meeting:alias-a": { zh: "Nimbus 安全评审同步会", en: "Nimbus security review sync" },
  "meeting:alias-d": { zh: "GreenPeak 职位推进同步", en: "GreenPeak hiring sync" },
  "report:alias-e": { zh: "Beacon 预算审批风险报告", en: "Beacon budget approval risk report" },
  "owner-note:alias-a": { zh: "Zack / Samuel 三方时间表", en: "Zack / Samuel coordination timeline" },
  "receipt:alias-a": { zh: "Nimbus 时间表回执", en: "Nimbus timeline receipt" },
  "review-packet:alias-a": { zh: "Nimbus 三方同步复核包", en: "Nimbus three-party review packet" },
  "reviewer-note:alias-d": { zh: "Aya 终面 owner 确认", en: "Aya final interview owner confirmation" },
};

const blockerLabels: Record<string, { zh: string; en: string }> = {
  source_down: { zh: "来源暂不可用", en: "Source unavailable" },
  stale_source: { zh: "来源已过期", en: "Stale source" },
  missing_evidence: { zh: "证据缺口", en: "Missing evidence" },
  missing_owner: { zh: "缺跟进人", en: "Missing follow-up owner" },
  object_unlinked: { zh: "客户未关联", en: "Customer unlinked" },
  conflict_detected: { zh: "事实冲突", en: "Conflict detected" },
  permission_blocked: { zh: "权限不足", en: "Permission blocked" },
  boundary_blocked: { zh: "外部动作需拍板", en: "Sensitive action needs human call" },
  review_backlog: { zh: "待复核排队", en: "Review backlog" },
  outcome_missing: { zh: "缺客户回执", en: "Customer receipt missing" },
};

const sourceKindLabels: Record<string, { zh: string; en: string }> = {
  crm: { zh: "CRM", en: "CRM" },
  email: { zh: "邮件", en: "Email" },
  meeting: { zh: "会议", en: "Meeting" },
  dingtalk: { zh: "钉钉", en: "DingTalk" },
  document: { zh: "文档", en: "Document" },
  ask_helm: { zh: "Ask Helm", en: "Ask Helm" },
  internal_capture: { zh: "内部采集", en: "Internal capture" },
  report_skill: { zh: "报告技能", en: "Report skill" },
};

const objectKindLabels: Record<
  NonNullable<OperatingSignalFlowEvent["objectKind"]>,
  { zh: string; en: string }
> = {
  Account: { zh: "客户", en: "Account" },
  Commitment: { zh: "承诺", en: "Commitment" },
  Contact: { zh: "联系人", en: "Contact" },
  Deal: { zh: "机会", en: "Deal" },
  Meeting: { zh: "会议", en: "Meeting" },
  Workspace: { zh: "工作区", en: "Workspace" },
};

const stateLabels: Record<string, { zh: string; en: string }> = {
  AWAITING_RECEIPT: { zh: "等客户/团队回执", en: "Awaiting customer or team receipt" },
  BOUNDARY_BLOCKED: { zh: "高风险动作停住", en: "Sensitive action stopped" },
  CONTRADICTION_REVIEW: { zh: "事实冲突待核", en: "Conflicting facts need review" },
  DETECTED: { zh: "客户信息进入", en: "Customer information entered" },
  DUPLICATE_COMPRESSED: { zh: "重复信息合并", en: "Duplicate information combined" },
  GATED: { zh: "确认可跟进", en: "Confirmed for follow-up" },
  HUMAN_DECIDED: { zh: "人已拍板", en: "Human decision recorded" },
  JUDGED: { zh: "形成推进判断", en: "Judgement formed" },
  LEARNING_CANDIDATE: { zh: "沉淀跟进经验", en: "Follow-up memory candidate" },
  LINKED: { zh: "关联客户/机会", en: "Customer or opportunity linked" },
  MERGED: { zh: "并入既有线索", en: "Merged into existing lead" },
  MISSING_EVIDENCE: { zh: "缺关键证据", en: "Missing key evidence" },
  MISSING_OWNER: { zh: "缺跟进人", en: "Missing follow-up owner" },
  NORMALIZED: { zh: "转成业务摘要", en: "Turned into business summary" },
  OUTCOME_MISSING: { zh: "缺客户回执", en: "Customer receipt missing" },
  OUTCOME_RECORDED: { zh: "回执已入账", en: "Receipt recorded" },
  PACKETIZED: { zh: "整理复核材料", en: "Review packet prepared" },
  PERMISSION_BLOCKED: { zh: "权限不足", en: "Permission missing" },
  QUARANTINED: { zh: "隔离待确认", en: "Isolated for confirmation" },
  REJECTED: { zh: "不进入跟进", en: "Removed from follow-up" },
  REVIEW_PENDING: { zh: "等人拍板", en: "Waiting for human call" },
  REVOKED: { zh: "已撤回", en: "Revoked" },
  STALE_SIGNAL: { zh: "信息过期", en: "Stale information" },
  SUPERSEDED: { zh: "被新信息替代", en: "Superseded by new information" },
  UNRESOLVED_SOURCE: { zh: "来源未解析", en: "Unresolved source" },
};

const nextActionLabels: Record<string, { zh: string; en: string }> = {
  "/approvals": { zh: "打开复核路径", en: "Open review path" },
  "/capture": { zh: "回到来源采集", en: "Open capture source" },
  "/memory": { zh: "查看经营记忆", en: "Open memory" },
  "/settings": { zh: "修复来源设置", en: "Fix source settings" },
};

const lifecyclePhaseDefinitions = [
  {
    id: "capture",
    zh: "客户信息进来",
    en: "Customer information",
    zhDetail: "会议、邮件、钉钉、CRM 只读进入，不外发、不写回。",
    enDetail: "Meetings, email, DingTalk and CRM enter read-only, without send or writeback.",
    states: ["DETECTED", "NORMALIZED", "DUPLICATE_COMPRESSED", "MERGED"],
    status: "flowing",
  },
  {
    id: "object-evidence",
    zh: "客户/机会对齐",
    en: "Customer and deal linked",
    zhDetail: "把信号挂到客户、机会、承诺或工作区，并检查证据覆盖。",
    enDetail: "Attach the signal to account, deal, commitment or workspace and check evidence coverage.",
    states: ["LINKED", "UNRESOLVED_SOURCE", "MISSING_EVIDENCE", "MISSING_OWNER", "STALE_SIGNAL"],
    status: "flowing",
  },
  {
    id: "judgement-gate",
    zh: "经营判断成型",
    en: "Operating judgement",
    zhDetail: "规则给出推进判断和复核材料，但不替用户承诺。",
    enDetail: "Rules produce the judgement and review packet, but do not commit for the user.",
    states: ["GATED", "JUDGED", "PACKETIZED", "CONTRADICTION_REVIEW"],
    status: "flowing",
  },
  {
    id: "human-boundary",
    zh: "需要人拍板",
    en: "Human call needed",
    zhDetail: "需要人拍板的内容进入复核，边界敏感动作停住。",
    enDetail: "Items that need a human call enter review while boundary-sensitive actions stop.",
    states: ["REVIEW_PENDING", "HUMAN_DECIDED", "BOUNDARY_BLOCKED", "PERMISSION_BLOCKED", "REJECTED"],
    status: "review",
  },
  {
    id: "receipt",
    zh: "回执入账",
    en: "Receipt recorded",
    zhDetail: "人处理后的结果进入回执，不声明业务已经成功。",
    enDetail: "The human-handled result enters receipt without declaring business success.",
    states: ["AWAITING_RECEIPT", "OUTCOME_MISSING", "OUTCOME_RECORDED", "SUPERSEDED", "REVOKED"],
    status: "learned",
  },
  {
    id: "memory-learning",
    zh: "跟进经验沉淀",
    en: "Follow-up memory",
    zhDetail: "只沉淀候选，不自动改 canonical 记忆或规则。",
    enDetail: "Only candidates are created; canonical memory and rules are not changed automatically.",
    states: ["LEARNING_CANDIDATE", "QUARANTINED"],
    status: "learned",
  },
] as const;

const lifecycleBranchDefinitions = [
  {
    id: "source-permission",
    zh: "来源权限问题",
    en: "Source/permission",
    zhDetail: "连接器、来源过期或权限问题只暴露路径，不自动刷新凭据。",
    enDetail: "Connector, stale source or permission issues expose the path without credential refresh.",
    states: ["UNRESOLVED_SOURCE", "STALE_SIGNAL", "PERMISSION_BLOCKED", "QUARANTINED"],
    href: "/settings",
    status: "blocked",
  },
  {
    id: "evidence-object",
    zh: "客户材料缺口",
    en: "Evidence/object",
    zhDetail: "缺证据、缺 owner、对象未关联时进入人工补齐或复核。",
    enDetail: "Missing evidence, owner or object link enters human completion or review.",
    states: ["MISSING_EVIDENCE", "MISSING_OWNER"],
    href: "/approvals",
    status: "review",
  },
  {
    id: "review-boundary",
    zh: "需人判断",
    en: "Review/boundary",
    zhDetail: "冲突、边界承诺和复核积压只请求人判断，不执行外部动作。",
    enDetail: "Conflicts, commitment boundary and review backlog request a human call without external action.",
    states: ["CONTRADICTION_REVIEW", "REVIEW_PENDING", "BOUNDARY_BLOCKED", "REJECTED"],
    href: "/approvals",
    status: "blocked",
  },
  {
    id: "receipt-learning",
    zh: "回执复盘",
    en: "Receipt/learning",
    zhDetail: "记录回执、撤回、替代、合并和经验候选，继续保持只读边界。",
    enDetail: "Record receipt, revoke, supersede, merge and learning candidates while staying read-only.",
    states: ["AWAITING_RECEIPT", "OUTCOME_MISSING", "OUTCOME_RECORDED", "SUPERSEDED", "REVOKED", "MERGED", "DUPLICATE_COMPRESSED", "LEARNING_CANDIDATE"],
    href: "/memory",
    status: "learned",
  },
] as const;

const prototypeDisplayPosture: OperatingSignalDataPosture = "fixture";
const postureHighlightOrder = ["empty", "fixture", "degraded"] as const;

function localize(locale: UiLocale, value: { zh: string; en: string }) {
  return isEnglishLocale(locale) ? value.en : value.zh;
}

function formatSourceKinds(events: readonly OperatingSignalFlowEvent[], locale: UiLocale) {
  return unique(events.map((event) => event.sourceKind))
    .slice(0, 4)
    .map((sourceKind) =>
      localize(locale, sourceKindLabels[sourceKind] ?? { zh: sourceKind, en: sourceKind }),
    )
    .join(" / ");
}

function formatFamily(signalFamily: string, locale: UiLocale) {
  return localize(
    locale,
    familyLabels[signalFamily as keyof typeof familyLabels] ?? { zh: signalFamily, en: signalFamily },
  );
}

function formatObjectKind(
  objectKind: OperatingSignalFlowEvent["objectKind"],
  locale: UiLocale,
) {
  if (!objectKind) {
    return localize(locale, { zh: "待关联客户资产", en: "Unlinked customer asset" });
  }
  return localize(
    locale,
    objectKindLabels[objectKind] ?? { zh: objectKind, en: objectKind },
  );
}

function formatAliasReference(ref: string | null, fallback: string, locale: UiLocale) {
  if (!ref) return fallback;
  const customerAsset = customerAssetAliases[ref];
  if (customerAsset) return localize(locale, customerAsset);

  const alias = ref.match(/alias-([a-z0-9-]+)/iu)?.[1];
  if (alias) {
    const label = alias.length === 1 ? alias.toUpperCase() : alias;
    return isEnglishLocale(locale) ? `customer asset ${label}` : `客户资产 ${label}`;
  }

  const [, suffix] = ref.split(":");
  return suffix ? suffix.replaceAll("_", " ") : ref.replaceAll("_", " ");
}

function formatSourceRef(event: OperatingSignalFlowEvent, locale: UiLocale) {
  return formatAliasReference(event.sourceRef, event.sourceRef, locale);
}

function formatObjectRef(event: OperatingSignalFlowEvent, locale: UiLocale) {
  const objectKind = formatObjectKind(event.objectKind, locale);
  return formatAliasReference(event.objectRef, objectKind, locale);
}

function formatCustomerAssetForEvent(event: OperatingSignalFlowEvent, locale: UiLocale) {
  if (!event.objectRef || event.objectKind === "Workspace") {
    return formatSourceRef(event, locale);
  }
  return formatObjectRef(event, locale);
}

function formatEvidence(event: OperatingSignalFlowEvent, locale: UiLocale) {
  const evidence = `${event.evidenceCoverage.provided}/${event.evidenceCoverage.required}`;
  return isEnglishLocale(locale) ? `${evidence} evidence refs` : `证据 ${evidence}`;
}

function formatTrace(event: OperatingSignalFlowEvent, locale: UiLocale) {
  return event.traceId ?? (isEnglishLocale(locale) ? "trace not attached" : "暂无 trace");
}

function formatState(state: string | null, locale: UiLocale) {
  if (!state) return isEnglishLocale(locale) ? "Start" : "开始";
  return localize(
    locale,
    stateLabels[state] ?? { zh: state, en: state.replaceAll("_", " ") },
  );
}

function formatTransition(event: OperatingSignalFlowEvent, locale: UiLocale) {
  return `${formatState(event.transitionFrom, locale)} -> ${formatState(event.transitionTo, locale)}`;
}

function formatNextAction(href: string, locale: UiLocale) {
  return localize(locale, nextActionLabels[href] ?? { zh: "打开承接入口", en: "Open handoff" });
}

function formatTimeLabel(occurredAt: string) {
  const time = occurredAt.match(/T(\d{2}:\d{2})/u)?.[1];
  return time ?? occurredAt;
}

function statusForEvent(event: OperatingSignalFlowEvent): OperatingSignalFlowStageStatus {
  if (event.currentBlockerType || event.boundaryCheckResult === "blocked") return "blocked";
  if (event.reviewerRequired || /REVIEW|HUMAN_DECIDED/u.test(event.transitionTo)) return "review";
  if (/OUTCOME|LEARNING/u.test(event.transitionTo)) return "learned";
  return "flowing";
}

function formatBlocker(blocker: string | null, locale: UiLocale) {
  if (!blocker) return localize(locale, { zh: "无阻塞", en: "No blocker" });
  return localize(locale, blockerLabels[blocker] ?? { zh: blocker, en: blocker });
}

function formatPosture(dataPosture: OperatingSignalDataPosture, locale: UiLocale) {
  const labels: Record<OperatingSignalDataPosture, { zh: string; en: string }> = {
    empty: { zh: "空状态", en: "empty state" },
    fixture: { zh: "脱敏客户资产", en: "redacted customer assets" },
    degraded: { zh: "来源降级", en: "degraded source" },
    current_window: { zh: "当前窗口", en: "current window" },
  };
  return localize(locale, labels[dataPosture]);
}

function buildPostureHighlights(
  fixturePack: OperatingSignalFlowFixturePack,
  locale: UiLocale,
): OperatingSignalFlowPostureHighlight[] {
  const english = isEnglishLocale(locale);
  const copy: Record<(typeof postureHighlightOrder)[number], { zh: string; enTitle: string; enDetail: string }> = {
    empty: {
      zh: "还没有经营信号进入当前窗口，首屏保持空态且继续显示边界。",
      enTitle: "No operating signals have entered the current window",
      enDetail: "The first screen stays empty while the review boundary remains visible.",
    },
    fixture: {
      zh: "示例: 离线 fixture 只用于观察图形和阻塞表达，不代表真实工作区。",
      enTitle: "Example fixture data is driving this prototype",
      enDetail: "The map is offline-only and does not represent a live workspace.",
    },
    degraded: {
      zh: "来源降级时只显示受影响路径，不自动刷新凭据或同步连接器。",
      enTitle: "A degraded source marks affected paths as static",
      enDetail: "Helm shows the affected connector path without refreshing credentials or syncing.",
    },
  };

  return postureHighlightOrder.map((dataPosture) => {
    const fixtureCase = findRequiredPostureCase(fixturePack, dataPosture);
    const snapshot = fixtureCase.snapshot;
    return {
      dataPosture,
      label: formatPosture(dataPosture, locale),
      title: english ? copy[dataPosture].enTitle : snapshot.judgementHeadline,
      detail: english ? copy[dataPosture].enDetail : copy[dataPosture].zh,
      caseId: fixtureCase.id,
      eventCount: snapshot.events.length,
      animationPolicy: snapshot.animationPolicy,
      boundaryStatementVisible: snapshot.boundaryStatementVisible,
      fixtureBannerVisible: snapshot.fixtureBannerVisible,
    };
  });
}

function buildJourney(
  fixtureCase: ReturnType<typeof findRequiredEntryPointCase>,
  locale: UiLocale,
): OperatingSignalFlowJourney {
  const orderedEvents = [...fixtureCase.snapshot.events].sort(
    (first, second) =>
      String(first.occurredAt).localeCompare(String(second.occurredAt)) ||
      first.id.localeCompare(second.id),
  );
  const firstEvent = orderedEvents[0];
  const lastEvent = orderedEvents[orderedEvents.length - 1] ?? firstEvent;
  if (!firstEvent || !lastEvent) {
    throw new Error(`Operating signal flow journey has no events: ${fixtureCase.id}`);
  }

  const finalHref = firstAllowedHref(lastEvent);

  return {
    caseId: fixtureCase.id,
    title: formatObjectRef(firstEvent, locale),
    subtitle: isEnglishLocale(locale)
      ? `From ${formatSourceRef(firstEvent, locale)} to ${formatState(lastEvent.transitionTo, locale)} without send/write authority.`
      : `从 ${formatSourceRef(firstEvent, locale)} 进入 ${formatState(lastEvent.transitionTo, locale)}，全程不外发、不写回。`,
    signalKey: firstEvent.signalKey,
    traceId: formatTrace(firstEvent, locale),
    summaryItems: [
      {
        label: isEnglishLocale(locale) ? "Customer material" : "客户材料",
        value: formatSourceRef(firstEvent, locale),
        detail: firstEvent.evidenceRefs.join(" / "),
      },
      {
        label: isEnglishLocale(locale) ? "Customer/deal" : "客户/机会",
        value: formatObjectRef(firstEvent, locale),
        detail: firstEvent.objectRef ?? (isEnglishLocale(locale) ? "candidate link" : "候选关联"),
      },
      {
        label: isEnglishLocale(locale) ? "Operating signal" : "经营信号",
        value: formatFamily(firstEvent.signalFamily, locale),
        detail: firstEvent.signalKey,
      },
      {
        label: isEnglishLocale(locale) ? "Next stop" : "下一步",
        value: formatNextAction(finalHref, locale),
        detail: `${formatEvidence(lastEvent, locale)} · ${formatState(lastEvent.transitionTo, locale)}`,
      },
    ],
    steps: orderedEvents.map((event, index) => {
      const href = firstAllowedHref(event);
      return {
        id: event.id,
        index: index + 1,
        timeLabel: formatTimeLabel(event.occurredAt),
        title: formatState(event.transitionTo, locale),
        detail: event.boundaryNote,
        transition: formatTransition(event, locale),
        source: formatSourceRef(event, locale),
        object: formatObjectRef(event, locale),
        evidence: formatEvidence(event, locale),
        trace: formatTrace(event, locale),
        nextActionLabel: formatNextAction(href, locale),
        href,
        blocker: event.currentBlockerType
          ? formatBlocker(event.currentBlockerType, locale)
          : null,
        status: statusForEvent(event),
      };
    }),
  };
}

function statusForFamilyEvolutionCell(
  events: readonly OperatingSignalFlowEvent[],
  fallback: Exclude<OperatingSignalFlowStageStatus, "blocked">,
): OperatingSignalFlowStageStatus {
  if (
    events.some(
      (event) => event.currentBlockerType || event.boundaryCheckResult === "blocked",
    )
  ) {
    return "blocked";
  }
  if (
    events.some(
      (event) => event.reviewerRequired || event.boundaryCheckResult === "escalated",
    )
  ) {
    return "review";
  }
  return fallback;
}

function formatCompactList(values: readonly string[], locale: UiLocale) {
  const items = unique(values.filter(Boolean)).slice(0, 3);
  if (items.length === 0) {
    return isEnglishLocale(locale) ? "none" : "无";
  }
  return items.join(" / ");
}

function buildFamilyEvolution(
  family: (typeof signalFamilyOrder)[number],
  events: readonly OperatingSignalFlowEvent[],
  phases: readonly OperatingSignalFlowLifecyclePhase[],
  locale: UiLocale,
): OperatingSignalFlowFamilyEvolution {
  const familyEvents = events.filter((event) => event.signalFamily === family);
  const providedEvidence = familyEvents.reduce((sum, event) => sum + event.evidenceCoverage.provided, 0);
  const requiredEvidence = familyEvents.reduce((sum, event) => sum + event.evidenceCoverage.required, 0);
  const blockerLabelsForFamily = unique(
    familyEvents.flatMap((event) =>
      event.currentBlockerType ? [formatBlocker(event.currentBlockerType, locale)] : [],
    ),
  );

  return {
    id: family,
    label: formatFamily(family, locale),
    count: familyEvents.length,
    sourceSummary: formatCompactList(
      familyEvents.map((event) => formatSourceRef(event, locale)),
      locale,
    ),
    objectSummary: formatCompactList(
      familyEvents.map((event) => formatCustomerAssetForEvent(event, locale)),
      locale,
    ),
    evidenceSummary: isEnglishLocale(locale)
      ? `${providedEvidence}/${requiredEvidence} evidence`
      : `证据 ${providedEvidence}/${requiredEvidence}`,
    pressureLabel: blockerLabelsForFamily.length
      ? blockerLabelsForFamily.slice(0, 2).join(" / ")
      : localize(locale, { zh: "正常流转", en: "Flowing" }),
    cells: phases.map((phase) => {
      const phaseEvents = familyEvents.filter((event) =>
        phase.stateLabels.some(
          (stateLabel) => stateLabel === formatState(event.transitionTo, locale),
        ),
      );
      const blockers = unique(
        phaseEvents.flatMap((event) =>
          event.currentBlockerType ? [formatBlocker(event.currentBlockerType, locale)] : [],
        ),
      );
      return {
        phaseId: phase.id,
        phaseLabel: phase.label,
        count: phaseEvents.length,
        stateLabels: unique(phaseEvents.map((event) => formatState(event.transitionTo, locale))),
        blockers,
        status: statusForFamilyEvolutionCell(phaseEvents, phase.status),
      };
    }),
  };
}

function buildLifecycleGraph(
  fixturePack: OperatingSignalFlowFixturePack,
  locale: UiLocale,
): OperatingSignalFlowLifecycleGraph {
  const events = allEvents(fixturePack);
  const sourceKinds = unique(events.map((event) => event.sourceKind));
  const objectKinds = unique(events.flatMap((event) => (event.objectKind ? [event.objectKind] : [])));
  const signalFamilies = unique(events.map((event) => event.signalFamily));
  const coveredStates = unique(events.map((event) => event.transitionTo));
  const lifecycleStateCount = Object.keys(stateLabels).length;
  const blockerTypes = unique(events.flatMap((event) => (event.currentBlockerType ? [event.currentBlockerType] : [])));
  const providedEvidence = events.reduce((sum, event) => sum + event.evidenceCoverage.provided, 0);
  const requiredEvidence = events.reduce((sum, event) => sum + event.evidenceCoverage.required, 0);
  const evidencePercent = requiredEvidence
    ? Math.round((providedEvidence / requiredEvidence) * 100)
    : 0;
  const externalAuthorityLeaks = events.filter(
    (event) => event.forbiddenNextActions.length === 0 || event.crossTenantProjection,
  ).length;
  const phases = lifecyclePhaseDefinitions.map((phase) => {
    const phaseEvents = events.filter((event) =>
      (phase.states as readonly string[]).includes(event.transitionTo),
    );
    return {
      id: phase.id,
      label: localize(locale, { zh: phase.zh, en: phase.en }),
      detail: localize(locale, { zh: phase.zhDetail, en: phase.enDetail }),
      count: phaseEvents.length,
      stateLabels: phase.states.map((state) => formatState(state, locale)),
      status: phase.status,
    };
  });
  const branches = lifecycleBranchDefinitions.map((branch) => {
    const branchEvents = events.filter((event) =>
      (branch.states as readonly string[]).includes(event.transitionTo),
    );
    const branchBlockers = unique(
      branchEvents.flatMap((event) => (event.currentBlockerType ? [event.currentBlockerType] : [])),
    );
    return {
      id: branch.id,
      label: localize(locale, { zh: branch.zh, en: branch.en }),
      detail: localize(locale, { zh: branch.zhDetail, en: branch.enDetail }),
      count: branchEvents.length,
      states: branch.states.map((state) => formatState(state, locale)),
      blockers: branchBlockers.length
        ? branchBlockers.map((blocker) => formatBlocker(blocker, locale))
        : [localize(locale, { zh: "无当前阻塞", en: "No current blocker" })],
      href: branch.href,
      status: branch.status,
    };
  });
  const familyEvolution = signalFamilyOrder
    .filter((family) => events.some((event) => event.signalFamily === family))
    .map((family) => buildFamilyEvolution(family, events, phases, locale));

  return {
    title: isEnglishLocale(locale)
      ? "Customer business asset flow"
      : "客户经营资产全链路图",
    subtitle: isEnglishLocale(locale)
      ? "Each row uses the customer's own projects, contacts, meetings, commitments and receipts, then shows where those assets are moving or stuck."
      : "每一行都用客户自己的项目、联系人、会议、承诺和回执来呈现，再看这些资产走到哪、卡在哪。",
    autoLineLabel: isEnglishLocale(locale) ? "Customer operating process" : "客户经营过程",
    autoLineDetail: isEnglishLocale(locale)
      ? "Helm reads, normalizes, links, gates and prepares packets on this spine. It does not send, approve, write back or promise outcomes."
      : "Helm 在这条线上完成读取、整理、关联、信号门和材料准备；不外发、不审批、不写回、不承诺结果。",
    evolutionTitle: isEnglishLocale(locale) ? "Customer assets by signal type" : "按信号类型看客户资产",
    evolutionDetail: isEnglishLocale(locale)
      ? "Commitments, evidence gaps, pacing, advancement, risk, boundary attempts and receipts are separated by customer asset, not by product vocabulary."
      : "把承诺、证据缺口、节奏、推进、风险、外部尝试和回执拆开，每行都落到客户业务资产。",
    businessItems: [
      {
        label: isEnglishLocale(locale) ? "Customer information" : "客户信息",
        value: formatSourceKinds(events, locale),
        detail: isEnglishLocale(locale)
          ? `${events.length} business events from ${sourceKinds.length} source types`
          : `${events.length} 个业务节点，来自 ${sourceKinds.length} 类来源`,
      },
      {
        label: isEnglishLocale(locale) ? "Customer assets" : "客户资产",
        value: objectKinds.map((item) => formatObjectKind(item, locale)).join(" / "),
        detail: isEnglishLocale(locale)
          ? `${objectKinds.length} object kinds, including unlinked branches`
          : `${objectKinds.length} 类对象，并保留未关联分支`,
      },
      {
        label: isEnglishLocale(locale) ? "Operating signal types" : "经营信号类型",
        value: signalFamilies.map((item) => formatFamily(item, locale)).join(" / "),
        detail: isEnglishLocale(locale)
          ? "Judgement stays deterministic and review-first"
          : "判断保持确定性规则优先，并先进入复核",
      },
      {
        label: isEnglishLocale(locale) ? "Evidence coverage" : "证据覆盖",
        value: `${evidencePercent}%`,
        detail: isEnglishLocale(locale)
          ? `${providedEvidence}/${requiredEvidence} evidence references in the fixture`
          : `${providedEvidence}/${requiredEvidence} 份证据引用`,
      },
    ],
    phases,
    branches,
    familyEvolution,
    coverage: [
      {
        label: isEnglishLocale(locale) ? "Business path" : "经营链路",
        value: `${coveredStates.length}/${lifecycleStateCount}`,
        detail: isEnglishLocale(locale)
          ? "Covered by the current redacted customer asset set"
          : "由当前脱敏客户资产覆盖",
      },
      {
        label: isEnglishLocale(locale) ? "Open issues" : "待处理点",
        value: `${blockerTypes.length}/${Object.keys(blockerLabels).length}`,
        detail: isEnglishLocale(locale)
          ? "Source, evidence, owner, permission, boundary and receipt blockers are visible"
          : "来源、证据、Owner、权限、边界和回执阻塞都可见",
      },
      {
        label: isEnglishLocale(locale) ? "External authority" : "外部动作",
        value: String(externalAuthorityLeaks),
        detail: isEnglishLocale(locale)
          ? "No send, approval, writeback or cross-workspace authority"
          : "没有外发、审批、写回或跨客户权限",
      },
    ],
  };
}

export function buildOperatingSignalFlowDisplayModel(
  fixturePack: OperatingSignalFlowFixturePack,
  locale: UiLocale,
): OperatingSignalFlowDisplayModel {
  const t = (zh: string, en: string) => localize(locale, { zh, en });
  // Phase 2.1 is allowed to flatten the checked-in fixture pack only.
  // Runtime adoption must project one workspace snapshot at a time.
  const events = allEvents(fixturePack);
  const prototypeSnapshot = findRequiredPostureCase(
    fixturePack,
    prototypeDisplayPosture,
  ).snapshot;
  const happyPathCase = findRequiredEntryPointCase(
    fixturePack,
    "happyPathCaseId",
  );
  const happyPathEvents = happyPathCase.snapshot.events;
  const blockedEvents = events.filter((event) => event.currentBlockerType);
  const pressureEvents = sortByPressure(blockedEvents).slice(0, 4);
  const selectedPressureEvent = pressureEvents[0] ?? null;
  const boundaryReviewCount = events.filter((event) => event.boundaryCheckResult === "blocked").length;
  const reviewRequiredCount = events.filter((event) => event.reviewerRequired).length;
  const signalFamilies = unique(events.map((event) => event.signalFamily));
  const sourceKinds = unique(events.map((event) => event.sourceKind));
  const objectKinds = unique(events.flatMap((event) => (event.objectKind ? [event.objectKind] : [])));

  const stages: OperatingSignalFlowDisplayStage[] = [
    {
      id: "source",
      label: t("客户来源", "Customer source"),
      value: String(sourceKinds.length),
      detail: formatSourceKinds(events, locale),
      status: "flowing",
    },
    {
      id: "collector",
      label: t("客户材料", "Customer material"),
      value: String(events.length),
      detail: t("脱敏经营事件", "redacted operating events"),
      status: "flowing",
    },
    {
      id: "gate",
      label: t("可跟进判断", "Follow-up check"),
      value: String(blockedEvents.length),
      detail: t("卡住或放慢", "stuck or slowed"),
      status: "blocked",
    },
    {
      id: "object",
      label: t("客户/机会", "Customer/deal"),
      value: String(objectKinds.length),
      detail: t("经营资产", "business assets"),
      status: "review",
    },
    {
      id: "judgement",
      label: t("经营判断", "Operating judgement"),
      value: String(signalFamilies.length),
      detail: t("信号类型", "signal types"),
      status: "flowing",
    },
    {
      id: "review",
      label: t("人来拍板", "Human call"),
      value: String(reviewRequiredCount),
      detail: t("需要人拍板", "needs human call"),
      status: "review",
    },
    {
      id: "learning",
      label: t("回执记忆", "Receipt memory"),
      value: String(happyPathEvents.length),
      detail: t("可追踪节点", "traceable nodes"),
      status: "learned",
    },
  ];

  const pressureSignals: OperatingSignalFlowPressureSignal[] = pressureEvents.map((event) => ({
    id: event.id,
    label: `${formatCustomerAssetForEvent(event, locale)} · ${formatFamily(event.signalFamily, locale)}`,
    detail: event.boundaryNote,
    blocker: formatBlocker(event.currentBlockerType, locale),
    source: formatSourceRef(event, locale),
    object: formatObjectRef(event, locale),
    evidence: formatEvidence(event, locale),
    href: firstAllowedHref(event),
    status: event.boundaryCheckResult === "blocked" ? "blocked" : "review",
  }));

  return {
    headline: t(
      "客户经营信号资产图",
      "Customer operating signal asset map",
    ),
    summary: t(
      "把 Nimbus、Beacon、GreenPeak、Aya、Ben 等客户业务资产接成经营信号图；人工确认点单独露出。",
      "Nimbus, Beacon, GreenPeak, Aya and Ben business assets are connected into the operating signal map; human confirmation points stay visible.",
    ),
    postureLabel: formatPosture(prototypeSnapshot.dataPosture, locale),
    windowLabel: t("当前跟进窗口", "Current follow-up window"),
    boundary: t(
      "只读 fixture 投影。这里没有 API、schema、真实查询、连接器动作、正式写入、外发或审批权限。",
      "Read-only fixture projection. No API, schema, runtime query, connector action, official write, send or approval authority is active here.",
    ),
    dataPosture: prototypeSnapshot.dataPosture,
    boundaryStatementVisible: prototypeSnapshot.boundaryStatementVisible,
    fixtureBannerVisible: prototypeSnapshot.fixtureBannerVisible,
    animationPolicy: prototypeSnapshot.animationPolicy,
    fixtureBanner: t(
      "示例: 当前图形由离线 fixture 驱动，只用于观察经营信号流向和阻塞表达。",
      "Example: this map is driven by offline fixture data to show signal direction and blockage posture.",
    ),
    stats: [
      { label: t("客户资产", "assets"), value: fixturePack.cases.length },
      { label: t("信号类型", "signal types"), value: signalFamilies.length },
      { label: t("待处理", "open issues"), value: unique(blockedEvents.map((event) => event.currentBlockerType)).length },
      { label: t("需拍板", "human calls"), value: boundaryReviewCount },
    ],
    aiPosture: [
      { label: t("规则判断", "rule judgement"), value: "100%" },
      { label: t("AI 排序权", "AI ranking authority"), value: "0" },
      { label: t("跨客户动作", "cross-customer action"), value: "0" },
    ],
    stages,
    journey: buildJourney(happyPathCase, locale),
    lifecycle: buildLifecycleGraph(fixturePack, locale),
    postureHighlights: buildPostureHighlights(fixturePack, locale),
    pressureSignals,
    selectedPressure: selectedPressureEvent
      ? {
          title: `${formatCustomerAssetForEvent(selectedPressureEvent, locale)} · ${formatFamily(selectedPressureEvent.signalFamily, locale)}`,
          blocker: formatBlocker(selectedPressureEvent.currentBlockerType, locale),
          note: selectedPressureEvent.boundaryNote,
          source: formatSourceRef(selectedPressureEvent, locale),
          object: formatObjectRef(selectedPressureEvent, locale),
          evidence: formatEvidence(selectedPressureEvent, locale),
          href: firstAllowedHref(selectedPressureEvent),
        }
      : null,
  };
}

export function selectHighestPressurePath(snapshot: OperatingSignalFlowSnapshot): string | null {
  const boundaryIncident = earliestEvent(
    snapshot.events.filter((item) => item.boundaryCheckResult === "blocked"),
    "occurredAt",
  );
  if (boundaryIncident) return boundaryIncident.signalKey;

  const blocked = earliestEvent(
    snapshot.events.filter((item) => item.currentBlockerType && item.blockerSince),
    "blockerSince",
  );
  if (blocked) return blocked.signalKey;

  const reviewRequired = earliestEvent(
    snapshot.events.filter((item) => item.reviewerRequired && item.actorRef),
    "occurredAt",
  );
  if (reviewRequired) return reviewRequired.signalKey;

  return latestEvent(snapshot.events)?.signalKey ?? null;
}

function allEvents(pack: OperatingSignalFlowFixturePack) {
  return pack.cases.flatMap((item) => item.snapshot.events);
}

function findCase(pack: OperatingSignalFlowFixturePack, id: string) {
  return pack.cases.find((item) => item.id === id);
}

function findRequiredPostureCase(
  pack: OperatingSignalFlowFixturePack,
  dataPosture: OperatingSignalDataPosture,
) {
  const postureCase = pack.cases.find((item) => item.snapshot.dataPosture === dataPosture);
  if (!postureCase) {
    throw new Error(`Operating signal flow fixture posture missing: ${dataPosture}`);
  }
  return postureCase;
}

function findRequiredEntryPointCase(
  pack: OperatingSignalFlowFixturePack,
  entryPoint: keyof OperatingSignalFlowFixturePack["entryPoints"],
) {
  const caseId = pack.entryPoints[entryPoint];
  const entryPointCase = findCase(pack, caseId);
  if (!entryPointCase) {
    throw new Error(`Operating signal flow fixture entry point missing: ${entryPoint}:${caseId}`);
  }
  return entryPointCase;
}

function sortByPressure(events: readonly OperatingSignalFlowEvent[]) {
  return [...events].sort((first, second) => {
    const firstBoundary = first.boundaryCheckResult === "blocked" ? 0 : 1;
    const secondBoundary = second.boundaryCheckResult === "blocked" ? 0 : 1;
    return (
      firstBoundary - secondBoundary ||
      String(first.blockerSince ?? first.occurredAt).localeCompare(String(second.blockerSince ?? second.occurredAt)) ||
      first.signalKey.localeCompare(second.signalKey) ||
      first.id.localeCompare(second.id)
    );
  });
}

function firstAllowedHref(event: OperatingSignalFlowEvent) {
  return event.allowedNextActions.find((href) => OPERATING_SIGNAL_ALLOWED_NEXT_ACTION_SET.has(href)) ?? "/approvals";
}

function earliestEvent<K extends keyof OperatingSignalFlowEvent>(
  events: OperatingSignalFlowEvent[],
  field: K,
) {
  return [...events]
    .filter((event) => event[field])
    .sort((first, second) =>
      String(first[field]).localeCompare(String(second[field])) ||
      first.signalKey.localeCompare(second.signalKey) ||
      first.id.localeCompare(second.id),
    )[0];
}

function latestEvent(events: OperatingSignalFlowEvent[]) {
  return [...events].sort(
    (first, second) =>
      String(second.occurredAt).localeCompare(String(first.occurredAt)) ||
      first.signalKey.localeCompare(second.signalKey) ||
      first.id.localeCompare(second.id),
  )[0];
}

function unique<T>(items: readonly T[]) {
  return Array.from(new Set(items));
}
