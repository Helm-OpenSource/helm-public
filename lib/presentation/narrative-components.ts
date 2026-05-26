export const helmInformationHierarchy = [
  {
    layerId: "L1",
    title: "frontstage",
    label: "前台层",
    defaultContents: [
      "当前判断",
      "待决策",
      "下一步动作",
      "边界",
    ],
  },
  {
    layerId: "L2",
    title: "midstage",
    label: "中间层",
    defaultContents: [
      "review snapshot",
      "prepared draft",
      "协作分工",
      "secondary summary",
    ],
  },
  {
    layerId: "L3",
    title: "backstage",
    label: "后台层",
    defaultContents: [
      "why it matters",
      "review / state semantics",
      "evidence",
      "replay",
      "audit",
      "worker reasoning",
    ],
  },
] as const;

export const narrativeHierarchyReviewQuestions = [
  "用户 30 秒内能否知道当前判断",
  "用户 30 秒内能否知道现在需要谁做什么",
  "用户 30 秒内能否直接执行下一步",
  "用户首屏是否只看到当前状态 / 待决策 / 下一步动作 / 边界",
  "系统解释默认是否折叠在中后台层",
  "用户需要核验时能否快速找到依据",
] as const;

export const narrativeComponentOrder = [
  "NarrativeHeader",
  "ReviewSnapshotBlock",
  "DecisionRequestCard",
  "CollaborationRequestCard",
  "ActionRail",
  "BoundaryNote",
  "WhyItMattersBlock",
  "WorkerSummary",
  "EvidenceChip",
  "EvidenceDrawer",
] as const;

type NarrativeComponentSpec = {
  componentId: (typeof narrativeComponentOrder)[number];
  purpose: string;
  inputFields: string[];
  allowedInformationRange: string[];
  defaultLayer: (typeof helmInformationHierarchy)[number]["layerId"];
  mustAppearWhen: string[];
  mustCollapseWhen: string[];
  forbiddenWhen: string[];
};

