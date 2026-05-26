// Operating Signal Quality Assessment — Helm 自身保留租户经营信号质量评估口径。
//
// 核心原则（与 V2.3 reserved tenant GTM operating layer 一致）：
// - 优先级：交付效果 > 经营信号质量 > 上线/配置/数据初始化完成度 > 代码质量 > 提交数量。
// - 垃圾、重复、误导信息必须强惩罚，不能被代码量或 PR 数量抵消。
// - 这是纯函数 + 类型库；不持有租户字面量，也不读 DB。
//   租户边界（仅限 Helm reserved workspace）由 caller 在 surface / page-loader 处强制。
// - Codex / Claude / 其它 AI 产出必须归属到对应 GitHub 人类账号；评估 subject 永远是人或团队，
//   不为 AI 单独建一个 contributor 评分对象。

export type OperatingSignalQualitySubjectKind =
  | "contributor"
  | "delivery_batch"
  | "data_source"
  | "operating_signal_source";

export type OperatingSignalQualityGrade =
  | "high_value"
  | "useful"
  | "weak"
  | "harmful";

export type OperatingSignalQualitySubject = {
  kind: OperatingSignalQualitySubjectKind;
  label: string;
  // 可选：被评估对象的归属 GitHub 账号或团队 handle（用于追溯，不参与评分）。
  githubHandle?: string | null;
  teamHandle?: string | null;
};

export type OperatingSignalQualityDeliveryEvidence = {
  // 4 项布尔证据，每项满分 10，合计 0..40。
  tenantUsable: boolean;             // 租户实际可用
  customerCanTest: boolean;          // 客户能真实测试或试用
  onlineVerified: boolean;           // 已在线上验证（dev/staging/prod 任一可定义）
  operatingPushForward: boolean;     // 真实推动经营推进（不是为了写代码而写代码）
  notes?: string[];
};

export type OperatingSignalQualitySignalEvidence = {
  // 4 项布尔，加权 9 + 9 + 9 + 8 = 35。
  actionable: boolean;               // 数据能转成明确 action
  timely: boolean;                   // 在可推进窗口内到达
  accurate: boolean;                 // 准确，未误导
  leadsToReview: boolean;            // 能进入复核 / 决策
  notes?: string[];
};

export type OperatingSignalQualityReadinessEvidence = {
  // 5 项布尔，每项 3 分，合计 0..15。
  envConfigured: boolean;            // env / token / secret / config 已落
  cronOrTokenSet: boolean;           // cron / 定时 / webhook / signing token 已落
  dbMigrated: boolean;               // schema/migration 已就绪
  tenantEnabled: boolean;            // 租户 enablement / feature flag 已开
  initialDataSeeded: boolean;        // 必要的初始化/seed 数据已落
  notes?: string[];
};

export type OperatingSignalQualityCollaborationEvidence = {
  // 3 项布尔，加权 4 + 3 + 3 = 10。
  reducedBlockersForOthers: boolean; // 减少了他人阻塞
  clearHandoff: boolean;             // 清晰交接，下一棒能直接接
  teamSpeedUp: boolean;              // 让团队整体推进更快
  notes?: string[];
};

export type OperatingSignalQualityNoiseFindings = {
  // 计数式，加权惩罚，cap 至 -60。
  duplicateSignalCount: number;            // 重复信号
  misleadingSignalCount: number;           // 误导性信号（最重）
  wrongAttributionCount: number;           // 归因错误（owner / tag / 时间）
  invalidReportCount: number;              // 不能驱动 action 的"报表"
  notes?: string[];
};

export type OperatingSignalQualityPrInflationFindings = {
  // PR / commit 膨胀类惩罚，cap 至 -20。
  // 这是为了防止"靠 PR 数 / commit 数堆贡献"的反模式。
  tinyNonCohesiveSliceCount: number;       // 过小、不构成独立交付价值的切片
  repeatedNonProgressiveCommitCount: number; // 反复重写但不带来交付推进的 commit
  commitsForCountSake: boolean;            // 明显为提交数量而提交
  notes?: string[];
};

export type OperatingSignalQualityEvidence = {
  delivery: OperatingSignalQualityDeliveryEvidence;
  signal: OperatingSignalQualitySignalEvidence;
  readiness: OperatingSignalQualityReadinessEvidence;
  collaboration: OperatingSignalQualityCollaborationEvidence;
  noise: OperatingSignalQualityNoiseFindings;
  prInflation: OperatingSignalQualityPrInflationFindings;
};

export type OperatingSignalQualityScoreBreakdown = {
  deliveryEffectScore: number;       // 0..40
  signalQualityScore: number;        // 0..35
  operationalReadinessScore: number; // 0..15
  collaborationScore: number;        // 0..10
  noisePenalty: number;              // -60..0
  prInflationPenalty: number;        // -20..0
  totalScore: number;                // clamp(sum, -60, 100)
};

export type OperatingSignalQualityAssessment = {
  subject: OperatingSignalQualitySubject;
  scores: OperatingSignalQualityScoreBreakdown;
  grade: OperatingSignalQualityGrade;
  positiveSignals: string[];       // delivery / signal / collab / readiness 中已成立的正面信号文案
  noiseFindings: string[];         // 噪声 / 误导 / 重复 / 错误归因 的归纳描述
  deliveryEvidence: string[];      // 交付效果证据归纳
  readinessEvidence: string[];     // 上线/配置/migration/seed 证据归纳
  recommendations: string[];       // 下一步改进建议
  // 边界与诚实姿态：明确这是评分快照，不是承诺，也不是绩效结算依据。
  boundary: {
    reservedOnly: true;
    notAPerformanceContractor: true;
    notAFinancialSettlementInput: true;
    aiOutputAttributedToHumanGithub: true;
  };
};

export const OPERATING_SIGNAL_QUALITY_SCORE_BOUNDS = {
  deliveryMax: 40,
  signalMax: 35,
  readinessMax: 15,
  collaborationMax: 10,
  noisePenaltyMin: -60,
  prInflationPenaltyMin: -20,
  totalMin: -60,
  totalMax: 100,
} as const;
