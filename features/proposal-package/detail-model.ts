import type {
  PackagePageDetailReportingContract,
  ProposalPageDetailReportingContract,
  ProposalPackageAudienceMode,
  ProposalPackageEvidenceGroup,
  ProposalPackageRiskSignal,
} from "@/lib/presentation/proposal-package-detail-contract";
import {
  createPackagePageDetailReportingContract,
  createProposalPageDetailReportingContract,
} from "@/lib/presentation/proposal-package-detail-contract";
import type { ProposalPackageCommercialDetail } from "@/features/proposal-package/proposal-package-detail-view";
import { format, formatDistanceToNowStrict } from "date-fns";
import { enUS } from "date-fns/locale";
import { formatDateLabel, formatRelative, trimText } from "@/lib/utils";

type CommercialDetailSource = {
  id: string;
  title: string;
  stage: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  nextAction: string | null;
  dueDate: Date | null;
  updatedAt: Date;
  company: { name: string } | null;
  contacts: Array<{ name: string }>;
  owner: { name: string } | null;
  memoryFacts: Array<{
    id: string;
    title: string;
    content: string;
    updatedAt: Date;
  }>;
  memoryEntries: Array<{
    id: string;
    title: string;
    content: string;
    createdAt: Date;
  }>;
  commitments: Array<{
    id: string;
    title: string;
    commitmentText: string;
    overdueFlag: boolean;
    status: string;
    dueDate: Date | null;
  }>;
  blockers: Array<{
    id: string;
    title: string;
    blockerText: string;
    severity: number;
    status: string;
    updatedAt: Date;
  }>;
  actionItems: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: Date | null;
    approvalTask: { id: string; status: string } | null;
  }>;
  auditLogs: Array<{
    id: string;
    actor: string;
    summary: string;
    createdAt: Date;
  }>;
  briefingSnapshot: {
    payload: { summary?: string; recommendedNextSteps?: string[] };
  } | null;
};

export function buildProposalPackageCommercialDetail(
  detail: CommercialDetailSource,
  labels: {
    stageLabel: string;
    riskLabel: string;
  },
): ProposalPackageCommercialDetail {
  return {
    id: detail.id,
    title: detail.title,
    stageCode: detail.stage,
    stageLabel: labels.stageLabel,
    riskLabel: labels.riskLabel,
    riskLevel: detail.riskLevel,
    companyName: detail.company?.name ?? null,
    contactNames: detail.contacts.map((contact) => contact.name),
    ownerName: detail.owner?.name ?? null,
    dueDate: detail.dueDate,
    updatedAt: detail.updatedAt,
    nextAction: detail.nextAction,
    memoryFacts: detail.memoryFacts,
    memoryEntries: detail.memoryEntries,
    commitments: detail.commitments,
    blockers: detail.blockers,
    actionItems: detail.actionItems,
    auditLogs: detail.auditLogs,
    briefingSnapshot: detail.briefingSnapshot
      ? {
          payload: {
            summary: detail.briefingSnapshot.payload.summary,
            recommendedNextSteps: Array.isArray(
              detail.briefingSnapshot.payload.recommendedNextSteps,
            )
              ? detail.briefingSnapshot.payload.recommendedNextSteps
              : undefined,
          },
        }
      : null,
  };
}

