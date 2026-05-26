import type { AccessState, WorkspaceRole } from "@prisma/client";
import type { UiLocale } from "@/lib/i18n/config";
import { getLocalizedRoleLabels } from "@/lib/i18n/labels";
import type {
  UnifiedDetailNavigationModel,
  UnifiedDetailNodeType,
} from "@/lib/presentation/unified-detail-navigation";
import { safeParseJson, trimText } from "@/lib/utils";

export type OperatingFoundationItem = {
  label: string;
  value: string;
};

export type OperatingFoundationConnection = {
  label: string;
  value: string;
  description: string;
  href?: string;
};

export type OperatingFoundationSummary = {
  label: string;
  title: string;
  summary: string;
  items: OperatingFoundationItem[];
  connections: OperatingFoundationConnection[];
  note: string;
};

type WorkspaceOperatingFoundationInput = {
  locale: UiLocale;
  workspaceName: string;
  membershipRole: WorkspaceRole;
  accessState: AccessState;
  profileType?: string | null;
  focusAreasJson?: string | null;
  topJudgements?: string[];
  topPriorityHref?: string;
  currentPage: "dashboard" | "settings" | "operating";
};

type DetailOperatingFoundationInput = {
  english: boolean;
  navigation: UnifiedDetailNavigationModel;
};

export function buildWorkspaceOperatingFoundationSummary(
  input: WorkspaceOperatingFoundationInput,
): OperatingFoundationSummary {
  const english = input.locale === "en-US";
  const focusAreas = safeParseJson<string[]>(input.focusAreasJson, []).filter(
    Boolean,
  );
  const roleLabels = getLocalizedRoleLabels(input.locale);
  const roleLabel = roleLabels[input.membershipRole] ?? input.membershipRole;
  const roleAudienceScene = resolveWorkspaceScene(input.profileType, english);
  const externalAudienceLine = resolveExternalAudienceLine(focusAreas, english);
  const campaignLine = buildWorkspaceCampaignLine({
    english,
    focusAreas,
    topJudgements: input.topJudgements ?? [],
  });
  const lifecycleLine = buildLifecycleLine(input.accessState, english);
  const goalEntryHref =
    input.topPriorityHref ??
    (input.currentPage === "settings"
      ? "/dashboard"
      : input.currentPage === "operating"
        ? "/operating"
        : "/opportunities");

  return {
    label: english ? "Operating foundation" : "组织经营基线",
    title: english
      ? `${input.workspaceName} runs through one operating charter`
      : `${input.workspaceName} 当前按同一套经营基线在工作`,
    summary: english
      ? "This operating view should explain who it is serving, what it must remember, and which campaign it is protecting before any recommendation leaves judgement."
      : "这个经营视图必须先解释它当前在为谁服务、它记住了什么、以及它正在守哪条经营主线，然后建议才能离开判断层。",
    items: [
      {
        label: english ? "Constitution" : "工作区边界",
        value: english
          ? `Workspace-first, membership-backed and controlled-trial. Recommendation stays separate from commitment; review-before-send, non-commitment and narrow lifecycle guard stay explicit. ${lifecycleLine}`
          : `工作区优先、成员身份支撑、受控试点。建议不等于承诺；发送前复核、非承诺表达和窄生命周期守卫必须显式可见。${lifecycleLine}`,
      },
      {
        label: english ? "Role / audience" : "角色与对象",
        value: english
          ? `${roleLabel} is the current default decision owner. This operating view is primarily serving ${roleAudienceScene}, and external language still separates customer / prospect / partner boundaries. ${externalAudienceLine}`
          : `${roleLabel} 是当前默认拍板者。这个经营视图当前主要在为${roleAudienceScene}服务，对外表达继续分清客户、潜在客户和伙伴边界。${externalAudienceLine}`,
      },
      {
        label: english ? "Memory" : "经营记忆",
        value: english
          ? "Current judgement keeps replay, audit, memory linkage, boundary trace and source-use ledger visible, so the workspace explains why it sees pressure now instead of only surfacing a fresh suggestion."
          : "当前判断会同时回看回放、审计、记忆关联、边界痕迹和来源记录，用来解释为什么现在这样判断，而不是只丢出一条新建议。",
      },
      {
        label: english ? "Goal / campaign" : "目标主线",
        value: campaignLine,
      },
    ],
    connections: [
      {
        label: english ? "Constitution entry" : "边界入口",
        value: english ? "Settings / billing overview" : "设置 / 计费总览",
        description: english
          ? "This is where lifecycle, payment, seat and entitlement truth stays readable without turning into a finance console."
          : "这里继续把生命周期、支付、席位和权益真值讲清楚，但不会扩成财务控制台。",
        href: "/settings",
      },
      {
        label: english ? "Role / audience entry" : "角色入口",
        value:
          input.currentPage === "operating"
            ? english
              ? "Internal operating workspace"
              : "内部经营工作区"
            : english
              ? "Dashboard mainline"
              : "工作台主线",
        description:
          input.currentPage === "operating"
            ? english
              ? "The internal operating home should keep who decides, who takes over, and which chain matters visible before the team starts drilling into objects."
              : "内部经营首页先把谁来拍板、谁来接手、哪条经营链最重要摆在前台，再让团队继续钻进对象。"
            : english
              ? "The workspace front page should show who currently needs to decide, who is waiting, and which audience the next move affects."
              : "首页先告诉你谁现在要拍板、谁在等待交接、下一步会影响哪个对象。",
        href: input.currentPage === "operating" ? "/operating" : "/dashboard",
      },
      {
        label: english ? "Memory entry" : "记忆入口",
        value: english ? "Memory timeline and replay" : "记忆时间线与回放",
        description: english
          ? "Use the memory timeline when judgement needs proof, correction history or a clearer handoff trace."
          : "当判断需要证据、修正历史或更清楚的交接痕迹时，就回到记忆时间线。",
        href: "/memory",
      },
      {
        label: english ? "Goal / campaign entry" : "目标入口",
        value: english ? "Today’s operating priorities" : "今日经营主线",
        description: english
          ? "The campaign layer should stay tied to the next operating move instead of floating as a slogan."
          : "目标主线必须继续挂在当前最该推进的经营动作上，而不是飘成一句口号。",
        href: goalEntryHref,
      },
    ],
    note: english
      ? "This is the first operating foundation layer, not a full strategy platform, knowledge platform, workflow engine, or company operating system."
      : "这仍然只是第一轮经营基线，不是完整战略平台、知识平台、流程引擎，也不是完整公司经营系统。",
  };
}

