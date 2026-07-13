/**
 * 回执与审计 · 运行轨迹（run-trajectory audit）只读展示的**纯双语文案 + 语义色调**。
 *
 * 方法论 v2 §7 铁律:审计展示的是**可审计的语义事件**——调用了什么工具、读改了什么对象、
 * 过了什么策略、由谁批准、结果与证据——**不是模型的思维/推理链**。verdict 为陈述性结论,
 * **无 approve/stop/rerun 等控制动作**(只读、无控制语义)。
 */

import type { AgentRunAuditVerdict } from "@/lib/shell/run-trajectory-audit";

type Bi = { zh: string; en: string };

export function t(copy: Bi, english: boolean): string {
  return english ? copy.en : copy.zh;
}

export const VERDICT_COPY: Record<
  AgentRunAuditVerdict,
  Bi & { tone: "ok" | "caution" | "danger" | "neutral" }
> = {
  pass: { zh: "通过", en: "Pass", tone: "ok" },
  advisory: { zh: "有提示", en: "Advisory", tone: "caution" },
  blocked: { zh: "已阻断", en: "Blocked", tone: "danger" },
  escalate: { zh: "需升级", en: "Escalate", tone: "danger" },
  quarantined: { zh: "已隔离", en: "Quarantined", tone: "danger" },
  pending: { zh: "待复核", en: "Pending", tone: "neutral" },
};

export const AUDIT_SECTION_COPY = {
  title: { zh: "回执与审计 · 运行轨迹", en: "Receipts & audit · run trajectory" } satisfies Bi,
  subtitle: {
    zh: "Agent 运行的可审计语义事件:意图、模式、结论、轨迹失败类、边界决策与阻断计数、隔离态。",
    en: "Auditable semantic events of agent runs: intent, mode, verdict, trajectory failure classes, boundary-decision & blocked counts, quarantine.",
  } satisfies Bi,
  boundary: {
    zh: "只读、无控制语义:verdict 是陈述性结论,无 approve/stop/rerun 动作;展示语义事件(调用/读改/策略/批准/结果),非模型思维链;actor/intent 已脱敏。",
    en: "Read-only, no control semantics: verdict is a statement, with no approve/stop/rerun action; shows semantic events (calls / reads-writes / policy / approval / result), not model reasoning; actor/intent de-identified.",
  } satisfies Bi,
  empty: {
    zh: "当前无运行轨迹记录。真实条目由已接入的 Overlay provider 从其 AgentRunCapsule/SARP 投影;未接入时诚实留空。",
    en: "No run-trajectory records right now. Real entries are projected by a registered overlay provider from its AgentRunCapsule/SARP; honestly empty until one is wired.",
  } satisfies Bi,
  fields: {
    actor: { zh: "执行者", en: "Actor" } satisfies Bi,
    mode: { zh: "模式", en: "Mode" } satisfies Bi,
    failureClasses: { zh: "轨迹失败类", en: "Trajectory failure classes" } satisfies Bi,
    boundaryDecisions: { zh: "边界决策", en: "Boundary decisions" } satisfies Bi,
    blockedActions: { zh: "阻断动作", en: "Blocked actions" } satisfies Bi,
    quarantined: { zh: "已隔离", en: "Quarantined" } satisfies Bi,
    none: { zh: "无", en: "none" } satisfies Bi,
  },
};
