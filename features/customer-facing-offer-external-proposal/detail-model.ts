import type {
  CustomerFacingOfferExternalProposalEvidenceGroup,
  CustomerFacingOfferExternalProposalRiskSignal,
  CustomerFacingOfferExternalProposalSendabilityMode,
  CustomerFacingOfferPageDetailReportingContract,
  ExternalProposalPageDetailReportingContract,
} from "@/lib/presentation/customer-facing-offer-external-proposal-detail-contract";
import {
  createCustomerFacingOfferPageDetailReportingContract,
  createExternalProposalPageDetailReportingContract,
} from "@/lib/presentation/customer-facing-offer-external-proposal-detail-contract";
import type { ProposalPackageCommercialDetail } from "@/features/proposal-package/proposal-package-detail-view";
import { formatDateLabel, formatRelative, trimText } from "@/lib/utils";

export function buildCustomerFacingOfferPageContract({
  detail,
  english,
}: {
  detail: ProposalPackageCommercialDetail;
  english: boolean;
}): CustomerFacingOfferPageDetailReportingContract {
  const signals = summarizeExternalExpressionSignals(detail);
  const sendabilityMode = getCustomerOfferSendabilityMode(detail, signals);
  const riskSignal = mapRiskSignal(detail.riskLevel, signals);

  return createCustomerFacingOfferPageDetailReportingContract({
    customerOfferPageJudgement: buildCustomerOfferJudgement(
      sendabilityMode,
      english,
    ),
    customerOfferPageJudgementReason:
      detail.briefingSnapshot?.payload.summary ??
      (english
        ? "The current outward-expression line already brings commercial heat, blocker pressure, open commitments and the latest review context together."
        : "当前这条对外表达线已经把商业热度、阻塞压力、开放承诺和最新复核上下文收在一起。"),
    customerOfferPageActionSummary: [
      english
        ? "A customer-facing offer framing draft is already prepared, together with the current boundary, dependency and review-needed notes."
        : "当前已经准备好一版客户可见报价措辞草稿，并把边界、依赖和待复核备注一起收好。",
      signals.pendingApprovalCount
        ? english
          ? `${signals.pendingApprovalCount} approval-sensitive actions are still holding the send gate, so this page is not pretending the wording is ready to leave review.`
          : `当前仍有 ${signals.pendingApprovalCount} 条审批敏感动作卡在发送闸口上，所以这页不会假装文案已经可以离开复核。`
        : english
          ? "The offer-safe version, latest blocker summary and next-step context are already grouped into one decision page."
          : "当前对外安全版本、最新阻塞摘要和下一步上下文都已经被收进同一页决策面。",
      english
        ? "You do not need to read raw fields first; customer-facing wording and internal-only notes are already separated."
        : "你不需要先翻原始字段；客户可见措辞和仅内部备注已经分开了。",
    ],
    customerOfferPageDecisionRequest: [
      english
        ? `Confirm whether this stays ${labelForSendabilityMode(sendabilityMode, true)} or should step back into internal review.`
        : `确认这版当前是继续保持「${labelForSendabilityMode(sendabilityMode, false)}」，还是需要退回内部复核。`,
      english
        ? "Confirm who owns the next outward-safe move, and whether it should remain review-before-send before anyone sends or reinforces expectation."
        : "确认下一步对外安全动作由谁接，以及在任何人外发或加强预期前，是否仍必须保持发送前复核。",
    ],
    customerOfferPageBoundarySummary: [
      english
        ? "Only customer-facing wording can leave this page; internal-only shaping notes must stay inside review and evidence layers."
        : "只有客户可见措辞可以离开这一页；仅内部的整形说明必须继续留在复核和依据层。",
      buildBoundaryLineForSendability(sendabilityMode, english),
      english
        ? "Recommendation, discussion-only and boundary notes still do not equal commitment."
        : "建议、仅讨论和边界备注仍然不等于承诺。",
    ],
    customerOfferPageEvidenceSummary: [
      english
        ? `${detail.auditLogs.length} audit changes, ${detail.memoryFacts.length} memory facts and the full sendability trace are grouped below without interrupting the main narrative.`
        : `当前 ${detail.auditLogs.length} 条审计变化、${detail.memoryFacts.length} 条经营记忆事实和完整发送评估轨迹已经分组收在下面，不会打断主叙事。`,
      english
        ? "Replay, audit, memory, worker output, boundary trace, sendability trace and historical changes remain available on demand."
        : "回放、审计、经营记忆、执行输出、边界轨迹、发送评估轨迹和历史变更都在附注层按需可看。",
    ],
    customerOfferPageWorkerSummary: [
      english
        ? "Sales worker keeps the outward framing, follow-up-safe language and objection-safe alternatives visible."
        : "销售执行会持续把对外措辞、跟进安全语言和异议安全备选表达挂在前台。",
      english
        ? "Founder / operator review keeps sendability, promise pressure and trust-sensitive wording from being flattened too early."
        : "创始人 / 操作员复核会持续防止发送评估、承诺压力和信任敏感措辞被过早说实。",
    ],
    customerOfferPageNextAction: buildCustomerOfferNextActions({
      id: detail.id,
      sendabilityMode,
      english,
    }),
    customerOfferPageRiskSignal: riskSignal,
    customerOfferPageSendabilityMode: sendabilityMode,
    customerOfferPageEvidenceGroups: buildEvidenceGroups(detail, english),
    customerOfferPageCustomerFacingCue: english
      ? "Use outward-facing value framing only; keep scope and promise language soft."
      : "当前只允许用对外价值措辞；范围和承诺语言都必须保持柔性。",
    customerOfferPageInternalOnlyCue: english
      ? "Scope negotiation notes, dependency cleanup and trust-sensitive review comments stay internal-only."
      : "范围协商备注、依赖清理和信任敏感复核评论仍只适合仅内部。",
    customerOfferPageNonCommitmentCue: english
      ? "This offer version is still non-commitment wording until a human explicitly approves any stronger reinforcement."
      : "当前这版报价仍属于非承诺措辞，除非人工明确批准更强加固。",
    pageWhyItMatters: [
      english
        ? `The opportunity is already in a ${detail.stageLabel} window, so the outward wording now directly changes whether momentum keeps warming or falls back into internal hesitation.`
        : `当前机会已经进入「${detail.stageLabel}」窗口，所以现在的对外措辞会直接影响它是继续升温，还是重新退回内部犹豫。`,
      signals.openCommitmentCount
        ? english
          ? `${signals.openCommitmentCount} open commitments are still shaping trust pressure, so the next offer wording cannot pretend certainty that has not been earned yet.`
          : `当前仍有 ${signals.openCommitmentCount} 条开放承诺在影响信任压力，所以下一版报价措辞不能假装已经获得了还没被兑现的确定性。`
        : english
          ? "There is no single open commitment dominating the page, so this is the right moment to decide how far the external-safe wording can go."
          : "当前没有单条开放承诺主导整个页面，所以现在正适合决定可对外措辞能走到哪一步。",
      english
        ? "The current page already separates what can go outward from what must remain internal, so the remaining value is deciding sendability, not rediscovering context."
        : "当前页已经把哪些能对外、哪些必须内部保留分开了，所以现在真正要决定的是发送评估，而不是重新拼上下文。",
    ],
    pageEscalationHint:
      sendabilityMode === "not_safe_to_send" ||
      sendabilityMode === "review_before_send"
        ? english
          ? "If anyone wants to harden promise, timing or scope, escalate into approvals before anything leaves review."
          : "如果任何人想把承诺、时点或范围说实，就先升级进审批，再允许任何内容离开复核。"
        : english
          ? "If trust pressure or dependency pressure rises, step back from the customer-facing offer and return to package review first."
          : "如果信任压力或依赖压力开始上升，就先从客户可见报价退回方案包复核。",
    pageEvidenceLinks: [
      {
        label: english ? "Open package page" : "打开方案包页面",
        href: `/packages/${detail.id}`,
      },
      {
        label: english ? "Open approvals" : "打开审批中心",
        href: "/approvals",
      },
      {
        label: english ? "Open memory trace" : "查看记忆痕迹",
        href: `/memory?objectType=OPPORTUNITY&objectId=${detail.id}`,
      },
    ],
  });
}

