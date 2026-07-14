/**
 * 经营主线（operating mainline）内部契约 —— 蓝图 Phase 1 的契约内部化。
 *
 * 本模块只在 Core 内部使用（蓝图 §3.2：Phase 1 类型内部化、零对外承诺）；
 * Phase 2 经 owner 授权后才把等价形状开放进 PackContributions（experimental）。
 *
 * 铁律（蓝图 §4.1）：
 * - 数据条目只读/只导航：不存在动作回调字段；href 必须站内绝对路径。
 * - 三态 measured | pending_source | no_data，禁止用推断值冒充 measured；
 *   pending_source 必须携带来源说明。
 * - 徽标词表无执行态（能力真值：最高到"建议已就绪·待人工确认"）。
 * - needsHuman 等计数为 team/node 级聚合，无个人排名形状。
 * - "最老卡点时长" = asOf − oldestBlockedSince，两端 ISO-8601，UI 确定性计算。
 * - 计数必须声明口径（countCaliber）：daily_schedule（今日排片，非全量积压）
 *   或 full_volume（全量），UI 按口径展示，防止截断计数被误读为全量。
 */

export type ShellReadoutStatus = "measured" | "pending_source" | "no_data";

const STATUS_VALUES: ReadonlySet<string> = new Set([
  "measured",
  "pending_source",
  "no_data",
]);

/** 接管程度四态（V1，无执行态词汇）。 */
export type MainlineNodeStage =
  | "unbound"
  | "observing"
  | "suggesting"
  | "suggestion_ready_pending_human";

const STAGE_VALUES: ReadonlySet<string> = new Set([
  "unbound",
  "observing",
  "suggesting",
  "suggestion_ready_pending_human",
]);

export type MainlineCountCaliber = "daily_schedule" | "full_volume";

const CALIBER_VALUES: ReadonlySet<string> = new Set([
  "daily_schedule",
  "full_volume",
]);

export type MainlineNode = {
  key: string;
  label: string;
  stage: MainlineNodeStage;
  status: ShellReadoutStatus;
  inFlightCount: number | null;
  /** 计数口径；measured 且有计数时必填 */
  countCaliber: MainlineCountCaliber | null;
  oldestBlockedSince: string | null;
  oldestBlockedRef: string | null;
  needsHuman: number | null;
  href: string | null;
  basisRef: string;
  pendingSourceNote?: string;
};

export type MainlineAssetScopeOption = {
  value: string;
  label: string;
  href: string;
  current: boolean;
  basisRef: string;
};

export type MainlineAssetScopeControl = {
  label: string;
  currentValue: string;
  defaulted: boolean;
  basisRef: string;
  options: ReadonlyArray<MainlineAssetScopeOption>;
};

export type MainlineReadout = {
  asOf: string;
  asOfBasisRef?: string;
  nodes: ReadonlyArray<MainlineNode>;
  assetScope?: MainlineAssetScopeControl;
};