export function buildDetailOperatingFoundationSummary(
  input: DetailOperatingFoundationInput,
): OperatingFoundationSummary {
  const currentNode = input.navigation.currentNode;
  const currentHandoff = input.navigation.handoffs[0] ?? null;
  const decisionOwner = resolveDecisionOwner(
    currentNode.detailNodeType,
    input.english,
  );
  const receivingOwner = currentHandoff
    ? resolveDecisionOwner(currentHandoff.handoffTarget, input.english)
    : decisionOwner;
  const campaignLine = resolveDetailCampaign(
    currentNode.detailNodeType,
    input.english,
  );
  const evidenceLine =
    currentHandoff?.handoffEvidenceSummary[0] ??
    currentHandoff?.handoffWorkerSummary[0] ??
    currentNode.detailNodeCurrentReason;

  return {
    label: input.english ? "Operating foundation" : "当前详情的经营基线",
    title: input.english
      ? "Why this detail is allowed to speak for the workspace"
      : "为什么这个详情现在可以代表工作区说话",
    summary: input.english
      ? "This detail is still grounded by constitution, role, memory and campaign truth before it passes work to the next handoff."
      : "这个详情仍然先受边界、角色、记忆和目标主线约束，然后才允许把工作交给下一段交接。",
    items: [
      {
        label: input.english ? "Constitution" : "边界依据",
        value: input.english
          ? `${trimText(currentNode.detailNodeBoundary, 116)} Provider, worker or page state still cannot replace the workspace boundary truth.`
          : `${trimText(currentNode.detailNodeBoundary, 116)} 服务方、协作助手或页面局部状态都不能替代工作区自己的边界真值。`,
      },
      {
        label: input.english ? "Role / audience" : "角色与受众",
        value: input.english
          ? `${currentNode.detailNodeAudienceMode} is the current audience mode. ${decisionOwner} is the likely decision owner here, and the next handoff is preparing ${receivingOwner} to take over without losing the boundary note.`
          : `${currentNode.detailNodeAudienceMode} 是当前受众模式。这里通常由${decisionOwner}拍板，而下一段交接会把判断交给${receivingOwner}继续接手，同时不丢掉边界说明。`,
      },
      {
        label: input.english ? "Memory" : "记忆与证据",
        value: input.english
          ? `${trimText(evidenceLine, 120)} This detail still depends on replay, evidence, and handoff trace instead of only the latest display state.`
          : `${trimText(evidenceLine, 120)} 这个详情仍然依赖回放、证据和交接记录，而不是只依赖最新一层显示状态。`,
      },
      {
        label: input.english ? "Goal / campaign" : "目标主线",
        value: input.english
          ? `${campaignLine} Current stage: ${currentNode.detailNodeStage}. Next request: ${trimText(currentHandoff?.handoffDecisionRequest ?? currentNode.detailNodeNavigationHint, 112)}`
          : `${campaignLine} 当前阶段：${currentNode.detailNodeStage}。当前请求：${trimText(currentHandoff?.handoffDecisionRequest ?? currentNode.detailNodeNavigationHint, 112)}`,
      },
    ],
    connections: currentHandoff
      ? [
          {
            label: input.english ? "Current handoff" : "当前交接",
            value: currentHandoff.handoffNextAction,
            description: trimText(
              `${currentHandoff.handoffReason} ${currentHandoff.handoffBoundary}`,
              132,
            ),
            href: currentHandoff.handoffHref,
          },
        ]
      : [],
    note: input.english
      ? "This is still a first-layer operating foundation, not a full org platform or orchestration engine."
      : "这仍然只是第一层经营基线，不是完整组织平台，也不是完整编排引擎。",
  };
}