export function buildExternalProposalPageContract({
  detail,
  english,
}: {
  detail: ProposalPackageCommercialDetail;
  english: boolean;
}): ExternalProposalPageDetailReportingContract {
  const signals = summarizeExternalExpressionSignals(detail);
  const sendabilityMode = getExternalProposalSendabilityMode(detail, signals);
  const riskSignal = mapRiskSignal(detail.riskLevel, signals);
  const collaborationMode =
    sendabilityMode === "safe_to_send" ||
    sendabilityMode === "safe_with_boundary"
      ? "helm_prepares_human_decides"
      : sendabilityMode === "review_before_send" ||
          sendabilityMode === "not_safe_to_send"
        ? "helm_reminds_human_leads"
        : "helm_drives_human_supervises";

  return createExternalProposalPageDetailReportingContract({
    externalProposalPageJudgement: buildExternalProposalJudgement(
      sendabilityMode,
      english,
    ),
    externalProposalPageJudgementReason:
      detail.briefingSnapshot?.payload.summary ??
      (english
        ? "The current external-proposal window already brings package framing, trust pressure, open commitments and the latest review line together."
        : "当前外部提案准备窗口已经把方案包措辞、信任压力、开放承诺和最新复核线收在一起。"),
    externalProposalPageActionSummary: [
      english
        ? "An external-safe proposal structure is already prepared, together with the current boundary, prerequisite and dependency notes."
        : "当前已经准备好一版可对外提案结构，并把边界、前置和依赖备注一起收好。",
      signals.pendingApprovalCount
        ? english
          ? `${signals.pendingApprovalCount} approval-sensitive actions are still blocking the outward gate, so this page stays explicit about review-before-send.`
          : `当前仍有 ${signals.pendingApprovalCount} 条审批敏感动作挡在对外闸口前，所以这页会明确保持发送前复核。`
        : english
          ? "The latest blocker, commitment and sendability context are already grouped so the team can review one proposal surface instead of raw rows."
          : "最新阻塞、承诺和发送评估上下文都已经被分组收好，团队现在可以复核同一个提案面，而不是原始数据行。",
      english
        ? "Discussion-only wording, safe-with-boundary wording and internal-only review notes are already separated."
        : "仅讨论措辞、带边界可说措辞和仅内部复核备注已经区分开了。",
    ],
    externalProposalPageDecisionRequest: [
      english
        ? `Decide whether this stays ${labelForSendabilityMode(sendabilityMode, true)} or should step back into package review before any external move.`
        : `决定这版当前是继续保持「${labelForSendabilityMode(sendabilityMode, false)}」，还是在任何对外动作前先退回方案包复核。`,
      english
        ? "Decide who owns the next review-before-send gate, and whether founder, sales or delivery needs to co-sign the next version."
        : "决定下一道发送前复核闸口由谁接，以及创始人、销售、交付是否需要共同确认下一版。",
    ],
    externalProposalPageBoundarySummary: [
      english
        ? "External proposal wording can never silently absorb internal-only caveats, dependency cleanup or unresolved scope notes."
        : "外部提案措辞不能悄悄吸收仅内部注脚、依赖清理或未解决的范围备注。",
      buildBoundaryLineForSendability(sendabilityMode, english),
      english
        ? "Recommendation, discussion-only language and proposal reinforcement still do not equal commitment."
        : "建议、仅讨论语言和提案加固仍然不等于承诺。",
    ],
    externalProposalPageEvidenceSummary: [
      english
        ? `${detail.auditLogs.length} audit changes, ${detail.actionItems.length} linked actions and the full sendability trace are already grouped in the appendix.`
        : `当前 ${detail.auditLogs.length} 条审计变化、${detail.actionItems.length} 条关联动作和完整发送评估轨迹都已经分组收在附注层。`,
      english
        ? "Replay, audit, memory, worker output, boundary trace, sendability trace and historical changes stay available for verification."
        : "回放、审计、经营记忆、执行输出、边界轨迹、发送评估轨迹和历史变更都保留给核验，但不会打断主叙事。",
    ],
    externalProposalPageWorkerSummary: [
      english
        ? "Sales worker keeps the external-safe narrative and next-step call-to-action aligned."
        : "销售执行会持续把可对外叙事和下一步号召动作对齐。",
      english
        ? "Delivery / founder review keeps dependency, scope and promise pressure visible before anything becomes sendable."
        : "交付 / 创始人复核会在任何内容变成可发送之前，持续把依赖、范围和承诺压力挂在前台。",
    ],
    externalProposalPageNextAction: buildExternalProposalNextActions({
      id: detail.id,
      sendabilityMode,
      english,
    }),
    externalProposalPageRiskSignal: riskSignal,
    externalProposalPageSendabilityMode: sendabilityMode,
    externalProposalPageEvidenceGroups: buildEvidenceGroups(detail, english),
    externalProposalPageCustomerFacingCue: english
      ? "Only external-safe proposal wording may move outward; keep claims scoped and reversible."
      : "当前只允许使用可对外提案措辞对外；所有表述都必须保持范围明确且可回退。",
    externalProposalPageInternalOnlyCue: english
      ? "Internal objections, scope tension and dependency repair notes remain review-only."
      : "内部异议、范围张力和依赖修复备注仍然只适合复核层使用。",
    externalProposalPageNonCommitmentCue: english
      ? "This external proposal remains non-commitment unless a human explicitly approves stronger reinforcement."
      : "当前外部提案仍属于非承诺，除非人工明确批准更强加固。",
    externalProposalPageCollaborationMode: collaborationMode,
    externalProposalPageCollaborationSummary:
      sendabilityMode === "safe_to_send" ||
      sendabilityMode === "safe_with_boundary"
        ? english
          ? "A sendability review surface is already prepared, but a human still decides whether the next version is safe enough to move."
          : "当前已经准备好可发送复核面，但下一版是否足够安全仍由人工决定。"
        : english
          ? "The proposal still needs coordinated review before anyone treats it as ready for outward use."
          : "这版提案在任何人把它视为可对外使用之前，仍需要联合复核。",
    externalProposalPageCollaborationRequest: english
      ? "Use this page to decide sendability, reinforcement strength and review ownership before anything customer-visible leaves the system."
      : "先在这一页决定发送评估、加固强度和复核负责人归属，再让任何客户可见内容离开系统。",
    externalProposalPageCollaborationNextStep: [
      english
        ? "Confirm whether the next version stays discussion-only, review-before-send or safe-with-boundary."
        : "确认下一版到底继续仅讨论、发送前复核，还是进入带边界可说。",
      english
        ? "Confirm whether founder, sales or delivery must co-sign the next outward expression."
        : "确认下一次对外表达是否需要创始人、销售、交付共同确认。",
    ],
    externalProposalPageCollaborationOwner:
      detail.ownerName ??
      (english
        ? "Sales owner + founder review"
        : "销售负责人 + 创始人复核"),
    pageWhyItMatters: [
      english
        ? `The opportunity is already at ${detail.stageLabel}, so the external proposal wording now shapes whether the next commercial move builds trust or overreaches.`
        : `当前机会已经来到「${detail.stageLabel}」窗口，所以现在的外部提案措辞会直接决定下一步商业动作是建立信任，还是过度伸出。`,
      signals.blockerCount
        ? english
          ? `${signals.blockerCount} blockers and ${signals.openCommitmentCount} open commitments still shape whether the proposal can safely move outward.`
          : `当前 ${signals.blockerCount} 个阻塞和 ${signals.openCommitmentCount} 条开放承诺，仍在决定提案能否安全向外移动。`
        : english
          ? "There is room to move the proposal outward, but only if the sendability boundary stays explicit."
          : "当前确实存在把提案向外推进的空间，但前提是发送评估边界必须一直显式可见。",
      english
        ? "The proposal-safe version is already prepared, so the remaining value is deciding whether the next expression should move, pause or fall back."
        : "当前提案安全版本已经准备好，所以现在真正的价值在于决定下一次表达是继续、暂停，还是先退回。",
    ],
    pageEscalationHint:
      sendabilityMode === "safe_to_send" ||
      sendabilityMode === "safe_with_boundary"
        ? english
          ? "If anyone starts hardening promise, delivery certainty or irreversible expectation, route the next version into approvals first."
          : "如果任何人开始把承诺、交付确定性或不可逆预期说实，就先把下一版送进审批。"
        : english
          ? "If sendability weakens further, step back into package review and keep the proposal discussion-only."
          : "如果发送评估继续走弱，就先退回方案包复核，并把提案保持在仅讨论。",
    pageEvidenceLinks: [
      {
        label: english
          ? "Open customer offer page"
          : "打开客户可见报价页面",
        href: `/offers/${detail.id}`,
      },
      {
        label: english ? "Open approvals" : "打开审批中心",
        href: "/approvals",
      },
      {
        label: english ? "Open memory trace" : "查看记忆痕迹",
        href: `/memory?objectType=OPPORTUNITY&objectId=${detail.id}`,
      },
    ],
  });
}