export function buildProposalPageContract({
  detail,
  english,
}: {
  detail: ProposalPackageCommercialDetail;
  english: boolean;
}): ProposalPageDetailReportingContract {
  const signals = summarizeCommercialSignals(detail);
  const audienceMode: ProposalPackageAudienceMode = signals.internalReviewOnly
    ? "internal_review"
    : signals.customerSafeReady
      ? "customer_safe_review"
      : "non_commitment_window";
  const riskSignal = mapRiskSignal(detail.riskLevel, signals);

  return createProposalPageDetailReportingContract({
    proposalPageJudgement: signals.internalReviewOnly
      ? english
        ? "This proposal is still internal-review only and should not be hardened into external wording yet."
        : "当前提案仍只适合内部复核，还不能直接固化成对外措辞。"
      : signals.customerSafeReady
        ? english
          ? "This proposal can move into a customer-safe review pass, but it is still a non-commitment draft."
          : "当前提案可以进入客户安全复核，但它仍然只是非承诺草稿。"
        : english
          ? "This proposal is worth shaping now, but it still needs boundary and dependency cleanup before it leaves the review layer."
          : "当前提案值得继续整形，但在离开复核层之前，仍要先收口边界和依赖。",
    proposalPageJudgementReason:
      detail.briefingSnapshot?.payload.summary ??
      (english
        ? "The current commercial line already brings the stage window, current blockers, open commitments and the last recommended next move together."
        : "当前这条商业推进线已经把阶段窗口、当前卡点、开放承诺和最近建议的下一步动作收在一起。"),
    proposalPageActionSummary: [
      english
        ? "The current review pack already condenses the opportunity brief, the top blocker and the latest next-step context."
        : "当前复核包已经把机会摘要、最大阻塞和最新下一步上下文收在一起。",
      english
        ? `${detail.commitments.length} open commitments and ${detail.blockers.length} blockers are already attached to the proposal view.`
        : `当前的 ${detail.commitments.length} 条开放承诺和 ${detail.blockers.length} 个阻塞都已经挂进提案视图。`,
      english
        ? "Sales-facing framing has been prepared first, so you do not need to re-read the raw object before deciding."
        : "面向销售的措辞已经先整理好，你不需要重读原始对象才能做判断。",
    ],
    proposalPageDecisionRequest: [
      signals.internalReviewOnly
        ? english
          ? "Confirm whether the proposal should stay in internal review until blockers, approvals and trust-sensitive wording are closed."
          : "确认这版提案是否继续停留在内部复核，直到阻塞、审批和信任敏感措辞收口。"
        : english
          ? "Confirm whether the next pass should stay internal, or move into a customer-safe review version."
          : "确认下一版到底继续内部复核，还是进入客户安全复核版本。",
      english
        ? "Confirm who owns the next external-safe move, and whether it needs approval before anyone sends or promises anything."
        : "确认下一步可对外动作由谁接，以及在任何人发送或承诺之前是否必须先过审批。",
    ],
    proposalPageBoundarySummary: [
      english
        ? "Recommendation still does not equal commitment; final proposal wording remains with the human owner."
        : "建议仍不等于承诺；最终提案措辞仍属于人工负责人。",
      signals.blockerCount
        ? english
          ? "Current blockers and dependency notes must stay visible before anyone upgrades this into a customer-facing promise."
          : "在任何人把它升级成客户可见承诺之前，当前卡点和依赖说明必须保持可见。"
        : english
          ? "The current version is still a proposal draft, not a package or contract promise."
          : "当前这一版仍是提案草稿，不是方案包或合同承诺。",
      signals.pendingApprovalCount
        ? english
          ? "Approval-sensitive moves must stay behind review before wording hardens."
          : "任何审批敏感动作都必须先停在复核后面，再让措辞变硬。"
        : english
          ? "Internal-only preparation should not leak into customer-facing wording."
          : "仅内部准备内容不能直接泄漏进客户可见措辞。",
    ],
    proposalPageEvidenceSummary: [
      english
        ? `${detail.memoryFacts.length} memory facts, ${detail.commitments.length} commitments, ${detail.blockers.length} blockers and ${detail.auditLogs.length} audit changes are already grouped below.`
        : `当前已经把 ${detail.memoryFacts.length} 条经营记忆事实、${detail.commitments.length} 条承诺、${detail.blockers.length} 个阻塞和 ${detail.auditLogs.length} 条审计变化收进下面的证据层。`,
      english
        ? "Replay, audit, memory, worker output, boundary trace and historical changes are all available without interrupting the main narrative."
        : "回放、审计、经营记忆、执行输出、边界轨迹和历史变更都已可看，但不会打断主叙事。",
    ],
    proposalPageWorkerSummary: [
      english
        ? "Sales worker keeps the framing, follow-up direction and objection-safe narrative ready."
        : "销售执行会持续把措辞、跟进方向和异议安全叙事准备好。",
      english
        ? "Delivery-facing boundary logic keeps prerequisite, dependency and scope caution visible."
        : "面向交付的边界逻辑会持续把前置、依赖和范围谨慎提示挂在前台。",
    ],
    proposalPageNextAction: [
      {
        label: english ? "Open opportunity desk" : "打开机会工作台",
        href: `/opportunities?opportunityId=${detail.id}`,
      },
      {
        label: english ? "Open package page" : "打开方案包页面",
        href: `/packages/${detail.id}`,
        variant: "secondary",
      },
      {
        label: english ? "Open evidence" : "查看依据",
        href: `/memory?objectType=OPPORTUNITY&objectId=${detail.id}`,
        variant: "ghost",
      },
    ],
    proposalPageRiskSignal: riskSignal,
    proposalPageAudienceMode: audienceMode,
    proposalPageEvidenceGroups: buildEvidenceGroups(detail, english),
    pageWhyItMatters: [
      english
        ? `The opportunity is currently at ${detail.stageLabel}, so wording and timing now directly shape whether momentum keeps heating or drifts back into internal notes.`
        : `当前机会处在「${detail.stageLabel}」窗口，所以措辞和时机会直接影响它是继续升温，还是重新退回内部备注。`,
      signals.openCommitmentCount
        ? english
          ? `${signals.openCommitmentCount} open commitments still shape the trust boundary, so the next proposal move cannot pretend the work is already closed.`
          : `当前仍有 ${signals.openCommitmentCount} 条开放承诺在影响信任边界，所以下一步提案不能假装工作已经闭环。`
        : english
          ? "There is no single overdue commitment dominating the view, so this is the right time to shape the next version carefully."
          : "当前没有单条逾期承诺主导视野，正适合谨慎整形下一版。",
      english
        ? "The draft context is already prepared, so the real value now is deciding whether this stays internal or becomes customer-safe."
        : "当前草稿上下文已经准备好，所以现在真正的价值在于决定它继续内部复核，还是进入客户安全版本。",
    ],
    pageEscalationHint: signals.internalReviewOnly
      ? english
        ? "If the next move starts hardening scope, promise or external expectation, route it into approvals before anyone sends it."
        : "如果下一步开始固化范围、承诺或对外预期，就先把它送进审批，再让任何人发出去。"
      : english
        ? "If customer-facing trust risk rises, step back from customer-safe review and return this to internal review first."
        : "如果客户可见信任风险开始上升，就先从客户安全复核退回内部复核。",
    pageEvidenceLinks: [
      {
        label: english ? "Open opportunity memory" : "打开机会记忆",
        href: `/memory?objectType=OPPORTUNITY&objectId=${detail.id}`,
      },
      {
        label: english ? "Open approvals" : "查看审批痕迹",
        href: "/approvals",
      },
      {
        label: english ? "Back to opportunity desk" : "回到机会工作台",
        href: `/opportunities?opportunityId=${detail.id}`,
      },
    ],
  });
}

