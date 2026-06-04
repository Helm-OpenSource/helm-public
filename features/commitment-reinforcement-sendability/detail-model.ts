import type {
  CommitmentReinforcementPageDetailReportingContract,
  CommitmentReinforcementSendabilityEvidenceGroup,
  CommitmentReinforcementSendabilityRiskSignal,
  CommitmentReinforcementStrengthMode,
  SendabilityPageDetailReportingContract,
  SendabilityPageMode,
} from "@/lib/presentation/commitment-reinforcement-sendability-detail-contract";
import {
  createCommitmentReinforcementPageDetailReportingContract,
  createSendabilityPageDetailReportingContract,
} from "@/lib/presentation/commitment-reinforcement-sendability-detail-contract";
import type { ProposalPackageCommercialDetail } from "@/features/proposal-package/proposal-package-detail-view";
import { formatDateLabel, formatRelative, trimText } from "@/lib/utils";

export function buildCommitmentReinforcementPageContract({
  detail,
  english,
}: {
  detail: ProposalPackageCommercialDetail;
  english: boolean;
}): CommitmentReinforcementPageDetailReportingContract {
  const signals = summarizeSignals(detail);
  const strengthMode = getReinforcementStrengthMode(detail, signals);
  const sendabilityMode = getSendabilityPageMode(detail, signals);
  const riskSignal = mapRiskSignal(detail.riskLevel, signals);

  return createCommitmentReinforcementPageDetailReportingContract({
    reinforcementPageJudgement: buildReinforcementJudgement(
      strengthMode,
      sendabilityMode,
      english,
    ),
    reinforcementPageJudgementReason:
      detail.briefingSnapshot?.payload.summary ??
      (english
        ? "The current reinforcement surface already brings trust pressure, open commitments, blocker pressure and the latest outward wording together."
        : "当前这张加固决策面已经把信任压力、开放承诺、阻塞压力和最新对外措辞收在一起。"),
    reinforcementPageActionSummary: [
      english
        ? "The current page already separates recommendation, reinforcement candidates, customer-visible wording and internal-only review notes."
        : "当前页已经把 recommendation、加固候选、客户可见措辞和仅内部复核备注分开了。",
      signals.pendingApprovalCount
        ? english
          ? `${signals.pendingApprovalCount} approval-sensitive actions are still open, so reinforcement cannot silently cross into customer-visible commitment.`
          : `当前仍有 ${signals.pendingApprovalCount} 条审批敏感动作未收口，所以加固不能悄悄越过客户可见承诺边界。`
        : english
          ? "The current strengthening window, boundary note and next-step context are already grouped into one page."
          : "当前加固窗口、边界备注和下一步上下文都已经被收进同一页。",
      english
        ? "You do not need to reverse-engineer confidence from raw fields first; the current strengthening level is already explicit."
        : "你不需要先从原始字段里倒推信心强弱；当前加固层级已经说清楚了。",
    ],
    reinforcementPageDecisionRequest: [
      english
        ? `Confirm whether this stays ${labelForStrengthMode(strengthMode, true)} or should step back to discussion-only / boundary-only reinforcement.`
        : `确认这版当前是继续保持「${labelForStrengthMode(strengthMode, false)}」，还是需要退回讨论态 / 边界态强化。`,
      english
        ? "Confirm whether founder, sales or delivery needs to co-sign the next strengthening move before anything customer-visible gets stronger."
        : "确认在任何客户可见表达继续加强之前，是否需要创始人、销售、交付共同确认。",
    ],
    reinforcementPageBoundarySummary: [
      english
        ? "Reinforcement can strengthen clarity, confidence and next-step pressure, but it cannot silently harden into customer-visible commitment."
        : "加固可以加强清晰度、信心和下一步压力，但不能悄悄硬化成客户可见承诺。",
      buildBoundaryLineForStrengthMode(strengthMode, english),
      english
        ? "Recommendation, discussion-only and boundary-only reinforcement still do not equal commitment."
        : "recommendation、仅讨论 和仅边界加固仍然不等于承诺。",
    ],
    reinforcementPageEvidenceSummary: [
      english
        ? `${detail.auditLogs.length} audit changes, ${detail.actionItems.length} linked actions and the full reinforcement trace are grouped below without interrupting the main narrative.`
        : `当前 ${detail.auditLogs.length} 条审计变化、${detail.actionItems.length} 条关联动作和完整加固轨迹已经分组收在下面，不会打断主叙事。`,
      english
        ? "Replay, audit, memory, worker output, boundary trace, sendability trace, reinforcement trace and historical changes remain available on demand."
        : "回放、审计、经营记忆、执行输出、边界轨迹、发送评估轨迹、加固轨迹和历史变更都在附注层按需可看。",
    ],
    reinforcementPageWorkerSummary: [
      english
        ? "Sales worker keeps strengthening candidates, objection-safe options and softer alternatives visible."
        : "销售执行会持续把加固候选、异议安全版本和更柔性的替代表达挂在前台。",
      english
        ? "Founder / operator review keeps promise pressure, sendability and customer trust from being overstated too early."
        : "创始人 /操作员复核会持续防止承诺压力、发送评估和客户信任被过早说实。",
    ],
    reinforcementPageNextAction: buildReinforcementNextActions({
      id: detail.id,
      strengthMode,
      sendabilityMode,
      english,
    }),
    reinforcementPageRiskSignal: riskSignal,
    reinforcementPageStrengthMode: strengthMode,
    reinforcementPageSendabilityMode: sendabilityMode,
    reinforcementPageEvidenceGroups: buildEvidenceGroups(
      detail,
      strengthMode,
      sendabilityMode,
      english,
    ),
    reinforcementPageCustomerVisibleCue: english
      ? "Only customer-visible strengthening that keeps scope, timing and promise language reversible may move outward."
      : "只有仍然保持范围、时点和承诺语言可回退的客户可见加固，才允许继续向外。",
    reinforcementPageInternalOnlyCue: english
      ? "Trust-sensitive objections, scope tension and unresolved dependency repair notes stay internal-only."
      : "信任敏感异议、范围张力和未解决的依赖修复备注仍然只适合仅内部。",
    reinforcementPageNonCommitmentCue: english
      ? "Even the strongest current reinforcement is still non-commitment unless a human explicitly approves a stronger promise line."
      : "即使当前是更强的加固，也仍属于非承诺，除非人工明确批准更强承诺话术。",
    pageWhyItMatters: [
      english
        ? `The opportunity is already at ${detail.stageLabel}, so the tone of the next outward expression now changes trust, urgency and whether momentum keeps warming.`
        : `当前机会已经来到「${detail.stageLabel}」窗口，所以下一次对外表达的强度会直接影响信任、紧迫感以及动能是否继续升温。`,
      signals.openCommitmentCount
        ? english
          ? `${signals.openCommitmentCount} open commitments are still shaping trust pressure, so stronger wording cannot pretend certainty that has not been earned yet.`
          : `当前仍有 ${signals.openCommitmentCount} 条开放承诺在影响信任压力，所以更强的措辞不能假装已经获得了还没被兑现的确定性。`
        : english
          ? "There is room to strengthen wording, but only if the boundary and sendability layers stay visible."
          : "当前确实存在强化表达的空间，但前提是边界层和发送评估层必须持续可见。",
      english
        ? "The current page already separates what can become stronger from what must remain soft or internal-only, so the remaining value is deciding reinforcement level, not rediscovering context."
        : "当前页已经把哪些可以更强、哪些必须继续保持柔性或仅内部分开了，所以现在真正要决定的是加固层级，而不是重新拼上下文。",
    ],
    pageEscalationHint:
      strengthMode === "reinforcement-blocked" ||
      sendabilityMode === "review-before-send" ||
      sendabilityMode === "not-safe-to-send"
        ? english
          ? "If anyone wants to harden promise, certainty or irreversible timing, escalate into approvals before anything gets stronger."
          : "如果任何人想把承诺、确定性或不可逆时点说实，就先升级进审批，再允许任何内容继续强化。"
        : english
          ? "If risk pressure or dependency pressure rises, step back from reinforcement and return to boundary-only review first."
          : "如果风险压力或依赖压力上升，就先从加固退回仅边界复核。",
    pageEvidenceLinks: [
      {
        label: english
          ? "Open external proposal page"
          : "打开对外提案页面",
        href: `/external-proposals/${detail.id}`,
      },
      {
        label: english ? "Open sendability page" : "打开发送评估页面",
        href: `/sendability/${detail.id}`,
      },
      {
        label: english ? "Open memory trace" : "查看记忆痕迹",
        href: `/memory?objectType=OPPORTUNITY&objectId=${detail.id}`,
      },
    ],
  });
}

