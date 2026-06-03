/**
 * Customer Success 行业 demo fixture pack
 *
 * 共情锚点：续约前 30 天客户冷淡 / NPS 下滑 / 关键用户离职 — 客户已经
 * 在看竞品，但 CSM 还没正式升级处理。这是「会后 48 小时」普遍痛点在
 * 客户成功语境下的具体形状。
 *
 * 数据全部 fictional，情节贴 SaaS / 服务交付公开 benchmark。
 */

import type { IndustryDemoPack } from "./types";

export const CUSTOMER_SUCCESS_PACK: IndustryDemoPack = {
  industryKey: "customer-success",
  displayNameZh: "客户成功",
  displayNameEn: "Customer Success",
  persona: {
    zh: "客户成功负责人 / 续约负责人 / 服务团队",
    en: "Customer Success lead / renewal owner / service team",
  },
  pitch: {
    zh: "续约前 30 天客户突然冷淡的那 48 小时——CSM 还没想起来升级处理时，竞品的销售已经在客户内部聊上了。",
    en: "The 48 hours when a renewal account quietly cools — by the time the CSM thinks about escalating, the competitor's sales rep is already in the room.",
  },
  judgementCards: [
    {
      id: "cs-renewal-cooldown-escalate",
      title: "鲸落咨询续约前 28 天连续取消 1:1，今天必须升级处理",
      description:
        "主联系人取消 3 次 1:1，平台活跃度从 9.2/10 滑到 5.4/10，续约负责人邮件未回。合同价值 ¥120 万。",
      score: 91,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：1:1 取消 0509 / 0514 / 0520 · 平台 DAU 从 18 → 7 · 续约负责人邮件 0518 未回 · 上次合同金额 ¥120 万。",
      whyNotAutoExecute:
        "客户成功升级处理的口径需要由你定 — Helm 给三种模板（高管对接 / 缩小续约 / 主动暂停）候选，不替你点击任何对客邮件。",
      urgencyScore: 92,
      impactScore: 95,
      confidenceScore: 75,
      riskScore: 70,
    },
    {
      id: "cs-nps-drop-no-rootcause",
      title: "天权信息 NPS 从 9 滑到 6，3 周内无根因分析",
      description:
        "NPS 评分连续 3 周下滑，多个用户提到「响应慢」与「升级流程不清楚」。CSM 平台还没生成根因分析报告。",
      score: 79,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：NPS 0429（9）→ 0506（7）→ 0517（6）· 8 条用户反馈含关键词「响应慢」/「升级不清」· 支持工单平均响应时间从 2.4h 上升至 6.8h · 根因分析未启动。",
      whyNotAutoExecute:
        "下一步是组织决策（加人 / 改流程 / 改 SLA） — Helm 提供 3 种诊断切片，建议人审后决定优先级。",
      urgencyScore: 75,
      impactScore: 88,
      confidenceScore: 80,
      riskScore: 65,
    },
    {
      id: "cs-upsell-invitation-ignored",
      title: "鸿运科技升级邀约客户已读不回 9 天",
      description:
        "上月发出 Premium 升级邀约（年价 +¥36 万），客户高管已读但无回复。CRM 显示客户内部已查看比价材料 2 次。",
      score: 73,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：升级邀约邮件 0510 已读 0511 · 客户内部反向访问比价材料 0514 / 0518 · 高管邮件 0517 询问无关功能（暗示在评估替代）· 升级 SLA 14 天倒计时仅剩 5 天。",
      whyNotAutoExecute:
        "继续推进还是降阶/暂缓是 CSM 商务判断 — Helm 给三选一选项及理由链，由你拍板。",
      urgencyScore: 80,
      impactScore: 75,
      confidenceScore: 70,
      riskScore: 55,
    },
    {
      id: "cs-quarterly-review-cancelled",
      title: "星河连锁季度回顾会客户取消，本季度第二次",
      description:
        "Q2 季度回顾会原定 0522，客户 0519 取消并提议「下季度再约」。本季度第二次取消（Q1 也曾被取消）。",
      score: 68,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：Q1 季度回顾被取消（0211）· Q2 取消邮件 0519 · 客户高管 0512 - 0519 期间访问平台 0 次 · 续约窗口 76 天后到期。",
      whyNotAutoExecute:
        "「主动登门」vs「等客户回复」是组织选择 — Helm 给两条路径候选，不会替 CSM 安排会议。",
      urgencyScore: 70,
      impactScore: 80,
      confidenceScore: 72,
      riskScore: 60,
    },
    {
      id: "cs-key-user-departed",
      title: "蓝鲸科技核心用户离职，新对接人未指定",
      description:
        "客户内部产品总监（核心 Helm 用户，季度活跃度 100%）0515 离职。新接手人未确认，平台已停止使用 11 天。",
      score: 84,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：核心用户 LinkedIn 状态变更 0515 · 离职后该用户 last login 0514 · 客户其他 5 个用户访问量未变化 · 客户 IT 主管邮件 0521 询问账号转移流程 · 续约窗口 110 天。",
      whyNotAutoExecute:
        "新对接人选择是客户内部决策 — Helm 给入门接手模板候选，但是否主动推动客户 IT 走转移流程由你判断。",
      urgencyScore: 78,
      impactScore: 90,
      confidenceScore: 95,
      riskScore: 75,
    },
    {
      id: "cs-churn-risk-escalation",
      title: "海岸科技 Q3 流失候选 — 5 个流失信号 5 周连续触发",
      description:
        "活跃度下滑 60% / 关键 feature 启用率从 78% 降至 32% / NPS 7→4 / 续约谈判延期 21 天 / 主联系人 1 个月未回邮件。流失风险评分 89/100。",
      score: 89,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：5 维流失信号全部触发（活跃度 / feature 启用率 / NPS / 谈判节奏 / 联系人响应）· 历史相似案例 12 个，最终流失率 75% · 续约金额 ¥240 万。",
      whyNotAutoExecute:
        "「高管升级处理 vs 缩小续约 vs 友好暂停」三选一是经营决策 — Helm 给 3 个剧本草稿，每个含目标 + 风险 + 边界，由你选。",
      urgencyScore: 95,
      impactScore: 95,
      confidenceScore: 88,
      riskScore: 90,
    },
  ],
};
