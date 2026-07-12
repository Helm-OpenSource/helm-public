/**
 * 经营主线（operating mainline）内部契约 —— 蓝图 Phase 1 的契约内部化。
 *
 * 本模块只在 Core 内部使用（蓝图 §3.2：Phase 1 类型内部化、零对外承诺）；
 * Phase 2 经 owner 授权后才把等价形状开放进 PackContributions（experimental）。
 *
 * 铁律（蓝图 §4.1）：
 * - 数据条目只读/只导航：不存在动作回调字段；href 必须站内绝对路径。
 * - 三态 measured | pending_source | no_data，禁止用推断值冒充 measured。
 * - 徽标词表无执行态（能力真值：最高到"建议已就绪·待人工确认"）。
 * - needsHuman 等计数为 team/node 级聚合，无个人排名形状。
 * - "最老卡点时长" = asOf − oldestBlockedSince，两端 ISO-8601，UI 确定性计算。
 */

export type ShellReadoutStatus = "measured" | "pending_source" | "no_data";

/** 接管程度四态（V1，无执行态词汇）。 */
export type MainlineNodeStage =
  | "unbound"
  | "observing"
  | "suggesting"
  | "suggestion_ready_pending_human";

export type MainlineNode = {
  key: string;
  label: string;
  stage: MainlineNodeStage;
  status: ShellReadoutStatus;
  inFlightCount: number | null;
  oldestBlockedSince: string | null;
  oldestBlockedRef: string | null;
  needsHuman: number | null;
  href: string | null;
  basisRef: string;
  pendingSourceNote?: string;
};

export type MainlineReadout = {
  asOf: string;
  asOfBasisRef?: string;
  nodes: ReadonlyArray<MainlineNode>;
};

const MIN_NODES = 1;
const MAX_NODES = 8;

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function isInSitePath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (value.includes(":") || value.includes("\\")) return false;
  return value.length <= 500;
}

export type MainlineConformanceIssue = { nodeKey: string | null; issue: string };

/**
 * Conformance 校验（蓝图 §3.2 Phase 1 条件三件之一）。
 * 返回全部违规项；空数组 = 通过。渲染端对不通过的 readout 整体降级为
 * "主线暂不可用"卡（fail-open 不空屏），不部分渲染。
 */
export function validateMainlineReadout(
  readout: MainlineReadout,
): MainlineConformanceIssue[] {
  const issues: MainlineConformanceIssue[] = [];
  if (!ISO_TIMESTAMP_PATTERN.test(readout.asOf)) {
    issues.push({ nodeKey: null, issue: "asOf_not_iso8601" });
  }
  if (
    readout.nodes.length < MIN_NODES ||
    readout.nodes.length > MAX_NODES
  ) {
    issues.push({ nodeKey: null, issue: "node_count_out_of_range" });
  }
  const seenKeys = new Set<string>();
  for (const node of readout.nodes) {
    if (seenKeys.has(node.key)) {
      issues.push({ nodeKey: node.key, issue: "duplicate_node_key" });
    }
    seenKeys.add(node.key);
    for (const [field, value] of Object.entries(node)) {
      if (typeof value === "function") {
        issues.push({ nodeKey: node.key, issue: `callback_field:${field}` });
      }
    }
    if (node.status !== "measured") {
      if (
        node.inFlightCount !== null ||
        node.needsHuman !== null ||
        node.oldestBlockedSince !== null ||
        node.oldestBlockedRef !== null
      ) {
        issues.push({ nodeKey: node.key, issue: "non_measured_carries_values" });
      }
    }
    const sinceNull = node.oldestBlockedSince === null;
    const refNull = node.oldestBlockedRef === null;
    if (sinceNull !== refNull) {
      issues.push({ nodeKey: node.key, issue: "blocked_pair_null_mismatch" });
    }
    if (node.oldestBlockedSince !== null) {
      if (!ISO_TIMESTAMP_PATTERN.test(node.oldestBlockedSince)) {
        issues.push({ nodeKey: node.key, issue: "blocked_since_not_iso8601" });
      } else if (
        ISO_TIMESTAMP_PATTERN.test(readout.asOf) &&
        Date.parse(node.oldestBlockedSince) > Date.parse(readout.asOf)
      ) {
        issues.push({ nodeKey: node.key, issue: "blocked_since_after_asOf" });
      }
    }
    if (node.href !== null && !isInSitePath(node.href)) {
      issues.push({ nodeKey: node.key, issue: "href_not_in_site" });
    }
    if ((node.inFlightCount ?? 0) < 0 || (node.needsHuman ?? 0) < 0) {
      issues.push({ nodeKey: node.key, issue: "negative_count" });
    }
  }
  return issues;
}

export type CoreDefaultMainlineInput = {
  asOf: string;
  english: boolean;
  counts: {
    /** 今日需拍板事项数（升舱自 home-work-entry）；null = 源不可用 */
    judgementPending: number | null;
    /** 人审队列（approvals）；null = 源不可用 */
    reviewQueue: number | null;
    /** 在途推进对象数（机会/承诺）；null = 源不可用 */
    advanceInFlight: number | null;
  };
};

/**
 * Core 默认主线（信号 → 判断 → 复核 → 推进 → 证据）。
 * 未接源节点诚实 pending_source / unbound——开源镜像观感不得靠造数（蓝图 §7）。
 */
export function buildCoreDefaultMainline(
  input: CoreDefaultMainlineInput,
): MainlineReadout {
  const { english, counts } = input;
  const t = (zh: string, en: string) => (english ? en : zh);
  const pendingNote = t("数据源接入中", "Data source pending");
  const node = (
    key: string,
    labelZh: string,
    labelEn: string,
    stage: MainlineNodeStage,
    count: number | null,
    needsHuman: number | null,
    href: string | null,
  ): MainlineNode => {
    const measured = count !== null || needsHuman !== null;
    return {
      key,
      label: t(labelZh, labelEn),
      stage,
      status: measured ? "measured" : "pending_source",
      inFlightCount: measured ? count : null,
      oldestBlockedSince: null,
      oldestBlockedRef: null,
      needsHuman: measured ? needsHuman : null,
      href,
      basisRef: `core-default-mainline:${key}`,
      ...(measured ? {} : { pendingSourceNote: pendingNote }),
    };
  };
  return {
    asOf: input.asOf,
    nodes: [
      node("signal", "信号", "Signals", "observing", null, null, "/operating"),
      node(
        "judgement",
        "判断",
        "Judgement",
        "suggesting",
        counts.judgementPending,
        counts.judgementPending,
        "/dashboard?stay=1#employee-assignment-actions",
      ),
      node(
        "review",
        "复核",
        "Review",
        "suggestion_ready_pending_human",
        counts.reviewQueue,
        counts.reviewQueue,
        "/approvals",
      ),
      node(
        "advance",
        "推进",
        "Advance",
        "observing",
        counts.advanceInFlight,
        null,
        "/opportunities",
      ),
      node("evidence", "证据", "Evidence", "unbound", null, null, "/memory"),
    ],
  };
}