export function buildPackagePageContract({
  detail,
  english,
}: {
  detail: ProposalPackageCommercialDetail;
  english: boolean;
}): PackagePageDetailReportingContract {
  const signals = summarizeCommercialSignals(detail);
  const audienceMode: ProposalPackageAudienceMode = signals.internalReviewOnly
    ? "internal_review"
    : signals.blockerCount || signals.openCommitmentCount
      ? "non_commitment_window"
      : "customer_safe_review";
  const riskSignal = mapRiskSignal(detail.riskLevel, signals);

  return createPackagePageDetailReportingContract({
    packagePageJudgement: signals.internalReviewOnly
      ? english
        ? "This package should stay in internal scope review until approvals, blockers and trust-sensitive dependencies are cleared."
        : "当前方案包应继续停留在内部范围复核，先清掉审批、阻塞和信任敏感依赖。"
      : signals.blockerCount || signals.openCommitmentCount
        ? english
          ? "This package is ready for a sales / delivery review pass, but it is still not safe to treat as a customer promise."
          : "当前方案包已适合进入销售 / 交付复核，但还不能被当成客户承诺。"
        : english
          ? "This package can move into a customer-safe version, while still keeping the non-commitment boundary explicit."
          : "当前方案包可以整理成客户安全版本，但仍要把非承诺边界写明。",
    packagePageJudgementReason:
      detail.briefingSnapshot?.payload.summary ??
      (english
        ? "The current package page already brings the stage window, scope pressure, open commitments and the latest working summary together."
        : "当前方案包页面已经把阶段窗口、范围压力、开放承诺和最近工作摘要收在一起。"),
    packagePageActionSummary: [
      english
        ? "The current package view already groups scope pressure, dependency pressure and the latest review-ready summary."
        : "当前方案包视图已经把范围压力、依赖压力和最新待复核摘要收在一起。",
      signals.pendingApprovalCount
        ? english
          ? `${signals.pendingApprovalCount} approval-sensitive actions are already intercepted, so this page is not pretending risk does not exist.`
          : `当前已有 ${signals.pendingApprovalCount} 条审批敏感动作被拦下，所以这页不会假装风险不存在。`
        : english
          ? "No approval-sensitive action is blocking the page right now, so the real question is whether the package wording is ready enough."
          : "当前没有审批敏感动作直接挡在前面，所以真正的问题是方案包措辞是否已经足够成熟。",
      english
        ? "The latest blocker, commitment and memory context are already attached so sales and delivery can review the same object together."
        : "最新阻塞、承诺和经营记忆上下文已经挂好，所以销售和交付可以一起复核同一个对象。",
    ],
    packagePageDecisionRequest: [
      english
        ? "Decide whether this package should stay internal, move into a customer-safe version, or stop until prerequisites are closed."
        : "决定这版方案包是继续内部复核、进入客户安全版本，还是先停住等前置收口。",
      english
        ? "Decide whether the next move should be led by sales, delivery or a joint review."
        : "决定下一步动作应该由销售、交付还是联合复核主导。",
    ],
    packagePageBoundarySummary: [
      english
        ? "Package wording is still a commercial framing artifact, not a customer commitment or contract promise."
        : "方案包措辞仍只是商业整形产物，不是客户承诺或合同承诺。",
      signals.blockerCount
        ? english
          ? "Prerequisite and dependency notes must stay in front of any external-safe version."
          : "任何可对外版本之前，都必须把前置和依赖备注放在前台。"
        : english
          ? "Even in the customer-safe window, final delivery boundary still belongs to human review."
          : "即使进入客户安全窗口，最终交付边界仍属于人工复核。",
      english
        ? "Internal-only scope notes cannot be flattened into customer-facing copy."
        : "仅内部的范围备注不能被直接摊平成客户可见文案。",
    ],
    packagePageEvidenceSummary: [
      english
        ? `${detail.actionItems.length} linked actions, ${detail.auditLogs.length} audit logs and the latest memory / blocker bundle are already grouped below.`
        : `当前 ${detail.actionItems.length} 条关联动作、${detail.auditLogs.length} 条审计变化和最新经营记忆 / 阻塞套件都已经分组收在下面。`,
      english
        ? "Evidence stays grouped by replay, audit, memory, worker output, boundary trace and historical changes."
        : "证据层按回放、审计、经营记忆、执行输出、边界轨迹和历史变更分组，不会打断主叙事。",
    ],
    packagePageWorkerSummary: [
      english
        ? "Sales worker keeps the package framing, objection-safe language and next-step options visible."
        : "销售执行会持续把方案包措辞、异议安全语言和下一步选项挂在前台。",
      english
        ? "Delivery worker keeps scope, dependency and review-needed notes from being buried."
        : "交付执行会持续防止范围、依赖和待复核备注被埋掉。",
    ],
    packagePageNextAction: [
      {
        label: english ? "Open opportunity desk" : "打开机会工作台",
        href: `/opportunities?opportunityId=${detail.id}`,
      },
      {
        label: english ? "Open approvals" : "打开审批中心",
        href: "/approvals",
        variant: "secondary",
      },
      {
        label: english ? "Open evidence" : "查看依据",
        href: `/memory?objectType=OPPORTUNITY&objectId=${detail.id}`,
        variant: "ghost",
      },
    ],
    packagePageRiskSignal: riskSignal,
    packagePageAudienceMode: audienceMode,
    packagePageEvidenceGroups: buildEvidenceGroups(detail, english),
    packagePageCollaborationMode: signals.internalReviewOnly
      ? "helm_prepares_human_decides"
      : "helm_drives_human_supervises",
    packagePageCollaborationSummary: signals.internalReviewOnly
      ? english
        ? "The package context is already prepared, but it still needs a human review gate before anything hardens."
        : "当前方案包上下文已经准备好，但在任何内容变硬之前仍需要人工复核闸口。"
      : english
        ? "Sales and delivery can now review the same package context together without re-reading raw objects."
        : "销售和交付现在可以对着同一份方案包上下文协作，而不需要重新翻原始对象。",
    packagePageCollaborationRequest: english
      ? "Use this page to align scope, dependency and safe-next-step wording before anything customer-facing moves."
      : "先在这一页把范围、依赖和安全下一步措辞对齐，再决定任何客户可见动作。",
    packagePageCollaborationNextStep: [
      english
        ? "Confirm whether the package should stay internal or move into a customer-safe review version."
        : "确认这版方案包是继续内部复核，还是进入客户安全复核版本。",
      english
        ? "Confirm whether the next move is a review meeting, a scoped follow-up or a hold."
        : "确认下一步到底是开评审会、做限定范围的跟进，还是先守住。",
    ],
    packagePageCollaborationOwner:
      detail.ownerName ??
      (english
        ? "Sales owner + delivery review"
        : "销售负责人 + 交付复核"),
    pageWhyItMatters: [
      english
        ? `The package view is now in a ${detail.stageLabel} window, so scope, trust and delivery expectation should not be left in raw rows.`
        : `当前方案包已进入「${detail.stageLabel}」窗口，所以范围、信任和交付预期不能继续留在原始行里。`,
      signals.blockerCount
        ? english
          ? `${signals.blockerCount} blockers and ${signals.openCommitmentCount} open commitments are still shaping whether this can safely move.`
          : `当前 ${signals.blockerCount} 个阻塞和 ${signals.openCommitmentCount} 条开放承诺，仍在决定这页是否能安全继续推进。`
        : english
          ? "The package window is open, but only if the team keeps the non-commitment boundary visible."
          : "当前已经出现方案包窗口，但前提是团队持续把非承诺边界挂在前台。",
      english
        ? "The review context is already prepared, so the value now is coordinated judgement, not more raw object reading."
        : "当前复核上下文已经准备好，所以现在真正需要的是协同判断，而不是继续翻原始对象。",
    ],
    pageEscalationHint: signals.internalReviewOnly
      ? english
        ? "If the package starts touching final pricing, delivery promise or customer expectation, escalate into approvals before any outward move."
        : "如果方案包开始触碰最终报价、交付承诺或客户预期，就先升级进审批，再允许任何对外动作。"
      : english
        ? "If scope or delivery dependency expands, step back into internal review before the package goes outward."
        : "如果范围或交付依赖开始扩张，就先退回内部复核，再考虑对外。",
    pageEvidenceLinks: [
      {
        label: english ? "Open opportunity desk" : "打开机会工作台",
        href: `/opportunities?opportunityId=${detail.id}`,
      },
      {
        label: english ? "Open approvals" : "查看审批",
        href: "/approvals",
      },
      {
        label: english ? "Open memory trace" : "查看记忆痕迹",
        href: `/memory?objectType=OPPORTUNITY&objectId=${detail.id}`,
      },
    ],
  });
}