function summarizeExternalExpressionSignals(
  detail: ProposalPackageCommercialDetail,
) {
  const blockerCount = detail.blockers.length;
  const openCommitmentCount = detail.commitments.filter(
    (item) => item.status !== "FULFILLED",
  ).length;
  const pendingApprovalCount = detail.actionItems.filter(
    (item) => item.approvalTask?.status === "PENDING",
  ).length;
  const missingPrerequisiteCount = [
    detail.ownerName ? 0 : 1,
    detail.nextAction ? 0 : 1,
  ].reduce((sum, value) => sum + value, 0);

  return {
    blockerCount,
    openCommitmentCount,
    pendingApprovalCount,
    missingPrerequisiteCount,
  };
}

function getCustomerOfferSendabilityMode(
  detail: ProposalPackageCommercialDetail,
  signals: ReturnType<typeof summarizeExternalExpressionSignals>,
): CustomerFacingOfferExternalProposalSendabilityMode {
  if (detail.riskLevel === "CRITICAL" || signals.pendingApprovalCount > 0) {
    return "not_safe_to_send";
  }

  if (detail.riskLevel === "HIGH") {
    return "review_before_send";
  }

  if (signals.missingPrerequisiteCount > 0) {
    return "safe_with_prerequisite";
  }

  if (signals.blockerCount > 0) {
    return "safe_with_dependency";
  }

  if (signals.openCommitmentCount > 0) {
    return "safe_with_boundary";
  }

  return "safe_to_send";
}