export function buildSendabilityPageContract({
  detail,
  english,
}: {
  detail: ProposalPackageCommercialDetail;
  english: boolean;
}): SendabilityPageDetailReportingContract {
  const signals = summarizeSignals(detail);
  const strengthMode = getReinforcementStrengthMode(detail, signals);
  const sendabilityMode = getSendabilityPageMode(detail, signals);
  const riskSignal = mapRiskSignal(detail.riskLevel, signals);

  return createSendabilityPageDetailReportingContract({
    sendabilityPageJudgement: buildSendabilityJudgement(
      sendabilityMode,
      strengthMode,
      english,
    ),
    sendabilityPageJudgementReason:
      detail.briefingSnapshot?.payload.summary ??
      (english
        ? "The current sendability surface already brings the sendability gate, review pressure, boundary trace and strengthening candidates together."
        : "当前这张发送边界决策面已经把发送关口、复核压力、边界记录和强化候选收在一起。"),
    sendabilityPageActionSummary: [
      english
        ? "The current judgement page already groups sendability, reinforcement level, review notes and boundary traces."
        : "当前判断页已经把发送边界、强化程度、复核说明和边界记录收在一起。",
      signals.pendingApprovalCount
        ? english
          ? `${signals.pendingApprovalCount} approval-sensitive actions are still open, so this page keeps review-before-send explicit instead of hiding it in notes.`
          : `当前仍有 ${signals.pendingApprovalCount} 条审批敏感动作未收口，所以这页会把发送前复核放在前台，而不是藏进附注。`
        : english
          ? "The current outward-safe version, blocker summary and next-step context are already aligned."
          : "当前对外安全版本、阻塞摘要和下一步上下文都已经对齐。",
      english
        ? "You do not need to infer sendability from risk alone; send-safe, review-only and blocked states are already separated."
        : "你不需要只靠风险去猜发送边界；可安全发送、仅复核和被阻塞状态已经分开了。",
    ],
    sendabilityPageDecisionRequest: [
      english
        ? `Confirm whether this stays ${labelForSendabilityMode(sendabilityMode, true)} or should step back behind review.`
        : `确认这版当前是继续保持「${labelForSendabilityMode(sendabilityMode, false)}」，还是应该重新退回复核后面。`,
      english
        ? "Confirm who owns the next sendability gate, and whether risk mitigation or dependency closure must happen before anything moves outward."
        : "确认下一道发送关口由谁接，以及在任何内容继续向外移动之前，是否必须先完成风险缓解或依赖收口。",
    ],
    sendabilityPageBoundarySummary: [
      english
        ? "Sendability is never only about wording polish; it is also about prerequisite, dependency, risk note and non-commitment discipline."
        : "发送边界从来不只是措辞打磨问题，它同样取决于前置条件、依赖、风险说明和非承诺纪律。",
      buildBoundaryLineForSendability(sendabilityMode, english),
      english
        ? "Discussion-only, review-before-send and not-safe-to-send states still override any temptation to imply commitment."
        : "仅讨论、发送前复核和当前不能发送，仍然优先于任何想要暗示承诺的冲动。",
    ],
    sendabilityPageEvidenceSummary: [
      english
        ? `${detail.auditLogs.length} audit changes, ${detail.memoryFacts.length} memory facts and the full sendability trace are already grouped in the appendix.`
        : `当前 ${detail.auditLogs.length} 条审计变化、${detail.memoryFacts.length} 条记忆事实和完整发送边界记录都已经分组收在附注层。`,
      english
        ? "Replay, audit, memory, worker output, boundary trace, sendability trace, reinforcement trace and historical changes stay available for verification."
        : "回放、审计、记忆、执行单元输出、边界记录、发送边界记录、强化记录和历史变化都保留给核验，但不会打断主叙事。",
    ],
    sendabilityPageWorkerSummary: [
      english
        ? "Sales worker keeps the next outward-safe move visible, while founder / operator review holds the sendability gate."
        : "销售协作者会持续把下一步对外安全动作挂在前台，而创始人 / 操作人复核会守住发送关口。",
      english
        ? "Delivery context keeps prerequisite, dependency and implementation risk from being flattened into a false safe-to-send signal."
        : "交付上下文会持续防止前置条件、依赖和实施风险被压扁成错误的可安全发送信号。",
    ],
    sendabilityPageNextAction: buildSendabilityNextActions({
      id: detail.id,
      sendabilityMode,
      strengthMode,
      english,
    }),
    sendabilityPageRiskSignal: riskSignal,
    sendabilityPageMode: sendabilityMode,
    sendabilityPageStrengthMode: strengthMode,
    sendabilityPageEvidenceGroups: buildEvidenceGroups(
      detail,
      strengthMode,
      sendabilityMode,
      english,
    ),
    sendabilityPageCustomerVisibleCue: english
      ? "Only send-safe wording may leave this page; anything stronger still needs visible boundary control."
      : "只有可安全发送的措辞可以离开这一页；任何更强的表达都仍需要显式边界控制。",
    sendabilityPageInternalOnlyCue: english
      ? "Internal-only review notes, scope tension and unresolved objections remain behind the sendability gate."
      : "仅内部复核说明、范围张力和未解决异议仍然停留在发送关口后面。",
    sendabilityPageNonCommitmentCue: english
      ? "Safe-to-send still means send-safe, not commitment-safe."
      : "可安全发送仍然只代表发送安全，不代表承诺安全。",
    pageWhyItMatters: [
      english
        ? `The opportunity is already in a ${detail.stageLabel} window, so sendability now decides whether the next move builds trust, pauses safely or creates avoidable risk.`
        : `当前机会已经进入「${detail.stageLabel}」窗口，所以发送边界现在决定的是下一步动作会建立信任、保持安全暂停，还是制造本可避免的风险。`,
      signals.blockerCount
        ? english
          ? `${signals.blockerCount} blockers and ${signals.pendingApprovalCount} approval-sensitive actions are still shaping whether anything can leave review safely.`
          : `当前 ${signals.blockerCount} 个阻塞和 ${signals.pendingApprovalCount} 条审批敏感动作，仍在决定任何内容能否安全离开复核。`
        : english
          ? "There is room to move outward, but only if prerequisite, dependency and risk notes remain visible."
          : "当前确实存在向外推进的空间，但前提是前置、依赖和风险备注必须持续可见。",
      english
        ? "The current page already separates send-safe, boundary-bound and blocked states, so the remaining value is deciding the next gate, not rediscovering context."
        : "当前页已经把 可发送、边界-bound 和受阻状态分开了，所以现在真正的价值在于决定下一道闸口，而不是重新拼上下文。",
    ],
    pageEscalationHint:
      sendabilityMode === "not-safe-to-send" ||
      sendabilityMode === "review-before-send" ||
      sendabilityMode === "internal-only"
        ? english
          ? "If anyone wants to bypass the gate, escalate into approvals before any customer-visible wording becomes stronger."
          : "如果任何人想绕过当前闸口，就先升级进审批，再允许任何客户可见措辞继续加强。"
        : english
          ? "If reinforcement starts outrunning boundary clarity, step back into reinforcement review first."
          : "如果加固开始跑在边界 clarity 前面，就先退回加固复核。",
    pageEvidenceLinks: [
      {
        label: english ? "Open reinforcement page" : "打开加固页面",
        href: `/reinforcements/${detail.id}`,
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

function summarizeSignals(detail: ProposalPackageCommercialDetail) {
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
  const workerPreparedCount =
    detail.actionItems.length +
    (detail.briefingSnapshot?.payload.recommendedNextSteps?.length ?? 0);

  return {
    blockerCount,
    openCommitmentCount,
    pendingApprovalCount,
    missingPrerequisiteCount,
    workerPreparedCount,
  };
}

function getReinforcementStrengthMode(
  detail: ProposalPackageCommercialDetail,
  signals: ReturnType<typeof summarizeSignals>,
): CommitmentReinforcementStrengthMode {
  if (
    !detail.nextAction &&
    !detail.briefingSnapshot?.payload.recommendedNextSteps?.length &&
    signals.openCommitmentCount === 0
  ) {
    return "no-reinforcement";
  }

  if (detail.riskLevel === "CRITICAL" || signals.pendingApprovalCount > 0) {
    return "reinforcement-blocked";
  }

  if (detail.riskLevel === "HIGH" || signals.blockerCount > 0) {
    return "reinforcement-after-risk-reduction";
  }

  if (signals.missingPrerequisiteCount > 0) {
    return "reinforcement-deferred";
  }

  if (signals.openCommitmentCount > 1) {
    return "reinforcement-after-review";
  }

  if (signals.openCommitmentCount === 1) {
    return "boundary-only-reinforcement";
  }

  if (detail.riskLevel === "MEDIUM") {
    return "internal-reinforcement-only";
  }

  return "customer-visible-reinforcement";
}

function getSendabilityPageMode(
  detail: ProposalPackageCommercialDetail,
  signals: ReturnType<typeof summarizeSignals>,
): SendabilityPageMode {
  if (
    signals.missingPrerequisiteCount > 1 &&
    !detail.briefingSnapshot?.payload.summary
  ) {
    return "internal-only";
  }

  if (detail.riskLevel === "CRITICAL") {
    return "not-safe-to-send";
  }

  if (signals.pendingApprovalCount > 0) {
    return "review-before-send";
  }

  if (detail.riskLevel === "HIGH" && signals.blockerCount > 0) {
    return "review-before-send";
  }

  if (detail.riskLevel === "HIGH") {
    return "safe-with-risk-note";
  }

  if (signals.missingPrerequisiteCount > 0) {
    return "safe-with-prerequisite";
  }

  if (signals.blockerCount > 0) {
    return "safe-with-dependency";
  }

  if (signals.openCommitmentCount > 1) {
    return "discussion-only";
  }

  if (signals.openCommitmentCount === 1) {
    return "safe-with-boundary";
  }

  return "safe-to-send";
}

function mapRiskSignal(
  riskLevel: ProposalPackageCommercialDetail["riskLevel"],
  signals: ReturnType<typeof summarizeSignals>,
): CommitmentReinforcementSendabilityRiskSignal {
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

function buildReinforcementJudgement(
  strengthMode: CommitmentReinforcementStrengthMode,
  sendabilityMode: SendabilityPageMode,
  english: boolean,
) {
  if (strengthMode === "customer-visible-reinforcement") {
    return english
      ? "This page supports customer-visible reinforcement, but the non-commitment line must stay explicit."
      : "当前这页支持进入客户可见加固，但非承诺线仍必须显式保留。";
  }
  if (strengthMode === "boundary-only-reinforcement") {
    return english
      ? "This page supports only boundary-only reinforcement, not stronger promise-bearing language."
      : "当前这页只支持仅边界加固，不支持更强的承诺型语言。";
  }
  if (strengthMode === "internal-reinforcement-only") {
    return english
      ? "This page supports internal-reinforcement-only work, so the wording should not harden outward yet."
      : "当前这页只支持仅内部加固，暂时不适合把措辞向外说实。";
  }
  if (strengthMode === "reinforcement-after-review") {
    return english
      ? "Reinforcement can happen only after another review pass closes the remaining trust pressure."
      : "当前强化表达只能在再做一轮复核、收口剩余信任压力之后再继续。";
  }
  if (strengthMode === "reinforcement-after-risk-reduction") {
    return english
      ? "Reinforcement should wait until the current risk is reduced; otherwise stronger wording will outrun reality."
      : "当前强化表达应该先等风险被压下来；否则更强措辞会跑在现实前面。";
  }
  if (strengthMode === "reinforcement-blocked") {
    return english
      ? "Reinforcement is currently blocked and must not cross the current review and approval gate."
      : "当前强化表达已被阻断，不能越过现有复核和审批关口。";
  }
  if (strengthMode === "reinforcement-deferred") {
    return english
      ? "Reinforcement is currently deferred until prerequisite and ownership details are clearer."
      : "当前强化表达已被延后，必须等前提和负责人更清楚之后再继续。";
  }
  if (strengthMode === "no-reinforcement") {
    return english
      ? "There is no reinforcement to make yet; the current wording should stay soft and exploratory."
      : "当前还没有进入强化表达的理由；现有措辞应继续保持柔性且探索性。";
  }
  return english
    ? `Reinforcement should stay constrained because the current sendability is still ${sendabilityMode}.`
    : `当前加固仍应保持克制，因为发送评估仍停留在「${labelForSendabilityMode(sendabilityMode, false)}」。`;
}

function buildSendabilityJudgement(
  sendabilityMode: SendabilityPageMode,
  strengthMode: CommitmentReinforcementStrengthMode,
  english: boolean,
) {
  if (sendabilityMode === "safe-to-send") {
    return english
      ? "This page is safe-to-send, but send-safe still does not equal commitment-safe."
      : "当前这页已经 可发送，但 可发送 仍不等于承诺安全。";
  }
  if (sendabilityMode === "safe-with-boundary") {
    return english
      ? "This page can move outward only if the boundary note stays attached."
      : "当前这页只有在边界备注始终挂在前台时，才适合继续向外。";
  }
  if (sendabilityMode === "safe-with-prerequisite") {
    return english
      ? "This page still needs prerequisite confirmation before anything can move outward safely."
      : "当前这页仍需要先确认前置，任何内容才能安全向外推进。";
  }
  if (sendabilityMode === "safe-with-dependency") {
    return english
      ? "This page is only safe if dependency notes remain visible and unresolved work stays explicit."
      : "当前这页只有在依赖备注持续可见、未解决工作仍然显式时才算安全。";
  }
  if (sendabilityMode === "safe-with-risk-note") {
    return english
      ? "This page can move outward only with a visible risk note; otherwise the current risk will be underrepresented."
      : "当前这页只有带着风险备注一起出现时才适合向外移动，否则会低估当前风险。";
  }
  if (sendabilityMode === "discussion-only") {
    return english
      ? "This page is discussion-only and should not be treated as a sendable reinforcement surface."
      : "当前这页仍是仅讨论，不应被当成可外发的加固面。";
  }
  if (sendabilityMode === "review-before-send") {
    return english
      ? "This page remains review-before-send and should not leave review yet."
      : "当前这页仍然是发送前复核，还不适合离开复核。";
  }
  if (sendabilityMode === "internal-only") {
    return english
      ? "This page is currently internal-only and does not yet support any outward move."
      : "当前这页仍是仅内部，暂时不支持任何向外移动。";
  }
  return english
    ? `This page is not-safe-to-send; reinforcement must stay behind review while the current ${strengthMode} pressure is resolved.`
    : `当前这页仍然不可发送；在当前「${labelForStrengthMode(strengthMode, false)}」压力被收口之前，加固必须继续停留在复核后面。`;
}

function buildBoundaryLineForStrengthMode(
  strengthMode: CommitmentReinforcementStrengthMode,
  english: boolean,
) {
  if (strengthMode === "customer-visible-reinforcement") {
    return english
      ? "Customer-visible reinforcement still means stronger framing, not stronger commitment."
      : "客户可见加固仍然只代表更强措辞，不代表更强承诺。";
  }
  if (strengthMode === "boundary-only-reinforcement") {
    return english
      ? "Boundary-only reinforcement means the strengthening can happen only if the explicit boundary line stays visible."
      : "仅边界加固表示只有在显式边界一直可见时，才能继续强化。";
  }
  if (strengthMode === "internal-reinforcement-only") {
    return english
      ? "Internal-reinforcement-only means the strengthening work is real, but it must stay inside review."
      : "仅内部加固表示强化工作是真实的，但必须继续停留在复核内部。";
  }
  if (strengthMode === "reinforcement-after-review") {
    return english
      ? "Reinforcement-after-review means no strengthening should leave review until another pass explicitly clears it."
      : "复核后加固表示在下一轮复核明确放行之前，任何强化表达都不应离开复核。";
  }
  if (strengthMode === "reinforcement-after-risk-reduction") {
    return english
      ? "Reinforcement-after-risk-reduction means stronger wording must wait until the current risk note becomes smaller, not quieter."
      : "「风险降低后再加固」的意思是：更强措辞必须等风险真的变小，而不是只是在页面上变安静。";
  }
  if (strengthMode === "reinforcement-blocked") {
    return english
      ? "Reinforcement-blocked means the current page cannot legitimately strengthen anything customer-visible yet."
      : "强化表达被阻断表示当前页面还不能合理强化任何客户可见表达。";
  }
  if (strengthMode === "reinforcement-deferred") {
    return english
      ? "Reinforcement-deferred means prerequisite and ownership still need to close before stronger language appears."
      : "强化表达延后表示前提和负责人仍需先收口，之后才适合出现更强语言。";
  }
  return english
    ? "No-reinforcement means the current wording should stay exploratory and light."
    : "暂不强化表示当前措辞应继续保持探索性和轻量。";
}

function buildBoundaryLineForSendability(
  mode: SendabilityPageMode,
  english: boolean,
) {
  if (mode === "safe-to-send") {
    return english
      ? "Safe-to-send still means send-safe wording, not customer-visible commitment."
      : "可发送 只代表当前措辞可以安全发送，不代表客户可见承诺。";
  }
  if (mode === "safe-with-boundary") {
    return english
      ? "Safe-with-boundary means the outward wording must keep the explicit boundary note attached."
      : "带边界可说表示对外措辞必须连同显式边界备注一起出现。";
  }
  if (mode === "safe-with-prerequisite") {
    return english
      ? "Safe-with-prerequisite means nothing should move outward until the named prerequisite is closed."
      : "带前置可说表示在命名前置条件收口之前，任何内容都不应继续向外移动。";
  }
  if (mode === "safe-with-dependency") {
    return english
      ? "Safe-with-dependency means the dependency note cannot be dropped or hidden from the main reading path."
      : "带依赖可说表示依赖备注不能被拿掉，也不能被藏进附录。";
  }
  if (mode === "safe-with-risk-note") {
    return english
      ? "Safe-with-risk-note means the outward wording must keep the active risk note visible."
      : "safe-with-risk-note 表示对外措辞必须持续把当前风险备注挂在前台。";
  }
  if (mode === "discussion-only") {
    return english
      ? "Discussion-only means the page can support discussion, but not promise, reinforcement or implied commitment."
      : "仅讨论 表示当前页面只适合讨论，不适合承诺、强化预期或暗示承诺。";
  }
  if (mode === "review-before-send") {
    return english
      ? "Review-before-send means the wording must stay behind review before anyone sends or reinforces it."
      : "发送前复核表示当前措辞必须继续停在复核后面，任何人都不能先发或先强化。";
  }
  if (mode === "internal-only") {
    return english
      ? "Internal-only means nothing from this page should be treated as customer-visible yet."
      : "仅内部表示当前这页的任何内容都不应被当成客户可见。";
  }
  return english
    ? "Not-safe-to-send means the current version must not leave internal review."
    : "不可发送表示当前版本不能离开内部复核。";
}

function buildReinforcementNextActions({
  id,
  strengthMode,
  sendabilityMode,
  english,
}: {
  id: string;
  strengthMode: CommitmentReinforcementStrengthMode;
  sendabilityMode: SendabilityPageMode;
  english: boolean;
}) {
  const primaryHref =
    strengthMode === "customer-visible-reinforcement" ||
    strengthMode === "boundary-only-reinforcement"
      ? `/external-proposals/${id}`
      : strengthMode === "reinforcement-blocked" ||
          sendabilityMode === "review-before-send" ||
          sendabilityMode === "not-safe-to-send"
        ? "/approvals"
        : `/offers/${id}`;

  const primaryLabel =
    primaryHref === "/approvals"
      ? english
        ? "Open approvals"
        : "打开审批中心"
      : primaryHref.startsWith("/external-proposals/")
        ? english
          ? "Open external proposal page"
          : "打开对外提案页面"
        : english
          ? "Open customer-facing offer page"
          : "打开客户可见 offer 页面";

  return [
    {
      label: primaryLabel,
      href: primaryHref,
    },
    {
      label: english ? "Open sendability page" : "打开发送评估页面",
      href: `/sendability/${id}`,
      variant: "secondary" as const,
    },
    {
      label: english ? "Open evidence" : "查看依据",
      href: `/memory?objectType=OPPORTUNITY&objectId=${id}`,
      variant: "ghost" as const,
    },
  ];
}

function buildSendabilityNextActions({
  id,
  sendabilityMode,
  strengthMode,
  english,
}: {
  id: string;
  sendabilityMode: SendabilityPageMode;
  strengthMode: CommitmentReinforcementStrengthMode;
  english: boolean;
}) {
  const primaryHref =
    sendabilityMode === "safe-to-send" ||
    sendabilityMode === "safe-with-boundary"
      ? `/external-proposals/${id}`
      : sendabilityMode === "review-before-send" ||
          sendabilityMode === "not-safe-to-send" ||
          sendabilityMode === "internal-only"
        ? "/approvals"
        : `/reinforcements/${id}`;

  const primaryLabel =
    primaryHref === "/approvals"
      ? english
        ? "Open approvals"
        : "打开审批中心"
      : primaryHref.startsWith("/external-proposals/")
        ? english
          ? "Open external proposal page"
          : "打开对外提案页面"
        : english
          ? "Open reinforcement page"
          : "打开加固页面";

  return [
    {
      label: primaryLabel,
      href: primaryHref,
    },
    {
      label:
        strengthMode === "customer-visible-reinforcement"
          ? english
            ? "Open customer-facing offer page"
            : "打开客户可见 offer 页面"
          : english
            ? "Open reinforcement page"
            : "打开加固页面",
      href:
        strengthMode === "customer-visible-reinforcement"
          ? `/offers/${id}`
          : `/reinforcements/${id}`,
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
  strengthMode: CommitmentReinforcementStrengthMode,
  sendabilityMode: SendabilityPageMode,
  english: boolean,
): CommitmentReinforcementSendabilityEvidenceGroup[] {
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
              .map(
                (log) =>
                  `${log.actor} · ${log.summary} · ${formatRelativeLabel(log.createdAt, english)}`,
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
                    : `事实：${fact.title}：${trimText(fact.content, 80)}`,
                ),
              ...detail.memoryEntries
                .slice(0, 1)
                .map((entry) =>
                  english
                    ? `${entry.title}: ${trimText(entry.content, 72)}`
                    : `记忆：${entry.title}：${trimText(entry.content, 72)}`,
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
            ? `${detail.blockers.length} blockers remain visible in the current boundary line.`
            : `当前边界线里仍挂着 ${detail.blockers.length} 个阻塞。`
          : english
            ? "No structured blocker is currently dominating the boundary trace."
            : "当前没有结构化阻塞主导边界痕迹。",
        detail.commitments.length
          ? english
            ? `${detail.commitments.length} commitments are still shaping whether the next version can become stronger safely.`
            : `当前有 ${detail.commitments.length} 条承诺在影响下一版能否安全变强。`
          : english
            ? "No active commitment is holding the current boundary line."
            : "当前没有活跃承诺正在卡边界线。",
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
            ? "Approval-sensitive actions are still open, so the next outward move must stay behind review."
            : "当前仍有审批敏感动作未收口，所以下一步对外动作必须继续停留在复核后面。"
          : english
            ? "No active approval task is directly blocking the current outward wording."
            : "当前没有活跃审批任务直接挡在当前对外措辞前面。",
        english
          ? `Helm is tracking sendability as ${sendabilityMode}.`
          : `Helm 当前把发送评估判断为「${labelForSendabilityMode(sendabilityMode, false)}」。`,
      ],
    },
    {
      groupId: "reinforcement_trace",
      label: english ? "Reinforcement trace" : "加固轨迹",
      items: [
        english
          ? `Helm is currently holding reinforcement at ${strengthMode}.`
          : `Helm 当前把加固层级判断为「${labelForStrengthMode(strengthMode, false)}」。`,
        detail.nextAction
          ? english
            ? `The current strengthening pressure is anchored to the recorded next move: ${detail.nextAction}`
            : `当前加固压力主要锚定在台账中的下一步：${detail.nextAction}`
          : english
            ? "No recorded next move yet; stronger wording stays cautious."
            : "当前还没有明确记录的下一步动作，所以更强措辞仍保持谨慎。",
      ],
    },
    {
      groupId: "historical_changes",
      label: english ? "Historical changes" : "历史变化",
      items: [
        english
          ? `Last updated ${formatRelativeLabel(detail.updatedAt, true)}`
          : `最后更新于 ${formatRelative(detail.updatedAt)}`,
        english
          ? `Current due date: ${formatDateLabelForLocale(detail.dueDate, true)}`
          : `当前截止时间：${formatDateLabel(detail.dueDate)}`,
      ],
    },
  ];
}

function formatRelativeLabel(value: Date | string | null | undefined, english: boolean) {
  if (!english) {
    return formatRelative(value);
  }
  if (!value) {
    return "none";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  const diffMs = date.getTime() - Date.now();
  const absoluteMs = Math.abs(diffMs);
  const minuteMs = 60_000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  const formatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  if (absoluteMs < hourMs) {
    return formatter.format(Math.round(diffMs / minuteMs), "minute");
  }
  if (absoluteMs < dayMs) {
    return formatter.format(Math.round(diffMs / hourMs), "hour");
  }
  return formatter.format(Math.round(diffMs / dayMs), "day");
}

function formatDateLabelForLocale(value: Date | string | null | undefined, english: boolean) {
  if (!english) {
    return formatDateLabel(value);
  }
  if (!value) {
    return "Not set";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function labelForStrengthMode(
  mode: CommitmentReinforcementStrengthMode,
  english: boolean,
) {
  switch (mode) {
    case "no-reinforcement":
      return english ? "no-reinforcement" : "暂无加固";
    case "internal-reinforcement-only":
      return english
        ? "internal-reinforcement-only"
        : "仅内部加固";
    case "customer-visible-reinforcement":
      return english
        ? "customer-visible-reinforcement"
        : "客户可见加固";
    case "reinforcement-after-review":
      return english
        ? "reinforcement-after-review"
        : "复核后加固";
    case "reinforcement-after-risk-reduction":
      return english
        ? "reinforcement-after-risk-reduction"
        : "风险降低后加固";
    case "reinforcement-blocked":
      return english ? "reinforcement-blocked" : "加固受阻";
    case "reinforcement-deferred":
      return english ? "reinforcement-deferred" : "加固延后";
    default:
      return english
        ? "boundary-only-reinforcement"
        : "仅边界加固";
  }
}

function labelForSendabilityMode(mode: SendabilityPageMode, english: boolean) {
  switch (mode) {
    case "safe-to-send":
      return english ? "safe-to-send" : "可安全发送";
    case "safe-with-boundary":
      return english ? "safe-with-boundary" : "带边界可发送";
    case "safe-with-prerequisite":
      return english ? "safe-with-prerequisite" : "补齐前置后可发送";
    case "safe-with-dependency":
      return english ? "safe-with-dependency" : "带依赖说明可发送";
    case "safe-with-risk-note":
      return english ? "safe-with-risk-note" : "带风险提示可发送";
    case "discussion-only":
      return english ? "discussion-only" : "仅适合讨论";
    case "review-before-send":
      return english ? "review-before-send" : "发送前复核";
    case "internal-only":
      return english ? "internal-only" : "仅内部";
    default:
      return english ? "not-safe-to-send" : "不可发送";
  }
}
