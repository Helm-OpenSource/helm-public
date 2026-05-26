export const highFrequencyActionTemplateKeys = [
  "follow-up",
  "review-request",
  "escalation",
  "next-meeting",
  "proposal-offer-next-step",
  "recruiting-next-step",
  "partner-follow-through",
] as const;

export type HighFrequencyActionTemplateKey =
  (typeof highFrequencyActionTemplateKeys)[number];

export type HighFrequencyActionTemplate = {
  key: HighFrequencyActionTemplateKey;
  title: string;
  scene: string;
  owner: string;
  boundary: string;
  prerequisite: string;
  evidenceSource: string;
  expectedOutcome: string;
  href: string;
};

export function buildHighFrequencyActionTemplates(
  english: boolean,
): HighFrequencyActionTemplate[] {
  return [
    {
      key: "follow-up",
      title: english ? "Follow-up action" : "跟进动作",
      scene: english
        ? "Use when a warm lead, active customer or post-meeting lane now needs the next outward move."
        : "适用于暖线线索、活跃客户或会后推进链已经需要下一次对外动作的时候。",
      owner: english ? "Sales" : "销售",
      boundary: english
        ? "External wording still stays inside review-before-send and non-commitment boundary."
        : "对外措辞仍必须留在“先复核再发送”和“不是承诺”边界内。",
      prerequisite: english
        ? "A live judgement, real counterpart context and a visible next ask already exist."
        : "前提是当前判断、真实对口上下文和明确的下一次推进请求都已经存在。",
      evidenceSource: english
        ? "Latest meeting note, inbox pressure and opportunity memory."
        : "最新会议纪要、收件箱压力和机会记忆。",
      expectedOutcome: english
        ? "A clear reply, scheduled next touch or explicit decision path."
        : "产出明确回复、下一次触达时间，或更清楚的决策路径。",
      href: "/inbox",
    },
    {
      key: "review-request",
      title: english ? "Review request action" : "复核申请动作",
      scene: english
        ? "Use when a draft, proposal or risky move now needs explicit decision shape before send or execute."
        : "适用于 draft、提案或高风险动作在发送或执行前需要显式拍板的时候。",
      owner: english
        ? "Founder / Delivery / Customer Success reviewer"
        : "创始人 / 交付 / 客户成功复核人",
      boundary: english
        ? "Review clarifies sendability and boundary; it does not silently convert recommendation into commitment."
        : "复核只负责澄清可发送状态和边界，不会把建议偷偷改写成承诺。",
      prerequisite: english
        ? "A real draft, proposed action or boundary question is already on the table."
        : "前提是当前已经有真实草稿、待执行动作或边界问题。",
      evidenceSource: english
        ? "Approval trace, decision context and boundary note."
        : "审批记录、决策上下文和边界说明。",
      expectedOutcome: english
        ? "An explicit approve / revise / hold decision with clear owner."
        : "产出明确的通过 / 修改 / 暂缓结论，并带着清楚的负责人。",
      href: "/approvals",
    },
    {
      key: "escalation",
      title: english ? "Escalation action" : "升级处理动作",
      scene: english
        ? "Use when a blocker, dependency or risk has outgrown normal follow-through."
        : "适用于阻塞、依赖或风险已经超过普通跟进能处理的范围时。",
      owner: english ? "Customer Success" : "客户成功",
      boundary: english
        ? "Escalation widens ownership and urgency, not customer-visible certainty."
        : "升级扩大的是接手范围和紧急程度，不是对客户的确定性表达。",
      prerequisite: english
        ? "The chain is still materially blocked by a missing decision, dependency or delivery risk."
        : "前提是这条链仍被缺失决策、依赖问题或交付风险实质性卡住。",
      evidenceSource: english
        ? "Blocker trace, success memory and review history."
        : "阻塞记录、客户成功记忆和复核历史。",
      expectedOutcome: english
        ? "An explicit escalated owner, unblocker and next accountable move."
        : "产出明确的升级接手人、解阻动作和下一条可追责的推进动作。",
      href: "/customer-success",
    },
    {
      key: "next-meeting",
      title: english ? "Next meeting action" : "下一次会议动作",
      scene: english
        ? "Use when judgement now needs synchronous alignment instead of another asynchronous loop."
        : "适用于当前判断已经需要同步对齐，而不是继续拉长异步往返的时候。",
      owner: english ? "Delivery / Recruiting / Founder" : "交付 / 招聘 / 创始人",
      boundary: english
        ? "Scheduling can move quickly, but promises and scope must stay bounded."
        : "排会可以加速，但承诺和范围仍必须保持有边界。",
      prerequisite: english
        ? "A real decision gap or clarification gap is already visible."
        : "前提是当前已经显式出现了决策缺口或澄清缺口。",
      evidenceSource: english
        ? "Meeting brief, open questions and current chain pressure."
        : "会议简报、待澄清问题和当前推进压力。",
      expectedOutcome: english
        ? "A scheduled next touch with a clear decision or walkthrough purpose."
        : "产出一场目的明确的下次会议，用于拍板或走查。",
      href: "/meetings",
    },
    {
      key: "proposal-offer-next-step",
      title: english
        ? "Proposal / offer next-step action"
        : "方案 / 报价下一步动作",
      scene: english
        ? "Use when commercial motion is warm but the next sendable move still needs shaping."
        : "适用于商业推进已经变热，但下一步对外动作还需要进一步收形的时候。",
      owner: english ? "Sales / Founder" : "销售 / 创始人",
      boundary: english
        ? "Commercial wording must stay honest about prerequisite, dependency and non-commitment."
        : "商业措辞必须诚实呈现前提、依赖和“不是承诺”的边界。",
      prerequisite: english
        ? "The proposal, package, offer or objection context is already visible."
        : "前提是方案、范围、报价或异议上下文已经可见。",
      evidenceSource: english
        ? "Proposal state, sendability pressure and objection trace."
        : "方案状态、可发送压力和异议记录。",
      expectedOutcome: english
        ? "A cleaner customer-facing next move without overstating certainty."
        : "产出更干净的对客下一步，而不夸大确定性。",
      href: "/opportunities",
    },
    {
      key: "recruiting-next-step",
      title: english ? "Recruiting next-step action" : "招聘下一步动作",
      scene: english
        ? "Use when a candidate lane now needs the next interview, debrief or offer-ready move."
        : "适用于候选人链需要下一轮面试、复盘或 offer 就绪动作的时候。",
      owner: english ? "Recruiting" : "招聘",
      boundary: english
        ? "Candidate-facing tempo stays aligned with role fit, approval and schedule reality."
        : "面对候选人的节奏必须和岗位匹配度、审批和真实排期保持一致。",
      prerequisite: english
        ? "Role demand, candidate fit and current interview state are already explicit."
        : "前提是岗位需求、候选人匹配度和当前面试状态已经明确。",
      evidenceSource: english
        ? "Interview notes, candidate memory and role pressure."
        : "面试记录、候选人记忆和岗位压力。",
      expectedOutcome: english
        ? "A disciplined next recruiting move with less candidate drift."
        : "产出纪律更强的招聘下一步，减少候选人漂移。",
      href: "/operating/roles/recruiting",
    },
    {
      key: "partner-follow-through",
      title: english
        ? "Partner follow-through action"
        : "伙伴推进动作",
      scene: english
        ? "Use when partner fit, custom delivery leverage or customer matching now needs explicit follow-through."
        : "适用于伙伴匹配度、定制交付杠杆或客户匹配现在需要明确跟进的时候。",
      owner: english ? "Partner / Founder / Delivery" : "伙伴 / 创始人 / 交付",
      boundary: english
        ? "Partner motion stays bounded by capability, dependency and custom delivery scope."
        : "伙伴推进仍然受能力、依赖和定制交付范围共同约束。",
      prerequisite: english
        ? "The partner lane, customer match or custom scope is already real enough to act on."
        : "前提是伙伴主线、客户匹配或定制范围已经真实到可以行动。",
      evidenceSource: english
        ? "Partner conversation trace, dependency notes and custom scope memory."
        : "伙伴沟通记录、依赖说明和定制范围记忆。",
      expectedOutcome: english
        ? "An explicit partner next move, customer intro or scoped custom follow-through."
        : "产出明确的伙伴下一步、客户引荐，或范围清楚的定制跟进。",
      href: "/operating/roles/partner",
    },
  ];
}

export function getHighFrequencyActionTemplate(
  key: HighFrequencyActionTemplateKey,
  english: boolean,
) {
  return buildHighFrequencyActionTemplates(english).find(
    (template) => template.key === key,
  );
}

export function buildHighFrequencyActionTemplateHint(
  template: HighFrequencyActionTemplate,
  english: boolean,
) {
  return english
    ? `Owner: ${template.owner}. Boundary: ${template.boundary} Prerequisite: ${template.prerequisite}`
    : `负责人：${template.owner}。边界：${template.boundary} 前提：${template.prerequisite}`;
}
