import type { BusinessLoopGapSummary } from "@/lib/operating-system/operating-gap";

export type BusinessLoopGapSurfaceConnection = {
  label: string;
  value: string;
  description: string;
  href?: string;
};

export type BusinessLoopGapSurfaceReadout = {
  primaryGap: BusinessLoopGapSummary["primaryGap"];
  blocker?: string;
  pendingDecision?: string;
  nextAction?: string;
  connection?: BusinessLoopGapSurfaceConnection;
};

function formatBusinessLoopGapText(value: string, english: boolean) {
  if (english) {
    return value;
  }

  const knownLabels: Record<string, string> = {
    "KPI link pending": "缺结果口径",
    "KPI link stale": "结果口径过期",
    "Missing KPI link": "缺结果口径",
    "Owner missing": "缺负责人",
    "Next action missing": "缺下一步",
    "Evidence missing": "缺客户证据",
    "Unresolved truth conflict": "客户事实冲突",
  };
  const known = knownLabels[value];
  if (known) {
    return known;
  }

  const staleMetrics = value.match(
    /^The current operating loop still points at a stale coordination metrics snapshot from ([0-9-]+), so KPI linkage needs a fresh baseline before it can guide current judgement\.$/,
  );
  if (staleMetrics) {
    return `${staleMetrics[1]} 的结果基线已过期，先刷新再判断。`;
  }

  if (
    value ===
    "Current operating loop still has no coordination metrics snapshot, so outcome movement cannot be compared against a current KPI or baseline readout yet."
  ) {
    return "缺当前 KPI 或周报基线，暂时不能判断结果变化。";
  }

  if (
    value ===
    "Write one daily coordination metrics snapshot or attach one current report baseline before treating this loop as measurable."
  ) {
    return "先补每日指标或接入当前周报。";
  }

  if (
    value ===
    "Refresh the coordination metrics snapshot or connect a current report baseline before ranking this loop by outcome movement."
  ) {
    return "先刷新指标或接入当前周报，再看结果排序。";
  }

  if (value === "The main loop still lacks KPI grounding.") {
    return "缺当前结果口径。";
  }

  if (value === "Bind the current review block to a KPI owner.") {
    return "指定结果负责人。";
  }

  return value
    .replace(/\bcurrent operating loop\b/gi, "当前经营闭环")
    .replace(/\bstale coordination metrics snapshot\b/gi, "旧协同指标快照")
    .replace(/\bcoordination metrics snapshot\b/gi, "协同指标快照")
    .replace(/\bKPI linkage\b/gi, "KPI 关联")
    .replace(/\bfresh baseline\b/gi, "新基线")
    .replace(/\bcurrent judgement\b/gi, "当前判断")
    .replace(/\breview block\b/gi, "复核区块")
    .replace(/\breview\b/gi, "复核")
    .replace(/\bowner\b/gi, "负责人")
    .replace(/\bloop gaps\b/gi, "闭环缺口")
    .replace(/\bloop gap\b/gi, "闭环缺口")
    .replace(
      /([\u4e00-\u9fff])\s+(负责人|复核|闭环缺口|当前经营闭环|旧协同指标快照|协同指标快照|KPI 关联|新基线|当前判断)/g,
      "$1$2",
    );
}

function joinGapReadout(title: string, body: string, english: boolean) {
  return `${formatBusinessLoopGapText(title, english)} · ${formatBusinessLoopGapText(body, english)}`;
}

export function buildBusinessLoopGapReadout({
  english,
  businessLoopGapSummary,
  fallbackHref,
}: {
  english: boolean;
  businessLoopGapSummary: BusinessLoopGapSummary;
  fallbackHref?: string;
}): BusinessLoopGapSurfaceReadout {
  const primaryGap = businessLoopGapSummary.primaryGap;

  if (!primaryGap) {
    return {
      primaryGap,
      blocker: undefined,
      pendingDecision: undefined,
      nextAction: undefined,
      connection: undefined,
    };
  }

  return {
    primaryGap,
    blocker: joinGapReadout(primaryGap.title, primaryGap.summary, english),
    pendingDecision: primaryGap.operatorReviewRequired
      ? joinGapReadout(primaryGap.title, primaryGap.summary, english)
      : undefined,
    nextAction: primaryGap.nextActionHint
      ? joinGapReadout(primaryGap.title, primaryGap.nextActionHint, english)
      : undefined,
    connection: {
      label: english ? "Loop gap" : "闭环缺口",
      value: formatBusinessLoopGapText(primaryGap.title, english),
      description:
        businessLoopGapSummary.reviewRequired > 1
          ? `${formatBusinessLoopGapText(primaryGap.summary, english)} · ${businessLoopGapSummary.reviewRequired} ${
              english ? "loop gaps still need review" : "条闭环缺口仍待复核"
            }`
          : formatBusinessLoopGapText(primaryGap.summary, english),
      href: primaryGap.href ?? fallbackHref,
    },
  };
}