function getExternalProposalSendabilityMode(
  detail: ProposalPackageCommercialDetail,
  signals: ReturnType<typeof summarizeExternalExpressionSignals>,
): CustomerFacingOfferExternalProposalSendabilityMode {
  if (detail.riskLevel === "CRITICAL" || signals.pendingApprovalCount > 0) {
    return "not_safe_to_send";
  }

  if (detail.riskLevel === "HIGH" || signals.blockerCount > 0) {
    return "review_before_send";
  }

  if (signals.missingPrerequisiteCount > 0) {
    return "safe_with_prerequisite";
  }

  if (signals.openCommitmentCount > 1) {
    return "discussion_only";
  }

  if (signals.openCommitmentCount === 1) {
    return "safe_with_boundary";
  }

  return "safe_to_send";
}

function mapRiskSignal(
  riskLevel: ProposalPackageCommercialDetail["riskLevel"],
  signals: ReturnType<typeof summarizeExternalExpressionSignals>,
): CustomerFacingOfferExternalProposalRiskSignal {
  if (
    riskLevel === "HIGH" ||
    riskLevel === "CRITICAL" ||
    signals.pendingApprovalCount > 0
  ) {
    return "high";
  }

  if (
    signals.blockerCount > 0 ||
    signals.openCommitmentCount > 0 ||
    signals.missingPrerequisiteCount > 0
  ) {
    return "caution";
  }

  return "watch";
}