const MIN_NODES = 1;
const MAX_NODES = 8;
const MAX_ASSET_SCOPE_OPTIONS = 12;

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function isParsableIso(value: string): boolean {
  return ISO_TIMESTAMP_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

function isInSitePath(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (value.includes(":") || value.includes("\\")) return false;
  return value.length <= 500;
}

function isValidCount(value: number | null): boolean {
  return value === null || (Number.isInteger(value) && value >= 0);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
  if (!isParsableIso(readout.asOf)) {
    issues.push({ nodeKey: null, issue: "asOf_not_iso8601" });
  }
  if (readout.nodes.length < MIN_NODES || readout.nodes.length > MAX_NODES) {
    issues.push({ nodeKey: null, issue: "node_count_out_of_range" });
  }
  if (readout.assetScope) {
    const control = readout.assetScope;
    if (!isNonEmptyString(control.label)) {
      issues.push({ nodeKey: null, issue: "asset_scope_empty_label" });
    }
    if (!isNonEmptyString(control.currentValue)) {
      issues.push({ nodeKey: null, issue: "asset_scope_empty_current_value" });
    }
    if (!isNonEmptyString(control.basisRef)) {
      issues.push({ nodeKey: null, issue: "asset_scope_empty_basis_ref" });
    }
    if (typeof control.defaulted !== "boolean") {
      issues.push({ nodeKey: null, issue: "asset_scope_defaulted_not_boolean" });
    }
    if (
      !Array.isArray(control.options) ||
      control.options.length < 1 ||
      control.options.length > MAX_ASSET_SCOPE_OPTIONS
    ) {
      issues.push({ nodeKey: null, issue: "asset_scope_option_count_out_of_range" });
    } else {
      const seenValues = new Set<string>();
      for (const option of control.options) {
        const optionKey = isNonEmptyString(option.value) ? option.value : null;
        if (!isNonEmptyString(option.value)) {
          issues.push({ nodeKey: null, issue: "asset_scope_option_empty_value" });
        } else if (seenValues.has(option.value)) {
          issues.push({ nodeKey: null, issue: "asset_scope_option_duplicate_value" });
        } else {
          seenValues.add(option.value);
        }
        if (!isNonEmptyString(option.label)) {
          issues.push({ nodeKey: null, issue: "asset_scope_option_empty_label" });
        }
        if (!isNonEmptyString(option.basisRef)) {
          issues.push({ nodeKey: null, issue: "asset_scope_option_empty_basis_ref" });
        }
        if (typeof option.current !== "boolean") {
          issues.push({ nodeKey: null, issue: "asset_scope_option_current_not_boolean" });
        }
        if (!isInSitePath(option.href)) {
          issues.push({ nodeKey: null, issue: `asset_scope_option_href_not_in_site:${optionKey ?? "unknown"}` });
        }
      }
      if (!seenValues.has(control.currentValue)) {
        issues.push({ nodeKey: null, issue: "asset_scope_current_value_not_in_options" });
      }
    }
  }
  const seenKeys = new Set<string>();
  for (const node of readout.nodes) {
    const nodeKey = isNonEmptyString(node.key) ? node.key : null;
    if (!isNonEmptyString(node.key)) {
      issues.push({ nodeKey, issue: "empty_key" });
    }
    if (!isNonEmptyString(node.label)) {
      issues.push({ nodeKey, issue: "empty_label" });
    }
    if (!isNonEmptyString(node.basisRef)) {
      issues.push({ nodeKey, issue: "empty_basis_ref" });
    }
    if (nodeKey) {
      if (seenKeys.has(nodeKey)) {
        issues.push({ nodeKey, issue: "duplicate_node_key" });
      }
      seenKeys.add(nodeKey);
    }
    for (const [field, value] of Object.entries(node)) {
      if (typeof value === "function") {
        issues.push({ nodeKey, issue: `callback_field:${field}` });
      }
    }
    if (!STATUS_VALUES.has(node.status as string)) {
      issues.push({ nodeKey, issue: "unknown_status" });
    }
    if (!STAGE_VALUES.has(node.stage as string)) {
      issues.push({ nodeKey, issue: "unknown_stage" });
    }
    if (node.countCaliber !== null && !CALIBER_VALUES.has(node.countCaliber)) {
      issues.push({ nodeKey, issue: "unknown_count_caliber" });
    }
    if (node.status !== "measured") {
      if (
        node.inFlightCount !== null ||
        node.needsHuman !== null ||
        node.oldestBlockedSince !== null ||
        node.oldestBlockedRef !== null
      ) {
        issues.push({ nodeKey, issue: "non_measured_carries_values" });
      }
    }
    if (
      node.status === "pending_source" &&
      !isNonEmptyString(node.pendingSourceNote)
    ) {
      issues.push({ nodeKey, issue: "pending_source_without_note" });
    }
    if (
      node.status === "measured" &&
      (node.inFlightCount !== null || node.needsHuman !== null) &&
      node.countCaliber === null
    ) {
      issues.push({ nodeKey, issue: "measured_count_without_caliber" });
    }
    const sinceNull = node.oldestBlockedSince === null;
    const refNull = node.oldestBlockedRef === null;
    if (sinceNull !== refNull) {
      issues.push({ nodeKey, issue: "blocked_pair_null_mismatch" });
    }
    if (node.oldestBlockedSince !== null) {
      if (!isParsableIso(node.oldestBlockedSince)) {
        issues.push({ nodeKey, issue: "blocked_since_not_iso8601" });
      } else if (
        isParsableIso(readout.asOf) &&
        Date.parse(node.oldestBlockedSince) > Date.parse(readout.asOf)
      ) {
        issues.push({ nodeKey, issue: "blocked_since_after_asOf" });
      }
    }
    if (node.href !== null && !isInSitePath(node.href)) {
      issues.push({ nodeKey, issue: "href_not_in_site" });
    }
    if (!isValidCount(node.inFlightCount) || !isValidCount(node.needsHuman)) {
      issues.push({ nodeKey, issue: "invalid_count" });
    }
  }
  return issues;
}

export type CoreDefaultMainlineInput = {
  asOf: string;
  english: boolean;
  counts: {
    /** 今日需拍板排片数（升舱自 home-work-entry 的 daily-3 模型，非全量积压） */
    judgementPending: number | null;
    /** 今日复核排片数（同上口径）；null = 源不可用 */
    reviewQueue: number | null;
    /** 在途推进对象数（全量口径；当前无真实全量源 → 传 null） */
    advanceInFlight: number | null;
  };
};

/**
 * Core 默认主线（信号 → 判断 → 复核 → 推进 → 证据）。
 * 未接源节点诚实 pending_source / unbound——开源镜像观感不得靠造数（蓝图 §7）。
 * judgement/review 计数口径 = daily_schedule（今日排片），UI 必须按口径展示。
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
    caliber: MainlineCountCaliber,
    href: string | null,
  ): MainlineNode => {
    const measured = count !== null || needsHuman !== null;
    return {
      key,
      label: t(labelZh, labelEn),
      stage,
      status: measured ? "measured" : "pending_source",
      inFlightCount: measured ? count : null,
      countCaliber: measured ? caliber : null,
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
      node("signal", "信号", "Signals", "observing", null, null, "full_volume", "/operating"),
      node(
        "judgement",
        "判断",
        "Judgement",
        "suggesting",
        counts.judgementPending,
        counts.judgementPending,
        "daily_schedule",
        "/dashboard?stay=1#employee-assignment-actions",
      ),
      node(
        "review",
        "复核",
        "Review",
        "suggestion_ready_pending_human",
        counts.reviewQueue,
        counts.reviewQueue,
        "daily_schedule",
        "/approvals",
      ),
      node(
        "advance",
        "推进",
        "Advance",
        "observing",
        counts.advanceInFlight,
        null,
        "full_volume",
        "/opportunities",
      ),
      node("evidence", "证据", "Evidence", "unbound", null, null, "full_volume", "/memory"),
    ],
  };
}