function resolveWorkspaceScene(
  profileType: string | null | undefined,
  english: boolean,
) {
  const value = profileType?.trim() ?? "";
  if (/创始人|COO/i.test(value)) {
    return english ? "the founder operating mainline" : "创始人经营主线";
  }
  if (/销售/i.test(value)) {
    return english ? "the sales momentum line" : "销售推进主线";
  }
  if (/猎头|招聘/i.test(value)) {
    return english ? "the recruiting and candidate line" : "招聘与候选人主线";
  }
  if (/顾问|服务商|交付/i.test(value)) {
    return english
      ? "the delivery and client-service line"
      : "交付与客户服务主线";
  }

  return english ? "the workspace operating line" : "当前工作区经营主线";
}

function resolveExternalAudienceLine(focusAreas: string[], english: boolean) {
  if (!focusAreas.length) {
    return english
      ? "External audience stays separated by risk and sendability instead of by a generic CRM label."
      : "对外对象仍然按风险和可发送边界分开，而不是退化成一个泛客户系统标签。";
  }

  const mappedAudiences = new Set<string>();
  for (const focus of focusAreas) {
    if (/客户|招聘|合作|拓展|交付/.test(focus)) {
      if (/客户/.test(focus)) mappedAudiences.add("customer / prospect");
      if (/招聘/.test(focus)) mappedAudiences.add("candidate / hiring team");
      if (/合作|拓展/.test(focus)) mappedAudiences.add("partner / prospect");
      if (/交付/.test(focus)) {
        mappedAudiences.add(
          english ? "customer / delivery owner" : "客户 / 交付负责人",
        );
      }
    }
  }

  if (!mappedAudiences.size) {
    return english
      ? "External audience still follows customer / prospect / partner boundaries."
      : "外部对象仍然按客户、潜在客户和伙伴边界区分。";
  }

  return english
    ? `Current external audience pressure mainly touches ${Array.from(mappedAudiences).join(", ")}.`
    : `当前外部对象压力主要落在 ${Array.from(mappedAudiences)
        .map((item) =>
          item === "customer / prospect"
            ? "客户 / 潜在客户"
            : item === "candidate / hiring team"
              ? "候选人 / 招聘团队"
              : item === "partner / prospect"
                ? "伙伴 / 潜在客户"
                : item,
        )
        .join("、")}。`;
}

function buildWorkspaceCampaignLine(input: {
  english: boolean;
  focusAreas: string[];
  topJudgements: string[];
}) {
  const focusLine = input.focusAreas.length
    ? input.focusAreas.slice(0, 3).join(" / ")
    : input.english
      ? "keep today’s operating pressure visible across the workspace"
      : "把今天最重要的经营压力持续放在组织前台";
  const judgementLine = input.topJudgements.filter(Boolean).slice(0, 3);

  if (!judgementLine.length) {
    return input.english
      ? `Current campaign: ${focusLine}. If the system has not yet stabilized the next three judgements, dashboard, settings and operating surfaces should still keep the campaign visible before the execution rail.`
      : `当前主战役：${focusLine}。如果 Helm 还没稳定到“最重要的三个判断”，工作台、设置和经营面也先把目标主线放在执行动作之前。`;
  }

  return input.english
    ? `Current campaign: ${focusLine}. Current top judgements: ${judgementLine.map((item) => trimText(item, 56)).join(" / ")}`
    : `当前主战役：${focusLine}。当前最重要的判断：${judgementLine.map((item) => trimText(item, 56)).join(" / ")}`;
}

