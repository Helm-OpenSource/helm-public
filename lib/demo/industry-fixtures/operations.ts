/**
 * Operations 行业 demo fixture pack（经营运营 / 客服 / 客户运营）
 *
 * 共情锚点：AI 已经做的判断（处置建议 / 客诉前兆 / 跟进时间窗口）— 但
 * 99% 的 AI 信号是 dark data，没人按时审、没人按时跟进。AI 高产能 +
 * 复核近零是这个行业最大的「48 小时无人推进」具体形状。
 *
 * 设计约束（来自 R2 后用户 redirect）：通用客服 / 客户运营语言，**不出现**
 * 任何特定垂直行业术语（不写催收 / 不写医保 / 不写法律）。
 */

import type { IndustryDemoPack } from "./types";

export const OPERATIONS_PACK: IndustryDemoPack = {
  industryKey: "operations",
  displayNameZh: "经营运营 / 客服",
  displayNameEn: "Operations / Customer Service",
  persona: {
    zh: "客服主管 / 经营运营 / 客户工单 owner",
    en: "Service lead / operations manager / case owner",
  },
  pitch: {
    zh: "AI 给出的处置建议 / 跟进时间窗口 / 客诉前兆——99% 是 dark data，没人按时审。AI 越拼，浪费越大。",
    en: "AI is shipping 1500+ recommendations a day — and 99% of them are dark data, never reviewed. The harder the model works, the more value leaks.",
  },
  judgementCards: [
    {
      id: "ops-ai-recommendation-overdue",
      title: "AI 推荐处置建议有 1247 条，3 天内未审",
      description:
        "AI 模型本月给出处置建议 1247 条，覆盖率 99.4%。当前已复核仅 14 条（1.1%）。最佳处置时间窗口已过期 73%。",
      score: 90,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：AI 处置建议月产 1247 · 复核率 1.1%（行业基准 ~30%）· 时间窗口过期占比 73% · 高优先级（含「投诉前兆」标签）建议 89 条，复核率 0%。",
      whyNotAutoExecute:
        "AI 推荐不是承诺 — Helm 把 89 条高优先级未审建议聚合成今日复核包，每条审与不审仍由人 click。",
      urgencyScore: 95,
      impactScore: 92,
      confidenceScore: 90,
      riskScore: 80,
    },
    {
      id: "ops-complaint-warning-24h",
      title: "AI 已识别投诉前兆 18 件，24 小时内未升级",
      description:
        "AI 通话质检模型本周识别「投诉前兆」标签 18 件（含「极度反感」/「投诉」语义），主管未收到任何 escalation。",
      score: 88,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：AI 通话质检 sentiment 分析 18 件触发投诉前兆 · 历史相似案例 25 件，最终成单投诉率 64% · 主管平台未收到 escalation 通知（系统未配置自动 escalate）· 客户工单系统 0 条对应工单。",
      whyNotAutoExecute:
        "升级到主管 / 法务 / 客户成功的口径要由你定 — Helm 给 3 种 escalation 模板（含主管 / 含法务 / 含客户成功）候选。",
      urgencyScore: 90,
      impactScore: 88,
      confidenceScore: 78,
      riskScore: 85,
    },
    {
      id: "ops-followup-window-expired",
      title: "AI 推荐跟进窗口已过期 97% 件，今日 84 件需立即跟进",
      description:
        "AI 模型为每个高价值客户推荐「最佳跟进时间」。当前数据库内未跟进且窗口未过期的仅 3%（平均每天新增 84 件需立即跟进）。",
      score: 86,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：AI 推荐跟进窗口数据库总量 31200 · 已过期 30264（97%）· 未过期且未跟进 936（3%）· 今日新增可跟进窗口 84 件 · 跟进负责人队列长度 287（平均 3.4 件/人）。",
      whyNotAutoExecute:
        "跟进电话 / 邮件由人 click — Helm 把 84 件按客户 LTV / 跟进窗口剩余时间排好优先级，每条由对应负责人触发。",
      urgencyScore: 92,
      impactScore: 80,
      confidenceScore: 85,
      riskScore: 50,
    },
    {
      id: "ops-low-score-agent-training",
      title: "12 名坐席本周通话评分 ≤ 3 分，培训样本待复盘",
      description:
        "AI 通话质检模型本周给出 ≤ 3 分（满分 10）的坐席样本 47 条，分布在 12 名坐席。培训主管未启动复盘流程。",
      score: 72,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：本周 AI 评分 ≤ 3 通话 47 条 · 涉及坐席 12 名 · 培训主管邮件 0512 后无复盘安排 · 历史 ≤ 3 分坐席若 4 周未培训，离职率上升 35%。",
      whyNotAutoExecute:
        "培训安排是组织决策 — Helm 把 12 名坐席的具体表现样本聚合成 1:1 复盘包，培训主管 click 才安排。",
      urgencyScore: 65,
      impactScore: 78,
      confidenceScore: 88,
      riskScore: 45,
    },
    {
      id: "ops-multi-channel-complaint-dedup",
      title: "客户 ID 89234 在 3 渠道 5 天内投诉 4 次，未去重",
      description:
        "同一客户在电话 / 邮件 / 在线工单 3 个渠道 5 天内投诉 4 次（涉及同一订单）。客户工单系统视为 4 条独立工单，分配给 4 名不同处理人。",
      score: 81,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：客户 ID 89234 投诉 0517 电话 / 0518 邮件 / 0520 在线工单 / 0521 邮件 · 涉及同一订单 ORD-20193 · 4 名处理人独立处理无协同 · 客户已开始在社交媒体抱怨「Helm 客服不靠谱」（截图 0522）。",
      whyNotAutoExecute:
        "工单合并是流程决策 — Helm 给 3 种合并方案（统一处理人 / 升级到主管 / 启动客户挽留）候选，由你选。",
      urgencyScore: 90,
      impactScore: 85,
      confidenceScore: 92,
      riskScore: 88,
    },
    {
      id: "ops-config-drift-cross-team",
      title: "客服流转配置 8 个工作组配置漂移，3 组与标杆差异 > 40%",
      description:
        "客户工单分配 / 处置策略 / SLA 配置在 8 个工作组间漂移。其中 3 组与标杆组（A 组）差异 > 40%，可能导致同类工单处置不一致。",
      score: 70,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：8 工作组配置项对比 · A 组（标杆）通过率 87% · D / F / G 三组通过率 51% / 48% / 53%（差异 > 40%）· D 组主管 0510 邮件提及「我们用了不同流程」· 历史漂移 > 40% 案例最终 NPS 平均下降 1.8 分。",
      whyNotAutoExecute:
        "配置同步是组织决策（强制对齐 vs 保留差异）— Helm 给配置对比表 + 同步建议草案，由你选哪些项强制对齐。",
      urgencyScore: 60,
      impactScore: 80,
      confidenceScore: 85,
      riskScore: 55,
    },
  ],
};