function buildCustomerOfferJudgement(
  mode: CustomerFacingOfferExternalProposalSendabilityMode,
  english: boolean,
) {
  if (mode === "safe_to_send") {
    return english
      ? "This customer-facing offer is safe-to-send, but the non-commitment line must stay explicit."
      : "当前客户可见报价已经可发送，但非承诺线仍必须显式保留。";
  }
  if (mode === "safe_with_boundary") {
    return english
      ? "This customer-facing offer can move outward only if the boundary note stays attached."
      : "当前客户可见报价只有带着边界备注一起出现时，才适合继续向外。";
  }
  if (mode === "safe_with_prerequisite") {
    return english
      ? "This customer-facing offer still needs prerequisite confirmation before it can move outward safely."
      : "当前客户可见报价仍需要先确认前置，才适合安全向外推进。";
  }
  if (mode === "safe_with_dependency") {
    return english
      ? "This customer-facing offer can only move with visible dependency notes, not as standalone wording."
      : "当前客户可见报价只能带着依赖备注一起移动，不能作为独立文案单独外发。";
  }
  if (mode === "discussion_only") {
    return english
      ? "This customer-facing offer is discussion-only and should not be treated as sendable copy."
      : "当前客户可见报价仍是仅讨论，不应被当成可直接外发文案。";
  }
  if (mode === "review_before_send") {
    return english
      ? "This customer-facing offer remains review-before-send and should not be sent yet."
      : "当前客户可见报价仍然是发送前复核，还不能直接外发。";
  }
  return english
    ? "This customer-facing offer is not-safe-to-send and should stay in internal review."
    : "当前客户可见报价仍然不可发送，应继续停留在内部复核。";
}