function buildLifecycleLine(accessState: AccessState, english: boolean) {
  if (accessState === "TRIALING") {
    return english
      ? "Trial stays fully open while the organization proves the operating loop."
      : "试用会继续保持核心能力完整开放，让组织先把经营闭环跑起来。";
  }
  if (accessState === "GRACE") {
    return english
      ? "Grace keeps viewing and export open while new high-cost processing narrows."
      : "宽限期会继续保留查看和导出，同时把新的高成本处理收窄。";
  }
  if (accessState === "READ_ONLY") {
    return english
      ? "Read-only still preserves viewing and export, but it does not reopen new high-cost processing."
      : "只读状态继续保留查看和导出，但不会重新开放新的高成本处理。";
  }
  if (accessState === "CANCELED") {
    return english
      ? "Canceled keeps the historical organization context readable, but paid access must be restored through an explicit renew or restore path."
      : "已取消状态会继续保留组织历史上下文可读，但要恢复付费访问，必须走显式的续费或恢复路径。";
  }
  return english
    ? "Active access keeps the same core product while lifecycle, seat and entitlement truth stay visible."
    : "活跃状态会继续保持同一套核心产品，只把生命周期、席位和权益真值显式摆在前台。";
}

function resolveDecisionOwner(
  nodeType: UnifiedDetailNodeType,
  english: boolean,
) {
  if (nodeType.startsWith("founder")) {
    return english ? "the founder / owner" : "创始人 / 负责人";
  }
  if (
    nodeType.startsWith("sales") ||
    nodeType === "proposal" ||
    nodeType === "package" ||
    nodeType === "customer-facing-offer" ||
    nodeType === "external-proposal" ||
    nodeType === "external-narrative" ||
    nodeType === "narrative-fallback" ||
    nodeType === "reinforcement" ||
    nodeType === "sendability" ||
    nodeType === "variants" ||
    nodeType === "package-variants" ||
    nodeType === "reinforcement-variants"
  ) {
    return english ? "the sales owner" : "销售负责人";
  }
  if (
    nodeType.startsWith("delivery") ||
    nodeType === "commercial-strengthening"
  ) {
    return english ? "the delivery owner" : "交付负责人";
  }
  if (
    nodeType === "customer-success" ||
    nodeType === "success-check" ||
    nodeType === "expansion-review"
  ) {
    return english ? "customer success" : "客户成功";
  }
  if (nodeType === "review-request-detail" || nodeType === "follow-up-detail") {
    return english ? "the reviewer" : "评审人";
  }
  if (
    nodeType === "meeting-detail" ||
    nodeType === "inbox-detail" ||
    nodeType === "conversation" ||
    nodeType === "contact-detail" ||
    nodeType === "company-detail"
  ) {
    return english ? "the operator / reviewer" : "运营 / 评审人";
  }
  return english ? "the current operator" : "当前操作人";
}

function resolveDetailCampaign(
  nodeType: UnifiedDetailNodeType,
  english: boolean,
) {
  if (nodeType === "meeting-detail") {
    return english
      ? "This detail is serving the meeting-to-follow-through campaign."
      : "这段详情当前服务的是会议到会后推进主战役。";
  }
  if (
    nodeType === "customer-success" ||
    nodeType === "success-check" ||
    nodeType === "expansion-review"
  ) {
    return english
      ? "This detail is serving the customer retention and expansion campaign."
      : "这段详情当前服务的是客户保留与扩张主战役。";
  }
  if (
    nodeType.startsWith("sales") ||
    nodeType === "proposal" ||
    nodeType === "package" ||
    nodeType === "customer-facing-offer" ||
    nodeType === "external-proposal" ||
    nodeType === "external-narrative" ||
    nodeType === "narrative-fallback" ||
    nodeType === "reinforcement" ||
    nodeType === "sendability" ||
    nodeType === "variants" ||
    nodeType === "package-variants" ||
    nodeType === "reinforcement-variants"
  ) {
    return english
      ? "This detail is serving the opportunity momentum and safe external expression campaign."
      : "这段详情当前服务的是机会推进与安全外部表达主战役。";
  }
  if (
    nodeType.startsWith("delivery") ||
    nodeType === "commercial-strengthening"
  ) {
    return english
      ? "This detail is serving the delivery quality and expectation-setting campaign."
      : "这段详情当前服务的是交付质量与预期管理主战役。";
  }
  if (nodeType.startsWith("founder")) {
    return english
      ? "This detail is serving the founder cross-line judgement campaign."
      : "这段详情当前服务的是创始人跨线判断主战役。";
  }
  if (nodeType === "company-detail" || nodeType === "contact-detail") {
    return english
      ? "This detail is serving the relationship and account momentum campaign."
      : "这段详情当前服务的是关系与账户势能主战役。";
  }
  return english
    ? "This detail is serving the current operating campaign."
    : "这段详情当前服务的是当前经营主战役。";
}