export const narrativeComponentSpecs: NarrativeComponentSpec[] = [
  {
    componentId: "NarrativeHeader",
    purpose: "承载页面首句判断与高层摘要，让人先知道 Helm 当前怎么看。",
    inputFields: ["pageJudgement", "pageJudgementReason", "pagePrioritySignal"],
    allowedInformationRange: ["当前判断", "一句高层理由", "优先级信号"],
    defaultLayer: "L1",
    mustAppearWhen: ["任何 decision-first 页面首屏", "首页 / 详情页 / 复核页"],
    mustCollapseWhen: [],
    forbiddenWhen: ["承载对象原始字段列表", "承载超过一屏的证据明细"],
  },
  {
    componentId: "ReviewSnapshotBlock",
    purpose: "把当前待复核结果、准备草稿 和状态语义收进中间层，不把系统自述直接顶到首屏主位。",
    inputFields: ["pageActionSummary"],
    allowedInformationRange: ["待复核结果", "prepared draft", "状态语义说明"],
    defaultLayer: "L2",
    mustAppearWhen: ["页面存在待复核结果或 准备草稿 时"],
    mustCollapseWhen: ["页面没有任何预处理动作时"],
    forbiddenWhen: ["把系统聪明程度写成主叙事", "把 准备写成已执行或正式"],
  },
  {
    componentId: "DecisionRequestCard",
    purpose: "把需要人拍板的事项明确送到页面主叙事里。",
    inputFields: ["pageDecisionRequest"],
    allowedInformationRange: ["当前决策请求", "最多 3 条需要主人判断的事项"],
    defaultLayer: "L1",
    mustAppearWhen: ["页面需要用户拍板", "存在审批 / 负责人 / 下一步决策时"],
    mustCollapseWhen: ["页面不存在任何决策请求时"],
    forbiddenWhen: ["变成普通说明文", "混入仅内部实施细节"],
  },
  {
    componentId: "CollaborationRequestCard",
    purpose: "承载主动协作请求，说明为什么现在需要创始人 / 销售 / 交付等角色介入。",
    inputFields: [
      "collaborationMode",
      "collaborationSummary",
      "collaborationRequest",
      "collaborationDecisionRequest",
      "collaborationNextStep",
    ],
    allowedInformationRange: ["协作模式", "协作原因", "当前请求", "下一步"],
    defaultLayer: "L1",
    mustAppearWhen: ["页面存在主动协作或交接请求时"],
    mustCollapseWhen: ["当前页面没有协作请求时"],
    forbiddenWhen: ["展示全量执行列表", "替代边界说明"],
  },
  {
    componentId: "ActionRail",
    purpose: "把主动作和次动作压成一条清晰动作轨。",
    inputFields: ["pageNextAction"],
    allowedInformationRange: ["1 个主动作", "最多 2 个次动作"],
    defaultLayer: "L1",
    mustAppearWhen: ["页面存在可立即执行动作时"],
    mustCollapseWhen: ["当前页面没有任何动作出口时"],
    forbiddenWhen: ["展示超过 3 个按钮", "承载导航级目录列表"],
  },
  {
    componentId: "BoundaryNote",
    purpose: "把前置 / 依赖 / 风险 / 非承诺保持为默认可见。",
    inputFields: ["pageBoundarySummary", "pageEscalationHint"],
    allowedInformationRange: ["边界摘要", "升级提示", "review-needed"],
    defaultLayer: "L1",
    mustAppearWhen: ["存在风险、依赖、前提、非承诺口径时"],
    mustCollapseWhen: [],
    forbiddenWhen: ["被埋入证据抽屉", "被移入仅内部之外的客户可见措辞"],
  },
  {
    componentId: "WorkerSummary",
    purpose: "只展示和当前页面判断有关的执行 / role / assignment。",
    inputFields: [
      "pageWorkerSummary",
      "pageWorkerAssignments",
      "collaborationWorkerAssignment",
    ],
    allowedInformationRange: ["相关执行摘要", "当前协作负责人", "受控 assignment 细项"],
    defaultLayer: "L2",
    mustAppearWhen: ["当前判断直接依赖某个执行 / role / assignment 时"],
    mustCollapseWhen: ["没有负责人变化或交接需求时默认下沉到附录"],
    forbiddenWhen: ["展示全量执行 roster", "变成系统设置页"],
  },
  {
    componentId: "WhyItMattersBlock",
    purpose: "只保留一句预览，完整原因继续折叠在后台层，避免系统解释抢走判断与动作主位。",
    inputFields: ["pageWhyItMatters"],
    allowedInformationRange: ["2-3 条关键理由", "当前时点价值"],
    defaultLayer: "L3",
    mustAppearWhen: ["当前页面需要解释时点价值", "判断可能被误解为主观排序时"],
    mustCollapseWhen: ["默认折叠"],
    forbiddenWhen: ["堆入完整历史", "堆入边界或审计明细"],
  },
  {
    componentId: "EvidenceChip",
    purpose: "承担优先级、模式、风险和受控 evidence 线索的轻量提示，不抢走主叙事。",
    inputFields: ["pagePrioritySignal", "leadingChip"],
    allowedInformationRange: ["优先级标签", "模式标签", "少量证据提示"],
    defaultLayer: "L3",
    mustAppearWhen: ["需要用小面积标签提示风险、模式或 evidence 线索时"],
    mustCollapseWhen: ["页面没有必要的优先级或 evidence 线索时"],
    forbiddenWhen: ["变成主判断正文", "承载超过一句话的说明"],
  },
  {
    componentId: "EvidenceDrawer",
    purpose: "承接回放 / 审计 / 经营记忆 / supporting facts，不抢主叙事。",
    inputFields: [
      "pageEvidenceSummary",
      "pageEvidenceLinks",
      "pageEvidenceGroups",
    ],
    allowedInformationRange: ["证据摘要", "grouped evidence", "clickable evidence targets", "drill-down 链接", "审计/回放入口"],
    defaultLayer: "L3",
    mustAppearWhen: ["页面存在支持性依据", "高风险判断需要快速核验时"],
    mustCollapseWhen: ["默认折叠", "除非高风险场景必须露出摘要"],
    forbiddenWhen: ["把当前判断本身放进抽屉", "把边界说明移入抽屉"],
  },
] as const;

export function findNarrativeComponentSpec(
  componentId: NarrativeComponentSpec["componentId"],
) {
  return narrativeComponentSpecs.find((item) => item.componentId === componentId);
}
