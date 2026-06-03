/**
 * SI Delivery 行业 demo fixture pack（系统集成商交付承诺）
 *
 * 对齐 docs/sales/packs/PACK_B_SI_DELIVERY_COMMITMENT_RESEARCH_V1.md。
 * 共情锚点：对客户做的交付承诺被「排期 / 资源 / 范围」三角拉扯，团队各
 * 持一段没人合上——客户验收前夜才发现里程碑做不出来，那 48 小时的
 * 沉默是 SI 行业的"会后 48 小时"。
 *
 * 数据全部 fictional，情节贴 B2B 实施服务公开 benchmark。
 */

import type { IndustryDemoPack } from "./types";

export const SI_DELIVERY_PACK: IndustryDemoPack = {
  industryKey: "si-delivery",
  displayNameZh: "系统集成商 / 实施交付",
  displayNameEn: "SI / Delivery",
  persona: {
    zh: "项目经理 / 交付负责人 / 客户成功",
    en: "Project manager / delivery lead / customer success",
  },
  pitch: {
    zh: "对客户的交付承诺被排期、资源和范围三角拉扯——客户验收前夜才发现里程碑根本做不出来。那 48 小时的沉默就是 SI 行业的「会后 48 小时」。",
    en: "Delivery promises to the client get torn between timeline, resourcing and scope — the night before UAT, you discover the milestone simply cannot be hit. That silent 48-hour gap is SI's flavour of the post-meeting collapse.",
  },
  judgementCards: [
    {
      id: "si-milestone-overdue-undisclosed",
      title: "鸿运金融里程碑 M3 已逾期 9 天，客户尚未感知",
      description:
        "M3「数据迁移完成」原定 0512，实际进度 64%。客户 PMO 平台仍显示「按期」，团队内部未触发延期沟通。下次客户周会 0524。",
      score: 91,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：M3 任务进度看板（实际 64% / 计划 100%）· 客户 PMO 0521 周报仍标「绿灯」· 项目经理 0518 内部 slack 提及「来不及但还没和客户讲」· 历史相似 11 个项目，越晚告知客户越伤合作，平均 NPS 损失 2.4 分。",
      whyNotAutoExecute:
        "对客户透明化延期是经营决策（涉及合同 / 法务 / 商务）— Helm 给 3 种披露口径草稿（提前 / 同步 / 滞后兜底），由 PM + 商务 + 法务联合确认。",
      urgencyScore: 95,
      impactScore: 92,
      confidenceScore: 88,
      riskScore: 80,
    },
    {
      id: "si-scope-creep-shadow",
      title: "蓝海科技项目范围 6 周内净增 23%，无变更单",
      description:
        "客户业务联系人 6 周内提了 14 项「小调整」，已被开发团队默默吸收。累计工作量约 35 人天（占总工作量 23%），未走变更单流程。",
      score: 84,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：变更追踪 14 项 · 累计估工 35 人天 · 客户业务联系人邮件 14 封含「能不能也加上」「再帮个忙」· 内部 slack 0517「这样下去验收前我们要赔死了」· 变更单系统 0 条记录。",
      whyNotAutoExecute:
        "范围谈判是商务 + 客户成功联合判断（继续吸收 vs 启动变更单 vs 暂缓）— Helm 给 3 个谈判脚本草稿，由人确认哪条线发起。",
      urgencyScore: 80,
      impactScore: 88,
      confidenceScore: 85,
      riskScore: 90,
    },
    {
      id: "si-resource-conflict-cross-project",
      title: "核心架构师同时支撑 3 项目，本周冲突 18 小时",
      description:
        "架构师张工本周日历显示 3 个项目并行（鸿运 / 蓝海 / 鲸落），重叠时段 18 小时。3 个 PM 都默认他能投入 50%。",
      score: 78,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：日历查询 3 项目共占 张工 0517-0524 共 78 小时（标准周 40 小时）· 3 名 PM 各自项目计划假设张工投入 50% · 上周类似冲突导致蓝海项目里程碑 M2 延期 5 天 · 招聘候补架构师流程进行中（预计 4 周到岗）。",
      whyNotAutoExecute:
        "资源冲突解决是组织决策（暂停某项目 / 加班 / 招聘）— Helm 给冲突时段表 + 3 种解决方案候选，由资源中心确认。",
      urgencyScore: 75,
      impactScore: 82,
      confidenceScore: 92,
      riskScore: 70,
    },
    {
      id: "si-uat-signoff-stalled",
      title: "天权信息 UAT sign-off 卡 12 天，客户测试团队无更新",
      description:
        "UAT 测试已交付 0510，预期 sign-off 0517。当前已逾期 5 天，客户测试团队无任何 bug 反馈或 sign-off 信号。",
      score: 76,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：UAT 包交付邮件 0510 · sign-off 截止 0517 · 客户测试团队 0510-0522 期间访问测试环境 6 次（首次后无访问）· 客户测试主管邮件 0518 未回 · 历史相似拖延 14 个项目，最终 5 个有重大 bug 未报。",
      whyNotAutoExecute:
        "「催客户 vs 等客户 vs 主动开会」是商务节奏判断 — Helm 给 3 种催进话术（友好 / 中性 / 偏强势）候选，由 PM 选语气。",
      urgencyScore: 80,
      impactScore: 78,
      confidenceScore: 70,
      riskScore: 65,
    },
    {
      id: "si-client-decision-paralysis",
      title: "海岸科技业务方关键决策悬而未决 21 天，阻塞 2 里程碑",
      description:
        "客户业务方需决策「数据脱敏规则 v2」（涉及合规），21 天无回复。M4 / M5 两个里程碑已写入「等待客户决策」状态。",
      score: 82,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：决策请求邮件 0501 · 客户业务高管 0508 / 0515 / 0521 三次访问决策邮件后无回复 · M4 / M5 项目计划标「等待客户决策 21 天」· 合同条款规定客户决策延期超 14 天 PM 可触发升级处理 · 历史 8 个相似项目最终都因为客户决策慢导致总延期 30+ 天。",
      whyNotAutoExecute:
        "正式触发合同条款升级处理涉及法律 / 商务关系 — Helm 给升级处理模板草稿 + 客户高管联系人推荐，由项目经理 + 商务 + 法务联合确认。",
      urgencyScore: 90,
      impactScore: 90,
      confidenceScore: 78,
      riskScore: 85,
    },
    {
      id: "si-third-party-dependency-blocked",
      title: "鸿运金融第三方支付接口 SLA 14 天未签，阻塞验收",
      description:
        "支付接口供应商（外部第三方）SLA 协议从 0508 起未签。M3「数据迁移完成」依赖该接口可用性。客户上线计划 0530。",
      score: 88,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：第三方供应商 SLA 草稿邮件 0508 · 供应商法务 0512 / 0517 反馈仍在评审 · M3 验收依赖该接口 · 客户上线计划 0530（剩 8 天）· 历史相似第三方延期 4 个项目，最终 3 个被迫延期上线。",
      whyNotAutoExecute:
        "第三方供应商谈判 / 客户上线延期沟通 / 启用备用方案三选一是经营决策 — Helm 给 3 路径剧本，由项目经理 + 客户成功 + 供应链确认。",
      urgencyScore: 92,
      impactScore: 88,
      confidenceScore: 85,
      riskScore: 88,
    },
  ],
};