function summarizeCommercialSignals(detail: ProposalPackageCommercialDetail) {
  const blockerCount = detail.blockers.length;
  const openCommitmentCount = detail.commitments.filter(
    (item) => item.status !== "FULFILLED",
  ).length;
  const pendingApprovalCount = detail.actionItems.filter(
    (item) => item.approvalTask?.status === "PENDING",
  ).length;
  const internalReviewOnly =
    detail.riskLevel === "HIGH" ||
    detail.riskLevel === "CRITICAL" ||
    pendingApprovalCount > 0;
  const customerSafeReady =
    !internalReviewOnly && blockerCount === 0 && openCommitmentCount <= 1;

  return {
    blockerCount,
    openCommitmentCount,
    pendingApprovalCount,
    internalReviewOnly,
    customerSafeReady,
  };
}

function mapRiskSignal(
  riskLevel: ProposalPackageCommercialDetail["riskLevel"],
  signals: ReturnType<typeof summarizeCommercialSignals>,
): ProposalPackageRiskSignal {
  if (
    riskLevel === "HIGH" ||
    riskLevel === "CRITICAL" ||
    signals.pendingApprovalCount > 0
  ) {
    return "high";
  }

  if (signals.blockerCount > 0 || signals.openCommitmentCount > 0) {
    return "caution";
  }

  return "watch";
}