function buildExternalProposalJudgement(
  mode: CustomerFacingOfferExternalProposalSendabilityMode,
  english: boolean,
) {
  if (mode === "safe_to_send") {
    return english
      ? "This external proposal can enter a sendable review pass, but the non-commitment line still belongs to the visible boundary layer."
      : "当前外部提案可以进入可发送复核，但非承诺线仍必须留在可见边界层。";
  }
  if (mode === "safe_with_boundary") {
    return english
      ? "This external proposal can move outward only with visible boundary wording attached."
      : "当前外部提案只有连同可见边界措辞一起出现时，才适合继续向外。";
  }
  if (mode === "safe_with_prerequisite") {
    return english
      ? "This external proposal still needs prerequisite confirmation before it can move beyond review."
      : "当前外部提案仍需要先确认前置，才适合离开复核层。";
  }
  if (mode === "safe_with_dependency") {
    return english
      ? "This external proposal is only safe if dependency notes remain visible and unresolved scope stays explicit."
      : "当前外部提案只有在依赖备注持续可见、未解决范围仍然显式时才算安全。";
  }
  if (mode === "discussion_only") {
    return english
      ? "This external proposal is discussion-only and should not be treated as a promise-bearing document."
      : "当前外部提案仍是仅讨论，不应被当成可承载承诺的正式文本。";
  }
  if (mode === "review_before_send") {
    return english
      ? "This external proposal remains review-before-send and should not leave the system yet."
      : "当前外部提案仍然是发送前复核，还不适合离开系统。";
  }
  return english
    ? "This external proposal is not-safe-to-send and must stay in internal review."
    : "当前外部提案仍然不可发送，必须继续停留在内部复核。";
}

