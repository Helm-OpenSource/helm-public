type PayoutRailReadinessStatus = "NOT_READY" | "CONDITIONAL_GO" | "READY_FOR_NARROW_PILOT";

type PayoutRailReadinessWatchpoint =
  | "NO_MANUAL_COMPLETION_EVIDENCE"
  | "NO_INVITED_OR_ACTIVE_PARTICIPANTS"
  | "NO_REVERSAL_EVIDENCE"
  | "PAID_WITHOUT_EXPORT_ANOMALIES";

type PaidWithoutExportReadoutScope = "proof" | "readiness" | "exception";

export function buildPaidWithoutExportOperatorReadout(input: {
  english: boolean;
  paidWithoutExportCount: number;
  scope: PaidWithoutExportReadoutScope;
}) {
  if (input.scope === "proof") {
    return input.english
      ? `Audit ${input.paidWithoutExportCount} paid line(s) that still lack export evidence, attach the missing export record or correct the settlement status, and only then count them as completion proof.`
      : `先审计这 ${input.paidWithoutExportCount} 条仍缺少导出证据的已支付条目，补齐导出记录或更正结算状态，然后再把它们计入完成证明。`;
  }

  if (input.scope === "readiness") {
    return input.english
      ? `Clear the ${input.paidWithoutExportCount} paid-without-export line(s) before treating the current gate as credible rail-readiness evidence.`
      : `先清掉这 ${input.paidWithoutExportCount} 条已支付但缺导出证据的条目，再把当前闸口当成可信的支付通道准备度证据。`;
  }

  return input.english
    ? `Resolve the ${input.paidWithoutExportCount} paid-without-export anomaly line(s) first so settlement proof, readiness, and exception readouts stay aligned.`
    : `先处理这 ${input.paidWithoutExportCount} 条已支付但缺导出证据的异常条目，保证结算证明、准备度和异常读面保持一致。`;
}

export function buildPayoutRailReadinessNarrative(input: {
  english: boolean;
  status: PayoutRailReadinessStatus;
  paidWithoutExportCount: number;
  watchpoints: PayoutRailReadinessWatchpoint[];
}) {
  if (input.status === "READY_FOR_NARROW_PILOT") {
    return input.english
      ? "Current-main has enough internal proof to justify a future narrow payout-rail pilot. This gate still does not mean payout execution already exists."
      : "当前主线已经积累出足够的内部证据，可以评估未来一条窄的支付通道试点。这仍然不代表支付执行能力已经存在。";
  }

  if (input.status === "CONDITIONAL_GO") {
    if (input.watchpoints.includes("PAID_WITHOUT_EXPORT_ANOMALIES") && input.paidWithoutExportCount > 0) {
      return input.english
        ? `Current-main has the manual settlement foundation, but ${input.paidWithoutExportCount} paid line(s) still lack export evidence. Audit those lines before treating them as completion proof, keep payout manual for now, and only consider a narrow rail pilot after the watchpoints are cleared.`
        : `当前主线已经有手工结算基础，但仍有 ${input.paidWithoutExportCount} 条已支付条目缺少导出证据。先完成这些条目的审计，再把它们当成完成证明；现在仍应保持手工结算，只在观察点清掉后再考虑窄的支付通道试点。`;
    }

    return input.english
      ? "Current-main has the manual settlement foundation, but some operating proof is still thin. Keep payout manual for now and only consider a narrow rail pilot after the watchpoints are cleared."
      : "当前主线已经有手工结算基础，但运营证据还不够厚。现在仍应保持手工结算，只在观察点清掉后再考虑窄的支付通道试点。";
  }

  return input.english
    ? "Current-main should stay off-platform for payout. At least one readiness blocker is still open, so a payout-rail PR would be premature."
    : "当前主线仍应停在站外支付。至少还有一个准备度阻塞未清，所以现在接支付通道还太早。";
}

export function buildSettlementOpsProofNarrative(input: {
  english: boolean;
  requiredBeneficiaryCount: number;
  paidWithoutExportCount: number;
}) {
  if (input.requiredBeneficiaryCount === 0) {
    return input.english
      ? "No payable beneficiary scopes are recorded yet. Keep using this block to check when the first proof path should be created."
      : "当前还没有实际记录的可结算受益方范围。这里会继续提示什么时候该开始补第一条证明路径。";
  }

  if (input.paidWithoutExportCount > 0) {
    return input.english
      ? `Current-main has ${input.requiredBeneficiaryCount} beneficiary scopes that should be able to move through payout profile coverage, participant access, and manual settlement. This card keeps missing evidence visible, and it also flags ${input.paidWithoutExportCount} paid line(s) that still need export-evidence audit before they are treated as credible completion proof.`
      : `当前主线已经有 ${input.requiredBeneficiaryCount} 个受益方范围应当能走通结算资料、参与方访问和手工结算。这张卡会先把缺失的运营证据讲清楚，同时标出 ${input.paidWithoutExportCount} 条仍需补做导出证据审计的已支付条目，避免把它们过早当成可信的完成证明。`;
  }

  return input.english
    ? `Current-main has ${input.requiredBeneficiaryCount} beneficiary scopes that should be able to move through payout profile coverage, participant access, and manual settlement. This card keeps the missing evidence visible before any rail discussion starts.`
    : `当前主线已经有 ${input.requiredBeneficiaryCount} 个受益方范围应当能走通结算资料、参与方访问和手工结算。这张卡会先把缺失的运营证据讲清楚，再去讨论支付通道。`;
}

export function buildSettlementExceptionNarrative(input: {
  english: boolean;
  openExceptionCount: number;
  paidWithoutExportCount: number;
  reversalCount: number;
}) {
  if (input.openExceptionCount > 0) {
    if (input.paidWithoutExportCount > 0) {
      return input.english
        ? `Current-main has ${input.openExceptionCount} open settlement exceptions, including ${input.paidWithoutExportCount} paid line(s) that still lack export evidence. Audit those lines before counting them as proof, and keep reversals explicit instead of letting settlement posture drift silently.`
        : `当前主线还有 ${input.openExceptionCount} 条未处理的结算异常，其中有 ${input.paidWithoutExportCount} 条已支付条目仍缺少导出证据。先完成这些条目的审计，再把它们计入证明；冲回也要继续保持显式，而不是让结算姿态静默漂移。`;
    }

    return input.english
      ? `Current-main has ${input.openExceptionCount} open settlement exceptions. Keep them explicit before any payout-rail discussion, and use reversals as manual evidence instead of silent state drift.`
      : `当前主线还有 ${input.openExceptionCount} 条未处理的结算异常。先把它们讲清楚，再讨论支付通道；冲回也要作为显式人工证据，而不是静默状态漂移。`;
  }

  if (input.reversalCount > 0) {
    return input.english
      ? `There are no open settlement exceptions right now, and current-main already has ${input.reversalCount} reversal evidence lines. Keep the posture manual, explicit, and operator-readable.`
      : `当前没有开放的结算异常，而且主线已经有 ${input.reversalCount} 条冲回证据。继续保持手工、显式、运营可读的姿态即可。`;
  }

  return input.english
    ? "No settlement exceptions or reversal evidence are visible yet. Use this block to keep exported, blocked, or reversed posture readable before any rail work starts."
    : "当前还没有可见的结算异常或冲回证据。这里会先把已导出、受阻或已冲回的姿态讲清楚，再讨论支付通道。";
}
