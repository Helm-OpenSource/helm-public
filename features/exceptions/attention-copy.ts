/**
 * 异常工作台 / Agent 收件箱（attention）只读展示的**纯双语文案 + 语义色调**。
 *
 * severity 只表达**关注度**(信息性),无执行态语义(§4.1)。label 已脱敏、仅 ref。
 * 边界:这是"需关注/异常"的汇集与导航面,不代执行、不自动处置——处置走既有人审流程。
 */

import type { AttentionSeverity } from "@/lib/shell/attention-feed";

type Bi = { zh: string; en: string };

export function t(copy: Bi, english: boolean): string {
  return english ? copy.en : copy.zh;
}

export const SEVERITY_COPY: Record<
  AttentionSeverity,
  Bi & { tone: "danger" | "caution" | "neutral"; order: number }
> = {
  critical: { zh: "紧急", en: "Critical", tone: "danger", order: 0 },
  warning: { zh: "警示", en: "Warning", tone: "caution", order: 1 },
  info: { zh: "提示", en: "Info", tone: "neutral", order: 2 },
};

/** severity 升序(critical 最前),同级按 key 字典序——确定性排序,与聚合器同范式。 */
export function severityRank(severity: AttentionSeverity): number {
  return SEVERITY_COPY[severity]?.order ?? 99;
}

export const ATTENTION_SECTION_COPY = {
  title: { zh: "异常工作台 · Agent 收件箱", en: "Exception workbench · Agent inbox" } satisfies Bi,
  subtitle: {
    zh: "Agent 无法自主处理的异常与待关注事项,按关注度排序、按角色过滤;导航到既有人审流程处置。",
    en: "Exceptions the agent can't handle autonomously, ranked by severity and role-filtered; navigate into the existing human-review flow to act.",
  } satisfies Bi,
  boundary: {
    zh: "只汇集与导航,不代执行、不自动处置——处置在目标人审面完成(导航不授权,目标页自行鉴权)。",
    en: "Aggregation and navigation only — no execution or auto-handling; act in the target human-review surface (navigation does not authorize; the target re-authorizes).",
  } satisfies Bi,
  empty: {
    zh: "当前无待关注异常。真实条目由已接入的 Overlay provider 贡献;未接入时诚实留空,不造数。",
    en: "No exceptions to attend to right now. Real items come from a registered overlay provider; honestly empty until one is wired.",
  } satisfies Bi,
  roleAll: { zh: "全部角色", en: "All roles" } satisfies Bi,
};