function buildBoundaryLineForSendability(
  mode: CustomerFacingOfferExternalProposalSendabilityMode,
  english: boolean,
) {
  if (mode === "safe_to_send") {
    return english
      ? "Safe-to-send still means send-safe wording, not contract-level commitment."
      : "可发送只代表当前措辞可以安全发送，不代表合同级承诺。";
  }
  if (mode === "safe_with_boundary") {
    return english
      ? "Safe-with-boundary means the outward wording must keep the explicit boundary note attached."
      : "带边界可说表示对外措辞必须连同显式边界备注一起出现。";
  }
  if (mode === "safe_with_prerequisite") {
    return english
      ? "Safe-with-prerequisite means nothing should move outward until the named prerequisite is closed."
      : "带前置可说表示在命名前置条件收口之前，任何内容都不应继续向外移动。";
  }
  if (mode === "safe_with_dependency") {
    return english
      ? "Safe-with-dependency means the dependency note cannot be dropped or hidden from the main reading path."
      : "带依赖可说表示依赖备注不能被拿掉，也不能被藏进附录。";
  }
  if (mode === "discussion_only") {
    return english
      ? "Discussion-only means the page can support discussion, but not promise, reinforcement or implied commitment."
      : "仅讨论表示当前页面只适合讨论，不适合承诺、强化预期或暗示承诺。";
  }
  if (mode === "review_before_send") {
    return english
      ? "Review-before-send means the wording must stay behind review before anyone sends or reinforces it."
      : "发送前复核表示当前措辞必须继续停在复核后面，任何人都不能先发或先强化。";
  }
  return english
    ? "Not-safe-to-send means the current version must not leave internal review."
    : "不可发送表示当前版本不能离开内部复核。";
}

function buildCustomerOfferNextActions({
  id,
  sendabilityMode,
  english,
}: {
  id: string;
  sendabilityMode: CustomerFacingOfferExternalProposalSendabilityMode;
  english: boolean;
}) {
  const primaryHref =
    sendabilityMode === "safe_to_send" ||
    sendabilityMode === "safe_with_boundary"
      ? `/external-proposals/${id}`
      : `/packages/${id}`;
  const primaryLabel =
    sendabilityMode === "safe_to_send" ||
    sendabilityMode === "safe_with_boundary"
      ? english
        ? "Open external proposal page"
        : "打开外部提案页面"
      : english
        ? "Return to package page"
        : "回到方案包页面";

  return [
    {
      label: primaryLabel,
      href: primaryHref,
    },
    {
      label: english ? "Open approvals" : "打开审批中心",
      href: "/approvals",
      variant: "secondary" as const,
    },
    {
      label: english ? "Open evidence" : "查看依据",
      href: `/memory?objectType=OPPORTUNITY&objectId=${id}`,
      variant: "ghost" as const,
    },
  ];
}

function buildExternalProposalNextActions({
  id,
  sendabilityMode,
  english,
}: {
  id: string;
  sendabilityMode: CustomerFacingOfferExternalProposalSendabilityMode;
  english: boolean;
}) {
  const primaryHref =
    sendabilityMode === "not_safe_to_send" ||
    sendabilityMode === "review_before_send"
      ? "/approvals"
      : `/offers/${id}`;
  const primaryLabel =
    sendabilityMode === "not_safe_to_send" ||
    sendabilityMode === "review_before_send"
      ? english
        ? "Open approvals"
        : "打开审批中心"
      : english
        ? "Open customer offer page"
        : "打开客户可见报价页面";

  return [
    {
      label: primaryLabel,
      href: primaryHref,
    },
    {
      label: english ? "Open package page" : "打开方案包页面",
      href: `/packages/${id}`,
      variant: "secondary" as const,
    },
    {
      label: english ? "Open evidence" : "查看依据",
      href: `/memory?objectType=OPPORTUNITY&objectId=${id}`,
      variant: "ghost" as const,
    },
  ];
}

