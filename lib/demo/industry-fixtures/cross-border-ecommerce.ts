/**
 * Cross-border E-commerce 行业 demo fixture pack（跨境电商）
 *
 * 对齐 docs/sales/packs/PACK_C_CROSS_BORDER_ECOMMERCE_RESEARCH_V1.md。
 * 共情锚点：多平台 × 多市场 × 多币种 × 多 SLA — 今天的判断分散在 6 个
 * 仪表盘里，没人把它们合上。当算法 / 物流 / 评论任意一条线出问题，48 小时
 * 内有人察觉时已经损失了一周销售。
 *
 * 数据全部 fictional，情节贴跨境电商公开 benchmark（亚马逊 / Shopee /
 * Lazada / 独立站）。
 */

import type { IndustryDemoPack } from "./types";

export const CROSS_BORDER_ECOMMERCE_PACK: IndustryDemoPack = {
  industryKey: "cross-border-ecommerce",
  displayNameZh: "跨境电商",
  displayNameEn: "Cross-border E-commerce",
  persona: {
    zh: "运营负责人 / 海外市场 / 物流协调",
    en: "Ops lead / international markets / logistics coordinator",
  },
  pitch: {
    zh: "多平台 × 多市场 × 多币种 × 多 SLA — 今天的判断分散在 6 个仪表盘里没人合上。算法 / 物流 / 评论任一线出问题，48 小时内有人察觉时已经损失一周销售。",
    en: "Multi-platform × multi-market × multi-currency × multi-SLA — today's call lives across six dashboards and nobody connects them. By the time anyone notices, a week of sales is gone.",
  },
  judgementCards: [
    {
      id: "xbe-ad-roi-divergence",
      title: "亚马逊 / Shopee 主推 SKU 广告 ROI 异动 3 天，预算未对齐",
      description:
        "SKU AC-2204 在亚马逊 ROI 从 4.2 跌到 2.1，但 Shopee 同 SKU ROI 从 3.5 涨到 5.8。两个平台运营独立调价，今日预算分配仍按上周比例。",
      score: 87,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：亚马逊 SKU 广告报表（ROI 4.2 → 2.1，3 天）· Shopee 同 SKU 广告报表（ROI 3.5 → 5.8，3 天）· 平台预算分配 2 周未调整 · 历史相似异动 9 次，提前 24h 调整可降低损失 $3-7K/SKU。",
      whyNotAutoExecute:
        "广告预算调整涉及多平台账号操作 + 商务规则 — Helm 给 3 种调整方案候选（保守 5% 移仓 / 中等 15% / 激进 30%），由运营 click 平台后台执行。",
      urgencyScore: 90,
      impactScore: 85,
      confidenceScore: 82,
      riskScore: 60,
    },
    {
      id: "xbe-logistics-sla-risk",
      title: "美西物流仓本周延误率 12%，欧美客户已开始问 ETA",
      description:
        "美西仓本周订单延误率从基线 3% 升至 12%。已有 47 单欧美客户邮件询问 ETA，客服暂用模板回复但未升级到运营。",
      score: 89,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：美西仓延误率（基线 3% / 本周 12%）· 47 封客户 ETA 询问邮件 0517-0521 · 客服模板回复但未触发 escalation · 历史延误率 > 10% 案例 5 个，最终差评率 +2.4% / 退货率 +5%。",
      whyNotAutoExecute:
        "「主动告知客户 vs 改用备用物流 vs 暂停广告」三选一是经营决策 — Helm 给 3 路径剧本含成本 / 时效 / 客户感知影响估算。",
      urgencyScore: 92,
      impactScore: 90,
      confidenceScore: 85,
      riskScore: 78,
    },
    {
      id: "xbe-inventory-paradox",
      title: "deadstock 与 stockout 同时存在：欧洲过剩 8.2 万 / 美西短缺 3 周",
      description:
        "SKU AC-2204 欧洲仓库存 12000 件（90 天动销 < 30%），美西仓库存 800 件（按当前销售速度 18 天断货）。跨仓调拨流程 14 天起。",
      score: 81,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：欧洲仓 SKU 库存 12000 件（90 天滞销）· 美西仓 800 件（销售速度 45 件/天，18 天断货）· 历史调拨流程 14 天 · 美西广告若停推损失日均 $4.8K · 欧洲清仓促销利润率 -8%。",
      whyNotAutoExecute:
        "「调拨 vs 欧洲清仓 vs 美西停推 vs 跨平台串货」四选一涉及多团队 — Helm 给 4 路径决策矩阵含库存 / 销售 / 利润 / 时效估算。",
      urgencyScore: 78,
      impactScore: 88,
      confidenceScore: 92,
      riskScore: 65,
    },
    {
      id: "xbe-cold-start-reviews",
      title: "新品 GH-105 上架 21 天评论 4 条，3 条 2 星",
      description:
        "新品 GH-105 上架 21 天 117 单，评论仅 4 条且 3 条 2 星（涉及包装 / 说明书 / 颜色不符）。亚马逊算法已开始降权，BSR 排名从 #4500 滑到 #18000。",
      score: 75,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：上架 21 天订单 117 单 · 评论 4 条（4★ × 1 / 2★ × 3）· 2 星评论关键词「包装破损 × 2 / 说明书不全 × 1」· BSR 排名 0501 → 0521（#4500 → #18000）· 历史相似案例 6 个，3 个 90 天内被永久降权。",
      whyNotAutoExecute:
        "客户挽回 / 联系老客户邀评 / 包装设计返工三选一涉及法律（亚马逊不允许诱导评论） + 供应链 — Helm 给合规路径草稿，由你 click。",
      urgencyScore: 82,
      impactScore: 75,
      confidenceScore: 78,
      riskScore: 70,
    },
    {
      id: "xbe-amazon-algorithm-suppression",
      title: "高价值 SKU AC-2204 亚马逊曝光 7 天降 65%，疑似算法压制",
      description:
        "店铺 TOP 3 SKU 在亚马逊曝光从日均 18000 跌到 6300。无明显 listing 改动 / 评分下滑 / 价格变化。疑似算法压制（同行业第 3 次）。",
      score: 86,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：曝光从 18000 → 6300（7 天）· listing 内容 / 评分 / 价格无变化 · 同行业近 6 个月类似案例 3 个 · 客户成功经理（亚马逊侧）邮件 0518 未回 · 当前年化损失估算 ¥240 万。",
      whyNotAutoExecute:
        "「亚马逊客户成功 escalation vs 多账号备份 vs 引流到独立站」三选一涉及商务关系 + 法律 — Helm 给 3 路径剧本，由经营负责人 click。",
      urgencyScore: 92,
      impactScore: 95,
      confidenceScore: 70,
      riskScore: 85,
    },
    {
      id: "xbe-return-rate-spike",
      title: "德国市场 5 月退货率从 3% 飙到 11%，未触发警报",
      description:
        "德国市场 5 月退货率 11%（近 3 月基线 3%）。退货原因 60% 集中在「尺码偏小」。运营平台无自动警报机制。",
      score: 84,
      policyResult: "REQUIRES_APPROVAL",
      explanation:
        "事实链：德国市场退货率（5 月 11% / 基线 3%）· 退货原因分布（尺码偏小 60% / 颜色不符 18% / 其他 22%）· listing 描述 5 月未变 · 同期英国 / 法国市场退货率正常 · 历史德国市场尺码问题 4 次，最终调整 listing 平均节省 ¥80K/月。",
      whyNotAutoExecute:
        "listing 修改 / 退货政策调整 / 客户主动通知三选一影响多市场 — Helm 给 3 路径影响评估，由市场负责人 + 运营总监联合 click。",
      urgencyScore: 80,
      impactScore: 82,
      confidenceScore: 88,
      riskScore: 75,
    },
  ],
};