function buildEvidenceGroups(
  detail: ProposalPackageCommercialDetail,
  english: boolean,
): ProposalPackageEvidenceGroup[] {
  return [
    {
      groupId: "replay",
      label: english ? "Replay" : "回放",
      items: [
        detail.briefingSnapshot?.payload.summary ??
          (english
            ? "No latest replay summary yet; Helm is relying on the current commercial context."
            : "当前还没有新的回放摘要，Helm 主要依赖现有商业上下文。"),
        detail.nextAction
          ? english
            ? `Recorded next move: ${detail.nextAction}`
            : `台账中的下一步：${detail.nextAction}`
          : english
            ? "No concrete next move has been captured yet."
            : "当前还没有被沉淀下来的下一步动作。",
      ],
    },
    {
      groupId: "audit",
      label: english ? "Audit" : "审计",
      items:
        detail.auditLogs.length > 0
          ? detail.auditLogs
              .slice(0, 2)
              .map((log) =>
                english
                  ? `${log.actor} · ${log.summary} · ${formatEvidenceRelative(log.createdAt, true)}`
                  : `${log.actor} · ${log.summary} · ${formatRelative(log.createdAt)}`,
              )
          : [
              english
                ? "No recent audit change yet."
                : "当前还没有新的审计变化。",
            ],
    },
    {
      groupId: "memory",
      label: english ? "Memory" : "记忆",
      items:
        detail.memoryFacts.length > 0 || detail.memoryEntries.length > 0
          ? [
              ...detail.memoryFacts
                .slice(0, 2)
                .map((fact) =>
                  english
                    ? `${fact.title}: ${trimText(fact.content, 80)}`
                    : `${fact.title}：${trimText(fact.content, 80)}`,
                ),
              ...detail.memoryEntries
                .slice(0, 1)
                .map((entry) =>
                  english
                    ? `${entry.title}: ${trimText(entry.content, 72)}`
                    : `${entry.title}：${trimText(entry.content, 72)}`,
                ),
            ]
          : [
              english
                ? "No structured memory summary yet."
                : "当前还没有结构化记忆摘要。",
            ],
    },
    {
      groupId: "worker_output",
      label: english ? "Worker output" : "执行输出",
      items:
        detail.actionItems.length > 0 ||
        Boolean(detail.briefingSnapshot?.payload.recommendedNextSteps?.length)
          ? [
              ...detail.actionItems
                .slice(0, 2)
                .map((item) =>
                  english
                    ? `${item.title} · ${item.status}${item.approvalTask ? " · approval attached" : ""}`
                    : `${item.title} · ${item.status}${item.approvalTask ? " · 已挂审批" : ""}`,
                ),
              ...(detail.briefingSnapshot?.payload.recommendedNextSteps ?? [])
                .slice(0, 1)
                .map((item) =>
                  english
                    ? `Prepared next-step cue: ${item}`
                    : `已准备的下一步线索：${item}`,
                ),
            ]
          : [
              english
                ? "No worker-prepared output yet."
                : "当前还没有新的执行输出。",
            ],
    },
    {
      groupId: "boundary_trace",
      label: english ? "Boundary trace" : "边界痕迹",
      items: [
        detail.blockers.length
          ? english
            ? `${detail.blockers.length} blockers remain visible in the current commercial judgement.`
            : `当前商业判断里仍挂着 ${detail.blockers.length} 个阻塞。`
          : english
            ? "No structured blocker is currently dominating the boundary trace."
            : "当前没有结构化阻塞主导边界痕迹。",
        detail.commitments.length
          ? english
            ? `${detail.commitments.length} commitments are still shaping whether the next move can become customer-safe.`
            : `当前有 ${detail.commitments.length} 条承诺在影响下一步能否客户安全。`
          : english
            ? "No active commitment is holding the boundary line."
            : "当前没有活跃承诺正在卡边界。",
      ],
    },
    {
      groupId: "historical_changes",
      label: english ? "Historical changes" : "历史变化",
      items: [
        english
          ? `Last updated ${formatEvidenceRelative(detail.updatedAt, true)}`
          : `最后更新于 ${formatRelative(detail.updatedAt)}`,
        english
          ? `Current due date: ${formatEvidenceDateLabel(detail.dueDate, true)}`
          : `当前截止时间：${formatDateLabel(detail.dueDate)}`,
      ],
    },
  ];
}

function formatEvidenceRelative(
  value: Date | string | null | undefined,
  english: boolean,
) {
  if (!english) return formatRelative(value);
  if (!value) return "No date";

  const date = typeof value === "string" ? new Date(value) : value;
  return formatDistanceToNowStrict(date, {
    addSuffix: true,
    locale: enUS,
  });
}

function formatEvidenceDateLabel(
  value: Date | string | null | undefined,
  english: boolean,
) {
  if (!english) return formatDateLabel(value);
  if (!value) return "Not set";

  const date = typeof value === "string" ? new Date(value) : value;
  return format(date, "MMM d HH:mm", { locale: enUS });
}
