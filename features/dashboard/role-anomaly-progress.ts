import type {
  DashboardHomeWorkEntryCard,
  DashboardHomeWorkEntryModel,
} from "@/features/dashboard/home-work-entry";
import type { AttentionItem } from "@/lib/shell/attention-feed";

const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 } as const;
const MAX_ROLE_ANOMALIES = 5;
const MAX_TOP_ROLE_ANOMALIES = 2;
const MAX_TOP_WORK_ITEMS = 3;
const EVIDENCE_REF_PII_PATTERNS = [
  /\b1[3-9]\d{9}\b/,
  /\b\d{15}(?:\d{2}[0-9Xx])?\b/,
  /[\w.+-]+@[\w-]+\.[\w.-]+/,
] as const;

export type DashboardHomeWorkEntryWithRoleAnomalies =
  DashboardHomeWorkEntryModel & {
    roleAnomalyItems: DashboardHomeWorkEntryCard[];
  };

export function resolveRoleAttentionCategory(input: {
  rolePresetKey?: string | null;
  basePresetKey?: string | null;
  workspaceRole: string;
}) {
  return (
    input.rolePresetKey?.trim() ||
    input.basePresetKey?.trim() ||
    input.workspaceRole
  );
}

function dedupeWorkItems(
  items: ReadonlyArray<DashboardHomeWorkEntryCard>,
  limit: number,
) {
  const seen = new Set<string>();
  const result: DashboardHomeWorkEntryCard[] = [];
  for (const item of items) {
    const identity = `${item.href}::${item.title}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

function buildRoleAnomalyCard(
  item: AttentionItem,
  english: boolean,
): DashboardHomeWorkEntryCard {
  const evidenceRef =
    item.basisRef.length <= 240 &&
    !/[\s\u0000-\u001f\u007f]/.test(item.basisRef) &&
    !EVIDENCE_REF_PII_PATTERNS.some((pattern) => pattern.test(item.basisRef))
      ? item.basisRef
      : undefined;
  return {
    id: `system-anomaly:${item.key}`,
    title: item.label,
    subject: english
      ? "System anomaly routed to this role"
      : "系统异常 · 已路由到本角色",
    statusLabel:
      item.severity === "critical"
        ? english
          ? "Critical anomaly"
          : "关键异常"
        : english
          ? "Needs follow-through"
          : "需要推进",
    nextStep: english
      ? "Verify the cited evidence, continue from the responsible desk, and escalate when the cause cannot be confirmed."
      : "核对所引证据，在责任工位继续推进；无法确认原因时按角色链升级。",
    boundary: english
      ? "Suggestion only. The system will not automatically call, send, settle, change rules, or modify business state."
      : "仅形成推进建议；系统不会自动外呼、外发、结算、修改规则或改变业务状态。",
    href: item.href ?? "/diagnostics",
    ctaLabel: english ? "Inspect evidence" : "查看证据",
    evidenceRef,
  };
}

export function getAdditionalRoleAnomalyItems(
  model: DashboardHomeWorkEntryWithRoleAnomalies,
) {
  const promotedIds = new Set(model.topWorkItems.map((item) => item.id));
  return model.roleAnomalyItems.filter((item) => !promotedIds.has(item.id));
}

/**
 * Converts already-conformant attention facts into role work at read time.
 * No persistence or execution happens here: stable keys and basis refs make the
 * projection traceable while the target page re-checks authorization.
 */
export function attachRoleAnomalyProgress(input: {
  model: DashboardHomeWorkEntryModel;
  attentionItems: ReadonlyArray<AttentionItem>;
  english: boolean;
}): DashboardHomeWorkEntryWithRoleAnomalies {
  const byKey = new Map<string, AttentionItem>();
  for (const item of input.attentionItems) {
    if (item.severity === "info") continue;
    const existing = byKey.get(item.key);
    if (
      !existing ||
      SEVERITY_RANK[item.severity] < SEVERITY_RANK[existing.severity]
    ) {
      byKey.set(item.key, item);
    }
  }

  const roleAnomalyItems = [...byKey.values()]
    .sort(
      (left, right) =>
        SEVERITY_RANK[left.severity] - SEVERITY_RANK[right.severity] ||
        left.key.localeCompare(right.key),
    )
    .slice(0, MAX_ROLE_ANOMALIES)
    .map((item) => buildRoleAnomalyCard(item, input.english));

  return {
    ...input.model,
    roleAnomalyItems,
    topWorkItems: dedupeWorkItems(
      [
        ...roleAnomalyItems.slice(0, MAX_TOP_ROLE_ANOMALIES),
        ...input.model.topWorkItems,
      ],
      MAX_TOP_WORK_ITEMS,
    ),
  };
}
