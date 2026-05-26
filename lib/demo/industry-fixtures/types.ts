/**
 * 跨行业 demo fixture 类型契约
 *
 * 让公开演示能以行业为入口（不绑定单一行业），共享同一判断卡 schema，
 * 用户进 demo 第一眼看到「这是我们行业的版本」。详见 R5 走查 + R8 PR-06。
 *
 * 字段与 components/recommendations/recommendation-judgement-card.tsx 的
 * RecommendationLike type 对齐（fixture 卡可直接拼装为 RecommendationLike），
 * 但保留独立 type 避免循环依赖。
 */

export type IndustryJudgementCard = {
  /** 卡片在 fixture 内的稳定 id（用于 React key、e2e 选择）。 */
  id: string;
  /** 标题：直接给当前判断（"今天不发 ROI 材料就丢窗口"风格）。 */
  title: string;
  /** 描述：判断的展开（为什么这是个问题）。 */
  description: string;
  /** 推荐分（0-100）。 */
  score: number;
  /** policy 结果，对齐 ActionExecutionMode。 */
  policyResult: "REQUIRES_APPROVAL" | "SUGGEST_ONLY" | "AUTO_WITHIN_THRESHOLD" | "FORBIDDEN";
  /** 理由链：Helm 为什么这样判断（事实 / 承诺 / 阻塞 拼接）。 */
  explanation: string;
  /** D3 边界声明：为什么 Helm 不能自动做 — 这是 fixture 卡的护城河字段。 */
  whyNotAutoExecute: string;
  /** 5 维 score 可选（默认 score 已含主线）。 */
  urgencyScore?: number;
  impactScore?: number;
  confidenceScore?: number;
  personalizationScore?: number;
  riskScore?: number;
};

export type IndustryDemoPack = {
  /** 稳定行业 key，用于 URL / e2e / fixture filename。 */
  industryKey: string;
  /** 中文行业 displayName（"B2B SaaS / 跨境电商 / 客户成功" 等）。 */
  displayNameZh: string;
  /** 英文行业 displayName。 */
  displayNameEn: string;
  /** 行业典型 persona（销售 / 经营者 / 客户成功 / 客服 等）。 */
  persona: { zh: string; en: string };
  /** 行业共情锚点（"那 48 小时无人推进"的具体形状）。 */
  pitch: { zh: string; en: string };
  /** 6–10 张代表判断卡 fixture。 */
  judgementCards: IndustryJudgementCard[];
  /**
   * 可选 — 该行业有更深 fixture-backed 演示页（例如 tenant-private readout）时填写。
   * /demo 入口会在该行业卡片上额外渲染「打开完整 readout」CTA。
   * 路径必须是站内绝对路径（以 / 开头），公开可读（不要求登录）。
   */
  deeperReadoutHref?: string;
  /** 配 deeperReadoutHref 的 CTA 标签；未提供时使用默认文案。 */
  deeperReadoutCtaLabel?: { zh: string; en: string };
};
