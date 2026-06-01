/**
 * User Research / Product Discovery 行业 demo fixture pack
 *
 * 共情锚点：访谈洞察散在录音 / 笔记 / Slack / 邮件 / 飞书文档里，下一次
 * 产品决策又重新问。48 小时内没人沉淀就丢失——上次的研究等于白做。
 *
 * 数据全部 fictional，情节贴 SaaS / 消费产品 用研团队公开 benchmark。
 */

import type { IndustryDemoPack } from "./types";

export const USER_RESEARCH_PACK: IndustryDemoPack = {
  industryKey: "user-research",
  displayNameZh: "用户研究 / 产品发现",
  displayNameEn: "User Research / Product Discovery",
  persona: {
    zh: "用研负责人 / 产品经理 / 设计研究员",
    en: "Research lead / product manager / design researcher",
  },
  pitch: {
    zh: "访谈洞察散在录音 / 笔记 / Slack 消息 / 邮件 / 飞书文档里。48 小时不沉淀就丢失，下一次产品决策又得重新问——上次的研究等于白做。",
    en: "Interview insights live across recordings, notes, Slack threads, emails and shared docs. If they aren't distilled within 48 hours, they're gone — and the next product decision starts from zero.",
  },
  judgementCards: [
    {
      id: "ur-insights-not-distilled",
      title: "上轮 8 场用户访谈 14 天未沉淀，团队下周已要做 v3 决策",
      description:
        "Q2 产品访谈系列 8 场已结束 14 天，录音 / 笔记 / Slack 讨论散在 5 个工具。下周产品委员会将做 v3 路线决策，基础证据未整理。",
      score: 88,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：8 场访谈纪要文档存在但未跨场聚合 · Slack 频道讨论 47 条 · 邮件提及关键洞察 12 封 · 飞书文档 0506 后无更新 · 下周产品委员会议程含「v3 路线决策」· 历史相似项目 6 个，5 个最终决策与访谈结论分离。",
      whyNotAutoExecute:
        "用研结论提炼是判断工作（哪些是普遍信号 / 哪些是极端案例）— Helm 给候选洞察聚合 + 反例标注，由用研负责人 click 哪些进决策包。",
      urgencyScore: 92,
      impactScore: 90,
      confidenceScore: 78,
      riskScore: 75,
    },
    {
      id: "ur-behavior-signal-fragmented",
      title: "新功能 v2.3 行为信号散在 5 个数据源，PM 仍按直觉判断",
      description:
        "v2.3 上线 3 周，使用数据散在 Mixpanel / Amplitude / 客服工单 / 销售 demo 反馈 / NPS 评论。PM 计划下周做 go/no-go 决策，但只看了 Mixpanel。",
      score: 79,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：v2.3 功能 3 周数据 · Mixpanel 显示采用率 18%（PM 已看）· Amplitude 漏斗显示 step 3 流失 62%（PM 未看）· 客服工单 14 条 v2.3 相关 · 销售 demo 反馈 5 条「学习曲线陡」· NPS 评论 9 条提及 v2.3 · 5 数据源结论可能不一致。",
      whyNotAutoExecute:
        "「保留 v2.3 / 简化 v2.3 / 暂下线 v2.3」三选一是产品判断 — Helm 给 5 数据源聚合视图 + 3 路径决策矩阵，由 PM click。",
      urgencyScore: 78,
      impactScore: 85,
      confidenceScore: 82,
      riskScore: 65,
    },
    {
      id: "ur-interview-promise-overdue",
      title: "5 场访谈承诺给受访者反馈研究结论，7 天逾期未发",
      description:
        "5 名受访者在访谈结束时被承诺「2 周内分享我们的研究结论摘要」。承诺时间 0508，已逾期 7 天。受访者 2 名邮件询问。",
      score: 72,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：5 场访谈纪要含「会发您研究摘要」· 承诺时间窗 0508-0522 · 已逾期 7 天 · 受访者邮件 0521 / 0522 询问进展 · 历史用研履约率 42%（行业基准 80%）· 关键受访者下次合作意愿与研究履约相关。",
      whyNotAutoExecute:
        "对受访者外发是客户面动作 — Helm 给 5 份摘要草稿（基于访谈纪要 + 研究结论），由用研负责人 click 谁审 / 谁发。",
      urgencyScore: 80,
      impactScore: 65,
      confidenceScore: 95,
      riskScore: 50,
    },
    {
      id: "ur-decision-conflicts-prior-research",
      title: "v3.1 产品决策方向与 2025 年 11 月研究结论冲突，团队未察觉",
      description:
        "本周产品委员会通过 v3.1「自动化推荐」方向。但 2025 年 11 月用研结论是「用户希望保留控制感，不要自动化」。两份结论从未被并列对比。",
      score: 86,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：v3.1 决策纪要 0521 「方向：自动推荐」· 2025-11 用研结论文档「用户希望保留控制感」· 两份决策 / 结论从未在产品委员会议程中并列出现 · 涉及 14 名用户访谈样本 · 相似冲突 3 次，最终 2 次产品上线后用户负向反馈。",
      whyNotAutoExecute:
        "产品方向是经营决策 — Helm 把两份结论并列给委员会（含原始引语 + 时间 + 受访者），不替你 vote。",
      urgencyScore: 85,
      impactScore: 92,
      confidenceScore: 88,
      riskScore: 80,
    },
    {
      id: "ur-power-user-disengage",
      title: "高频用户 12 名 4 周内活跃度降 70%，无主动用研接触",
      description:
        "原 power users 12 名（占总用户 0.4% 但贡献 18% 价值）4 周内活跃度从平均 35 次/周降至 10 次/周。用研团队 6 周未联系。",
      score: 84,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：12 名 power users 活跃度变化（35 → 10 次/周，4 周）· 用研接触记录 6 周空白 · 历史 power user 流失模式：先活跃下降，4-8 周后取消订阅或换工具 · 上次访谈 2025-12，结论「这群用户对路线最有判断」。",
      whyNotAutoExecute:
        "联系 12 名 power user 是研究决策（哪几位优先 / 用什么口径 / 提供什么 incentive）— Helm 给候选名单 + 3 种联系话术，由用研负责人 click。",
      urgencyScore: 88,
      impactScore: 88,
      confidenceScore: 75,
      riskScore: 78,
    },
    {
      id: "ur-cross-team-redundant-research",
      title: "PM / CS / 销售三团队本月各做了 1 场用户访谈，问的都是同 3 个问题",
      description:
        "PM 团队 0512 访谈 4 名客户、CS 团队 0515 访谈 3 名客户、销售团队 0518 访谈 5 名 prospects。三轮访谈核心问题重叠 70%（关于「下一步功能优先级」）。",
      score: 70,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：PM / CS / 销售三轮访谈总样本 12 人 · 访谈大纲对比 70% 问题重叠 · 三团队结论文档独立存放无聚合 · 历史相似浪费 4 次（每次估计 ~80 工时）· 用研团队未触发跨团队访谈协同流程。",
      whyNotAutoExecute:
        "建立跨团队访谈协同流程是组织决策（强制走中央调度 vs 保持各自做）— Helm 给当前 3 份结论聚合 + 跨团队协议草稿，由用研负责人 + 三团队 PM click。",
      urgencyScore: 60,
      impactScore: 75,
      confidenceScore: 92,
      riskScore: 45,
    },
  ],
};