function buildEvidenceGroups(
  detail: ProposalPackageCommercialDetail,
  english: boolean,
): CustomerFacingOfferExternalProposalEvidenceGroup[] {
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
                  ? `${log.actor} · ${log.summary} · ${formatRelative(log.createdAt)}`
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
      label: english ? "Memory" : "经营记忆",
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
      label: english ? "Boundary trace" : "边界轨迹",
      items: [
        detail.blockers.length
          ? english
            ? `${detail.blockers.length} blockers remain visible in the current outward judgement.`
            : `当前对外判断里仍挂着 ${detail.blockers.length} 个阻塞。`
          : english
            ? "No structured blocker is currently dominating the outward boundary trace."
            : "当前没有结构化阻塞主导对外边界痕迹。",
        detail.commitments.length
          ? english
            ? `${detail.commitments.length} commitments are still shaping whether the next version can move outward safely.`
            : `当前有 ${detail.commitments.length} 条承诺在影响下一版能否安全向外移动。`
          : english
            ? "No active commitment is holding the current boundary line."
            : "当前没有活跃承诺正在卡边界。",
      ],
    },
    {
      groupId: "sendability_trace",
      label: english ? "Sendability trace" : "发送评估轨迹",
      items: [
        detail.actionItems.some(
          (item) => item.approvalTask?.status === "PENDING",
        )
          ? english
            ? "Approval-sensitive actions are still open, so the next outward move must stay review-before-send."
            : "当前仍有审批敏感动作未收口，所以下一步对外动作必须继续保持发送前复核。"
          : english
            ? "No active approval task is directly blocking the current outward wording."
            : "当前没有活跃审批任务直接挡在当前对外措辞前面。",
        detail.nextAction
          ? english
            ? `Helm is tracing sendability against the recorded next move: ${detail.nextAction}`
            : `Helm 正在根据台账中的下一步动作判断发送评估：${detail.nextAction}`
          : english
            ? "No recorded next move yet; sendability stays cautious."
            : "当前还没有明确记录的下一步动作，所以发送评估仍保持谨慎。",
      ],
    },
    {
      groupId: "historical_changes",
      label: english ? "Historical changes" : "历史变化",
      items: [
        english
          ? `Last updated ${formatRelative(detail.updatedAt)}`
          : `最后更新于 ${formatRelative(detail.updatedAt)}`,
        english
          ? `Current due date: ${formatDateLabel(detail.dueDate)}`
          : `当前截止时间：${formatDateLabel(detail.dueDate)}`,
      ],
    },
  ];
}

function labelForSendabilityMode(
  mode: CustomerFacingOfferExternalProposalSendabilityMode,
  english: boolean,
) {
  if (mode === "safe_to_send") {
    return english ? "safe-to-send" : "可安全发送";
  }
  if (mode === "safe_with_boundary") {
    return english ? "safe-with-boundary" : "带边界可发送";
  }
  if (mode === "safe_with_prerequisite") {
    return english ? "safe-with-prerequisite" : "补齐前置后可发送";
  }
  if (mode === "safe_with_dependency") {
    return english ? "safe-with-dependency" : "带依赖说明可发送";
  }
  if (mode === "discussion_only") {
    return english ? "discussion-only" : "仅适合讨论";
  }
  if (mode === "review_before_send") {
    return english ? "review-before-send" : "发送前复核";
  }
  return english ? "not-safe-to-send" : "不可发送";
}
