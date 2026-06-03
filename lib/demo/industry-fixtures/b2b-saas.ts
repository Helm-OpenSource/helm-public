/**
 * B2B SaaS 行业 demo fixture pack
 *
 * 共情锚点：会后 48 小时无人寄 ROI / 安全评审 / 交付承诺 — 大客户试点
 * 在沉默中流失。覆盖销售负责人 / 创始人 / 客户成功三类典型画像。
 *
 * 数据全部 fictional 但情节贴 B2B SaaS 真实公开 benchmark（不取自具体客户）。
 */

import type { IndustryDemoPack } from "./types";

export const B2B_SAAS_PACK: IndustryDemoPack = {
  industryKey: "b2b-saas",
  displayNameZh: "B2B SaaS",
  displayNameEn: "B2B SaaS",
  persona: {
    zh: "销售负责人 / 创始人 / 客户成功",
    en: "Sales lead / founder / customer success",
  },
  pitch: {
    zh: "客户问完 ROI 走出会议室那 48 小时没人寄结构化材料 — 试点窗口就这样关掉。",
    en: "The 48 hours after a buyer asks about ROI — and no one ships the structured pack — is where pilots quietly die.",
  },
  judgementCards: [
    {
      id: "b2b-saas-roi-pack-overdue",
      title: "华东智造试点今天不发 ROI 材料，5 月窗口就要掉",
      description:
        "采购会留下 ROI 问题，CFO 要结构化材料，CRM 阶段仍停在「商务评审」。会议结束 32 小时无人推进。",
      score: 92,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：采购会纪要含「需要 ROI 材料」承诺 · CFO 邮件 0518 要求 3 项财务回报口径 · CRM 阶段 = 商务评审 · 外发草稿 v3 在复核中。",
      whyNotAutoExecute:
        "对外发送对客户可见。Helm 不会替你点发送 — 草稿已就位，但客户收件箱由你拍板才进。",
      urgencyScore: 95,
      impactScore: 90,
      confidenceScore: 88,
      riskScore: 30,
    },
    {
      id: "b2b-saas-security-review-stall",
      title: "安域云科安全评审卡 11 天，法务和 IT 各持一段",
      description:
        "技术评审通过，安全 + 法务两条线分别问到隐私、SLA、合规审计——但没人合上。客户内部已开始问「是否还在推」。",
      score: 84,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：技术评审纪要 0506 已通过 · 安全问题 3 条 / 法务问题 2 条散在 5 条邮件链 · 客户 IT 总监 0517 询问进展 · 内部负责人未指定。",
      whyNotAutoExecute:
        "指定负责人是组织决策，Helm 给候选 — 谁接手由你拍板。",
      urgencyScore: 78,
      impactScore: 85,
      confidenceScore: 82,
      riskScore: 55,
    },
    {
      id: "b2b-saas-recovery-deal-cooling",
      title: "星河连锁恢复单价格谈到第 4 轮，温度从 78 掉到 45",
      description:
        "去年丢的单恢复推进 6 周，对方采购态度从「可以谈」变「我们再看看」。继续追价格还是改缩小试点？",
      score: 76,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：4 轮报价邮件 · 关系温度从 78→45（21 天滑落）· 上一轮回复延迟 11 天 · 客户内部新预算口径已下达 0512。",
      whyNotAutoExecute:
        "策略选择（继续 vs 缩小 vs 暂停）是商务判断 — Helm 给三选一选项及其理由链，不替你选。",
      urgencyScore: 72,
      impactScore: 80,
      confidenceScore: 75,
      riskScore: 65,
    },
    {
      id: "b2b-saas-renewal-cool-down",
      title: "鲸落咨询续约前 30 天客户对 1:1 取消已 3 次",
      description:
        "续约窗口 28 天后，客户主联系人连续取消 3 次 1:1。CSM 平台显示活跃度下滑 40%，但还没正式升级处理。",
      score: 81,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：1:1 取消 0509 / 0514 / 0520 · 平台活跃度从 9.2/10 → 5.4/10 · 续约负责人邮件 0518 未回 · 上次合同价值 ¥120 万。",
      whyNotAutoExecute:
        "客户成功升级处理的口径需要由你定 — Helm 给三种升级处理模板（高管对接 / 缩小续约 / 主动暂停）候选。",
      urgencyScore: 90,
      impactScore: 95,
      confidenceScore: 70,
      riskScore: 75,
    },
    {
      id: "b2b-saas-internal-handoff-blocked",
      title: "新签鸿运科技交付负责人未指定，第 8 天卡入门交付",
      description:
        "签约 8 天，交付经理还没正式接手。销售已交接但客户没收到正式启动邮件。客户 PM 主动问「下一步谁联系我」。",
      score: 78,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：合同签字 0512 · 销售交接邮件 0514 内部 · 客户 PM 询问邮件 0519 · 交付经理候选 2 人但未确认 · 客户入门交付 SLA 是 5 工作日（已逾期）。",
      whyNotAutoExecute:
        "团队分工是组织决策，Helm 不会替你点交付经理 — 候选 2 人附理由链等你拍板。",
      urgencyScore: 88,
      impactScore: 75,
      confidenceScore: 90,
      riskScore: 50,
    },
    {
      id: "b2b-saas-competitor-mention",
      title: "天权信息提及竞品做对比，3 天没回应",
      description:
        "客户 CTO 在 0517 视频会提到正在评估竞品。会后无人寄差异化材料。竞品销售已主动二次跟进（来源：客户内部传言）。",
      score: 73,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：会议纪要 0517 含「正在评估 [竞品]」· 客户 CTO 邮件 0518 询问 SOC2 进度 · 内部市场情报 0519 提示竞品 sales engineer 已访谈客户 · 我方差异化材料 v2 在草稿。",
      whyNotAutoExecute:
        "对外材料外发由你确认。差异化口径要避免直接攻击竞品 — 客户面话术由你审。",
      urgencyScore: 85,
      impactScore: 70,
      confidenceScore: 65,
      riskScore: 60,
    },
  ],
};
