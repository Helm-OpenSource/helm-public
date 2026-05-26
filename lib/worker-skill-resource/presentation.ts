import type {
  PageDrilldownLink,
  PageEvidenceGroup,
  PageEvidenceTarget,
  PageWorkerAssignment,
} from "@/lib/presentation/reporting-protocol";
import {
  type RepresentativeWorkerSkillFlow,
  type ResourceContract,
  type SkillContract,
  type WorkerContract,
  workerSkillResourceSprint2Blueprint,
} from "@/lib/worker-skill-resource/contract";

export type WorkerSkillResourcePageId =
  | "dashboard"
  | "opportunities"
  | "approvals";

type CreateWorkerSkillResourcePageSupportInput = {
  pageId: WorkerSkillResourcePageId;
  english: boolean;
  supplementalEvidenceSummary?: string[];
  supplementalEvidenceGroups?: PageEvidenceGroup[];
  supplementalWorkerSummary?: string[];
  supplementalWorkerAssignments?: PageWorkerAssignment[];
  supplementalLinks?: PageDrilldownLink[];
};

export type WorkerSkillResourcePageSupport = {
  contractFlowIds: string[];
  contractWorkerIds: string[];
  contractSkillIds: string[];
  contractResourceIds: string[];
  pageEvidenceLinks: PageDrilldownLink[];
  pageEvidenceGroups: PageEvidenceGroup[];
  pageEvidenceSummary: string[];
  pageWorkerAssignments: PageWorkerAssignment[];
  pageWorkerSummary: string[];
};

type EvidencePayloadGroupId =
  | "replay_payload"
  | "audit_payload"
  | "memory_payload"
  | "handoff_payload";

type CreateEvidencePayloadGroupsInput = {
  english: boolean;
  replayItems?: PageEvidenceTarget[];
  auditItems?: PageEvidenceTarget[];
  memoryItems?: PageEvidenceTarget[];
  handoffItems?: PageEvidenceTarget[];
};

const workerLabels = {
  founder_assistant: {
    english: "Founder Assistant Worker",
    chinese: "创始人助理",
  },
  sales_assistant: {
    english: "Sales Assistant Worker",
    chinese: "销售助理",
  },
  delivery_assistant: {
    english: "Delivery Assistant Worker",
    chinese: "交付助理",
  },
  customer_success_assistant: {
    english: "Customer Success Assistant Worker",
    chinese: "客户成功助理",
  },
} as const;

const skillLabels = {
  followup_draft: {
    english: "follow-up drafting",
    chinese: "跟进草拟",
  },
  objection_handling: {
    english: "objection handling",
    chinese: "异议处理",
  },
  activation_checklist: {
    english: "activation checklist preparation",
    chinese: "激活清单准备",
  },
  proposal_shaping: {
    english: "proposal shaping",
    chinese: "方案整形",
  },
  review_note: {
    english: "review-note packaging",
    chinese: "复核记录整理",
  },
  expansion_review: {
    english: "expansion review",
    chinese: "扩展评估",
  },
  boundary_clarification: {
    english: "boundary clarification",
    chinese: "边界澄清",
  },
  risk_clarification: {
    english: "risk clarification",
    chinese: "风险澄清",
  },
} as const;

const outputModeLabels = {
  internal_summary: {
    english: "internal summary",
    chinese: "内部摘要",
  },
  internal_recommendation: {
    english: "internal recommendation",
    chinese: "内部建议",
  },
  internal_draft: {
    english: "internal draft",
    chinese: "内部草稿",
  },
  customer_safe_draft: {
    english: "customer-safe draft",
    chinese: "客户安全草稿",
  },
  review_package: {
    english: "review package",
    chinese: "复核包",
  },
} as const;

const reviewModeLabels = {
  internal_only: {
    english: "internal-only",
    chinese: "仅内部",
  },
  review_before_send: {
    english: "review-before-send",
    chinese: "发送前复核",
  },
  approval_required: {
    english: "approval-required",
    chinese: "需要审批",
  },
} as const;

const escalationModeLabels = {
  route_to_owner: {
    english: "route to owner",
    chinese: "交给负责人",
  },
  route_to_review_queue: {
    english: "route to review queue",
    chinese: "路由到复核队列",
  },
  route_to_founder: {
    english: "route to founder",
    chinese: "路由给创始人",
  },
} as const;

const flowLabels = {
  "sales-followup-draft": {
    english: "Sales follow-up draft path",
    chinese: "销售跟进草稿路径",
  },
  "delivery-activation-checklist": {
    english: "Delivery activation checklist path",
    chinese: "交付激活 checklist 路径",
  },
  "success-expansion-review": {
    english: "Success expansion review path",
    chinese: "成功扩展评估路径",
  },
  "sales-objection-response": {
    english: "Sales objection response path",
    chinese: "销售异议回复路径",
  },
  "proposal-shaping-review": {
    english: "Proposal shaping review path",
    chinese: "方案整形评审路径",
  },
  "review-note-preparation": {
    english: "Review-note preparation path",
    chinese: "复核记录准备路径",
  },
  "founder-risk-clarification": {
    english: "Founder risk clarification path",
    chinese: "创始人风险澄清路径",
  },
} as const;

const resourceLabels = {
  crm_connector: {
    english: "CRM context",
    chinese: "CRM 上下文",
  },
  email_draft: {
    english: "email drafting",
    chinese: "邮件草稿",
  },
  docs_query: {
    english: "docs context",
    chinese: "文档依据",
  },
  browser_research: {
    english: "browser research",
    chinese: "网页调研",
  },
  workspace_state: {
    english: "workspace state",
    chinese: "workspace 状态",
  },
  membership_state: {
    english: "membership state",
    chinese: "membership 状态",
  },
  callback_status: {
    english: "callback status",
    chinese: "回调状态",
  },
  usage_signal: {
    english: "usage signals",
    chinese: "使用信号",
  },
  success_review: {
    english: "success review",
    chinese: "成功复核",
  },
  proposal_context: {
    english: "proposal context",
    chinese: "方案上下文",
  },
  review_queue: {
    english: "review queue",
    chinese: "复核队列",
  },
  risk_signal: {
    english: "risk signals",
    chinese: "风险信号",
  },
} as const;

const checkLabels = {
  review: {
    english: "review",
    chinese: "复核",
  },
  approval: {
    english: "approval",
    chinese: "审批",
  },
  replay: {
    english: "replay",
    chinese: "回放",
  },
  audit: {
    english: "audit",
    chinese: "审计",
  },
  memory: {
    english: "memory",
    chinese: "记忆",
  },
  boundary: {
    english: "boundary",
    chinese: "边界",
  },
  external_safe_wording: {
    english: "external-safe wording",
    chinese: "外发安全措辞",
  },
} as const;

const surfaceLabels = {
  dashboard: {
    english: "dashboard judgement layer",
    chinese: "首页判断层",
  },
  opportunities: {
    english: "opportunity board",
    chinese: "机会面",
  },
  approvals: {
    english: "approval surface",
    chinese: "审批面",
  },
} as const;

const pageFlowIds = {
  dashboard: [
    "founder-risk-clarification",
    "proposal-shaping-review",
    "review-note-preparation",
  ],
  opportunities: [
    "sales-followup-draft",
    "sales-objection-response",
    "proposal-shaping-review",
  ],
  approvals: [
    "sales-objection-response",
    "proposal-shaping-review",
    "review-note-preparation",
  ],
} as const satisfies Record<WorkerSkillResourcePageId, string[]>;

const checkDisplayOrder = [
  "review",
  "approval",
  "replay",
  "audit",
  "memory",
  "boundary",
  "external_safe_wording",
] as const;

const evidenceGroupOrder = [
  "contract_flows",
  "worker_boundaries",
  "resource_bindings",
  "control_plane_checks",
  "fallback_paths",
] as const;

const evidencePayloadGroupOrder = [
  "replay_payload",
  "audit_payload",
  "memory_payload",
  "handoff_payload",
] as const satisfies readonly EvidencePayloadGroupId[];

const evidencePayloadLabels = {
  replay_payload: {
    english: "Replay payload",
    chinese: "回放材料",
  },
  audit_payload: {
    english: "Audit payload",
    chinese: "审计材料",
  },
  memory_payload: {
    english: "Memory payload",
    chinese: "记忆材料",
  },
  handoff_payload: {
    english: "Handoff payload",
    chinese: "交接材料",
  },
} as const;

const localizedRouteLabels = {
  "/approvals": {
    english: "Open approvals",
    chinese: "打开审批中心",
  },
  "/memory": {
    english: "Open memory timeline",
    chinese: "打开记忆时间线",
  },
  "/opportunities": {
    english: "Open opportunity workspace",
    chinese: "打开机会面板",
  },
  "/dashboard": {
    english: "Open dashboard brief",
    chinese: "打开首页简报",
  },
} as const;

const workerIndex = new Map(
  workerSkillResourceSprint2Blueprint.workers.map((worker) => [
    worker.workerId,
    worker,
  ]),
);
const skillIndex = new Map(
  workerSkillResourceSprint2Blueprint.skills.map((skill) => [skill.skillId, skill]),
);
const bindingIndex = new Map(
  workerSkillResourceSprint2Blueprint.resourceBindings.map((binding) => [
    binding.bindingId,
    binding,
  ]),
);
const resourceIndex = new Map(
  workerSkillResourceSprint2Blueprint.resources.map((resource) => [
    resource.resourceId,
    resource,
  ]),
);
const flowIndex = new Map(
  workerSkillResourceSprint2Blueprint.representativeFlows.map((flow) => [
    flow.flowId,
    flow,
  ]),
);

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function dedupeLinks(links: PageDrilldownLink[]) {
  const seen = new Set<string>();
  const deduped: PageDrilldownLink[] = [];

  for (const link of links) {
    if (seen.has(link.href)) {
      continue;
    }
    seen.add(link.href);
    deduped.push(link);
  }

  return deduped.slice(0, 4);
}

function dedupeTargets(items: PageEvidenceTarget[], max = 4) {
  const deduped = new Map<string, PageEvidenceTarget>();

  for (const item of items) {
    const key = item.itemId.trim() || `${item.href}::${item.label}`;
    if (!key || deduped.has(key)) {
      continue;
    }
    deduped.set(key, item);
  }

  return Array.from(deduped.values()).slice(0, max);
}

function joinItems(items: string[], english: boolean) {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) {
    return english ? `${items[0]} and ${items[1]}` : `${items[0]}和${items[1]}`;
  }

  const head = items.slice(0, -1).join(english ? ", " : "、");
  const tail = items.at(-1);
  return english ? `${head}, and ${tail}` : `${head}和${tail}`;
}

function formatChinesePageSupportText(value: string) {
  return value
    .replace(
      /May prepare customer-safe drafts, but cannot send or strengthen commitment by itself\./gi,
      "可以准备客户可读草稿，但不能自行发送，也不能把建议变成承诺。",
    )
    .replace(
      /May update internal readiness state, but cannot present it as customer-ready commitment by itself\./gi,
      "可以更新内部准备状态，但不能自行把它包装成面向客户的承诺。",
    )
    .replace(
      /Read commercial context before shaping a proposal draft\./gi,
      "先读取商业上下文，再整理方案草稿。",
    )
    .replace(
      /Read boundary, package and governance notes for proposal shaping\./gi,
      "先读取边界、方案包和治理说明，再整理方案。",
    )
    .replace(
      /Read proposal and package context for shaping and review packaging\./gi,
      "先读取方案与方案包上下文，再整理复核材料。",
    )
    .replace(
      /Delivery outputs stay internal until a human confirms external-safe wording\./gi,
      "交付输出在人工确认外发安全措辞前只能留在内部。",
    )
    .replace(
      /Customer-visible language must remain review-before-send and non-commitment-only\./gi,
      "客户可见措辞必须保持发送前复核，并且不能形成承诺。",
    )
    .replace(
      /Customer-visible language must remain review-before-send and non-commitment-only/gi,
      "客户可见措辞必须保持发送前复核，并且不能形成承诺",
    )
    .replace(/review-before-send/gi, "发送前复核")
    .replace(/customer-visible/gi, "客户可见")
    .replace(/external-safe wording/gi, "外发安全措辞")
    .replace(/external-safe/gi, "外发安全")
    .replace(/customer-safe drafts?/gi, "客户可读草稿")
    .replace(/customer-ready commitment/gi, "面向客户的承诺")
    .replace(/commercial context/gi, "商业上下文")
    .replace(/proposal draft/gi, "方案草稿")
    .replace(/proposal shaping/gi, "方案整理")
    .replace(/review packaging/gi, "复核材料整理")
    .replace(/package context/gi, "方案包上下文")
    .replace(/governance notes/gi, "治理说明")
    .replace(/internal readiness state/gi, "内部准备状态")
    .replace(/non-commitment-only/gi, "非承诺")
    .replace(/review-first/gi, "先复核")
    .replace(/\breview note\b/gi, "复核记录")
    .replace(/\breview\b/gi, "复核")
    .replace(/\bowner\b/gi, "负责人")
    .replace(/\bskill\b/gi, "能力")
    .replace(/\bproposal\b/gi, "方案")
    .replace(/\bpackage\b/gi, "方案包")
    .replace(/\bgovernance\b/gi, "治理")
    .replace(/\breadiness\b/gi, "准备状态")
    .replace(/\bcommitment\b/gi, "承诺")
    .replace(/\bfact\b/gi, "事实")
    .replace(/\bmemory\b/gi, "记忆")
    .replace(/\baudit\b/gi, "审计")
    .replace(/\breplay\b/gi, "回放");
}

function localizeWorker(worker: WorkerContract, english: boolean) {
  const label = workerLabels[worker.workerRole];
  return english ? label.english : label.chinese;
}

function localizeSkill(skill: SkillContract, english: boolean) {
  const label = skillLabels[skill.skillType];
  return english ? label.english : label.chinese;
}

function localizeOutputMode(
  outputMode: RepresentativeWorkerSkillFlow["outputMode"],
  english: boolean,
) {
  const label = outputModeLabels[outputMode];
  return english ? label.english : label.chinese;
}

function localizeReviewMode(
  reviewMode: WorkerContract["reviewMode"],
  english: boolean,
) {
  const label = reviewModeLabels[reviewMode];
  return english ? label.english : label.chinese;
}

function localizeEscalationMode(
  escalationMode: WorkerContract["escalationMode"],
  english: boolean,
) {
  const label = escalationModeLabels[escalationMode];
  return english ? label.english : label.chinese;
}

function localizeResource(resource: ResourceContract, english: boolean) {
  const label = resourceLabels[resource.resourceType];
  return english ? label.english : label.chinese;
}

function localizeCheck(
  check: RepresentativeWorkerSkillFlow["controlPlaneChecks"][number],
  english: boolean,
) {
  const label = checkLabels[check];
  return english ? label.english : label.chinese;
}

function localizeSurface(pageId: WorkerSkillResourcePageId, english: boolean) {
  const label = surfaceLabels[pageId];
  return english ? label.english : label.chinese;
}

function localizeFlow(flowId: RepresentativeWorkerSkillFlow["flowId"], english: boolean) {
  const label = flowLabels[flowId as keyof typeof flowLabels];
  if (!label) {
    return flowId;
  }
  return english ? label.english : label.chinese;
}

function localizeRoute(href: keyof typeof localizedRouteLabels, english: boolean) {
  const label = localizedRouteLabels[href];
  return {
    href,
    label: english ? label.english : label.chinese,
  };
}

function localizeEvidencePayloadGroup(
  groupId: EvidencePayloadGroupId,
  english: boolean,
) {
  const label = evidencePayloadLabels[groupId];
  return english ? label.english : label.chinese;
}

function getRequiredFlow(flowId: string) {
  const flow = flowIndex.get(flowId);
  if (!flow) {
    throw new Error(`unknown worker / skill / resource flow: ${flowId}`);
  }
  return flow;
}

function getRequiredWorker(workerId: string) {
  const worker = workerIndex.get(workerId);
  if (!worker) {
    throw new Error(`unknown worker in page support: ${workerId}`);
  }
  return worker;
}

function getRequiredSkill(skillId: string) {
  const skill = skillIndex.get(skillId);
  if (!skill) {
    throw new Error(`unknown skill in page support: ${skillId}`);
  }
  return skill;
}

function getRequiredBinding(bindingId: string) {
  const binding = bindingIndex.get(bindingId);
  if (!binding) {
    throw new Error(`unknown binding in page support: ${bindingId}`);
  }
  return binding;
}

function getRequiredResource(resourceId: string) {
  const resource = resourceIndex.get(resourceId);
  if (!resource) {
    throw new Error(`unknown resource in page support: ${resourceId}`);
  }
  return resource;
}

function buildContractLinks(
  pageId: WorkerSkillResourcePageId,
  flows: RepresentativeWorkerSkillFlow[],
  resources: ResourceContract[],
  english: boolean,
) {
  const checks = unique(flows.flatMap((flow) => flow.controlPlaneChecks));
  const resourceTypes = unique(resources.map((resource) => resource.resourceType));
  const links: PageDrilldownLink[] = [];

  if (checks.includes("memory")) {
    links.push(localizeRoute("/memory", english));
  }

  if (
    pageId !== "approvals" &&
    (checks.includes("review") || checks.includes("approval"))
  ) {
    links.push(localizeRoute("/approvals", english));
  }

  if (
    pageId !== "opportunities" &&
    resourceTypes.some((resourceType) =>
      [
        "crm_connector",
        "email_draft",
        "proposal_context",
        "browser_research",
      ].includes(resourceType),
    )
  ) {
    links.push(localizeRoute("/opportunities", english));
  }

  if (pageId !== "dashboard" && resourceTypes.includes("risk_signal")) {
    links.push(localizeRoute("/dashboard", english));
  }

  return links;
}

function buildWorkerAssignments(
  workers: WorkerContract[],
  flows: RepresentativeWorkerSkillFlow[],
  english: boolean,
): PageWorkerAssignment[] {
  return workers.map((worker) => {
    const workerFlows = flows.filter((flow) => flow.workerId === worker.workerId);
    const workerSkills = unique(
      workerFlows.map((flow) => getRequiredSkill(flow.skillId)),
    );
    const flowOutputModes = unique(workerFlows.map((flow) => flow.outputMode));

    return {
      assignmentId: worker.workerId,
      title: localizeWorker(worker, english),
      summary: english
        ? `${joinItems(
            workerSkills.map((skill) => localizeSkill(skill, true)),
            true,
          )} are currently staged as ${joinItems(
            flowOutputModes.map((outputMode) => localizeOutputMode(outputMode, true)),
            true,
          )} outputs.`
        : `${joinItems(
            workerSkills.map((skill) => localizeSkill(skill, false)),
            false,
          )}当前会被整理成${joinItems(
            flowOutputModes.map((outputMode) => localizeOutputMode(outputMode, false)),
            false,
          )}这些输出。`,
      chips: [
        localizeReviewMode(worker.reviewMode, english),
        localizeEscalationMode(worker.escalationMode, english),
      ],
      items: [
        english
          ? `In-play flows: ${joinItems(
              workerFlows.map((flow) => localizeFlow(flow.flowId, true)),
              true,
            )}.`
          : `当前接入路径：${joinItems(
              workerFlows.map((flow) => localizeFlow(flow.flowId, false)),
              false,
            )}。`,
        english
          ? `Default skills in view: ${joinItems(
              workerSkills.map((skill) => localizeSkill(skill, true)),
              true,
            )}.`
          : `当前可见的默认能力：${joinItems(
              workerSkills.map((skill) => localizeSkill(skill, false)),
              false,
            )}。`,
        english
          ? `Authority boundary: ${worker.authorityBoundary[0]}`
          : `权限边界：${formatChinesePageSupportText(
              worker.authorityBoundary[0],
            )}`,
      ],
    };
  });
}

function buildEvidenceGroups(
  flows: RepresentativeWorkerSkillFlow[],
  workers: WorkerContract[],
  skills: SkillContract[],
  bindings: ReturnType<typeof getRequiredBinding>[],
  english: boolean,
): PageEvidenceGroup[] {
  const groups: PageEvidenceGroup[] = [];
  const workerById = new Map(workers.map((worker) => [worker.workerId, worker]));
  const skillById = new Map(skills.map((skill) => [skill.skillId, skill]));
  const contractFlows = flows.map((flow) => {
    const worker = workerById.get(flow.workerId);
    const skill = skillById.get(flow.skillId);
    if (!worker || !skill) {
      throw new Error(`missing worker or skill while building evidence groups for ${flow.flowId}`);
    }
    return english
      ? `${localizeFlow(flow.flowId, true)} keeps ${localizeWorker(
          worker,
          true,
        )} on ${localizeSkill(skill, true)} with a ${localizeOutputMode(
          flow.outputMode,
          true,
        )} outcome.`
      : `${localizeFlow(flow.flowId, false)}会让${localizeWorker(
          worker,
          false,
        )}围绕${localizeSkill(skill, false)}产出${localizeOutputMode(
          flow.outputMode,
          false,
        )}。`;
  });
  groups.push({
    groupId: "contract_flows",
    label: english ? "Contract flows" : "协作路径",
    items: contractFlows,
  });

  groups.push({
    groupId: "worker_boundaries",
    label: english ? "Worker boundaries" : "协作者边界",
    items: workers.map((worker) =>
      english
        ? `${localizeWorker(worker, true)} stays at ${localizeReviewMode(
            worker.reviewMode,
            true,
          )} and ${localizeEscalationMode(
            worker.escalationMode,
            true,
          )}; ${worker.responsibilityBoundary[0]}`
        : `${localizeWorker(worker, false)}当前停在${localizeReviewMode(
            worker.reviewMode,
            false,
          )}、${localizeEscalationMode(
            worker.escalationMode,
            false,
          )}这条路径上；${formatChinesePageSupportText(
            worker.responsibilityBoundary[0],
          )}`,
    ),
  });

  groups.push({
    groupId: "resource_bindings",
    label: english ? "Bounded resources" : "受控资料",
    items: bindings.map((binding) => {
      const resource = getRequiredResource(binding.resourceId);
      return english
        ? `${localizeResource(resource, true)}: ${binding.resourceCapability}`
        : `${localizeResource(resource, false)}：${formatChinesePageSupportText(
            binding.resourceCapability,
          )}`;
    }),
  });

  groups.push({
    groupId: "control_plane_checks",
    label: english ? "Control-plane checks" : "控制检查",
    items: flows.map((flow) =>
      english
        ? `${localizeFlow(flow.flowId, true)} still passes through ${joinItems(
            flow.controlPlaneChecks.map((check) => localizeCheck(check, true)),
            true,
          )}.`
        : `${localizeFlow(flow.flowId, false)}仍然要经过${joinItems(
            flow.controlPlaneChecks.map((check) => localizeCheck(check, false)),
            false,
          )}。`,
    ),
  });

  const fallbackItems = unique(
    skills.flatMap((skill) => {
      if (!skill.fallbackBindings.length) {
        return [];
      }
      const fallbackResources = skill.fallbackBindings.map((bindingId) =>
        localizeResource(
          getRequiredResource(getRequiredBinding(bindingId).resourceId),
          english,
        ),
      );
      return [
        english
          ? `${localizeSkill(skill, true)} falls back to ${joinItems(
              fallbackResources,
              true,
            )} when richer paths are unavailable.`
          : `${localizeSkill(skill, false)}在更强路径不可用时，会回退到${joinItems(
              fallbackResources,
              false,
            )}。`,
      ];
    }),
  );

  if (fallbackItems.length) {
    groups.push({
      groupId: "fallback_paths",
      label: english ? "Fallback paths" : "后备路径",
      items: fallbackItems,
    });
  }

  return evidenceGroupOrder
    .map((groupId) => groups.find((group) => group.groupId === groupId))
    .filter(isDefined);
}

export function createEvidencePayloadGroups({
  english,
  replayItems = [],
  auditItems = [],
  memoryItems = [],
  handoffItems = [],
}: CreateEvidencePayloadGroupsInput): PageEvidenceGroup[] {
  const itemsByGroup: Record<EvidencePayloadGroupId, PageEvidenceTarget[]> = {
    replay_payload: dedupeTargets(replayItems),
    audit_payload: dedupeTargets(auditItems),
    memory_payload: dedupeTargets(memoryItems),
    handoff_payload: dedupeTargets(handoffItems),
  };
  const groups: PageEvidenceGroup[] = [];

  for (const groupId of evidencePayloadGroupOrder) {
    const items = itemsByGroup[groupId];
    if (items.length === 0) {
      continue;
    }

    groups.push({
      groupId,
      label: localizeEvidencePayloadGroup(groupId, english),
      items,
    });
  }

  return groups;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function createWorkerSkillResourcePageSupport({
  pageId,
  english,
  supplementalEvidenceSummary = [],
  supplementalEvidenceGroups = [],
  supplementalWorkerSummary = [],
  supplementalWorkerAssignments = [],
  supplementalLinks = [],
}: CreateWorkerSkillResourcePageSupportInput): WorkerSkillResourcePageSupport {
  const contractFlowIds = pageFlowIds[pageId];
  const flows = contractFlowIds.map((flowId) => getRequiredFlow(flowId));
  const workers = unique(flows.map((flow) => getRequiredWorker(flow.workerId)));
  const skills = unique(flows.map((flow) => getRequiredSkill(flow.skillId)));
  const bindings = unique(
    flows.flatMap((flow) =>
      flow.resourceBindingIds.map((bindingId) => getRequiredBinding(bindingId)),
    ),
  );
  const resources = unique(
    bindings.map((binding) => getRequiredResource(binding.resourceId)),
  );
  const checks = checkDisplayOrder.filter((check) =>
    flows.some((flow) => flow.controlPlaneChecks.includes(check)),
  );
  const outputModes = unique(flows.map((flow) => flow.outputMode));
  const surfaceLabel = localizeSurface(pageId, english);
  const workerAssignments = buildWorkerAssignments(workers, flows, english);
  const evidenceGroups = buildEvidenceGroups(
    flows,
    workers,
    skills,
    bindings,
    english,
  );
  const workerLabelsForPage = workers.map((worker) =>
    localizeWorker(worker, english),
  );
  const skillLabelsForPage = skills.map((skill) => localizeSkill(skill, english));
  const resourceLabelsForPage = resources.map((resource) =>
    localizeResource(resource, english),
  );
  const checkLabelsForPage = checks.map((check) => localizeCheck(check, english));
  const outputModeLabelsForPage = outputModes.map((outputMode) =>
    localizeOutputMode(outputMode, english),
  );
  const workerSummary = english
    ? `${joinItems(workerLabelsForPage, true)} ${
        workerLabelsForPage.length > 1 ? "are" : "is"
      } already coordinating ${joinItems(
        skillLabelsForPage,
        true,
      )} across ${joinItems(
        outputModeLabelsForPage,
        true,
      )} outputs before the ${surfaceLabel} drops back into raw objects.`
    : `${joinItems(
        workerLabelsForPage,
        false,
      )}已经先把${joinItems(skillLabelsForPage, false)}接进${joinItems(
        outputModeLabelsForPage,
        false,
      )}这些输出层里，再把原始对象留给${surfaceLabel}继续下钻。`;
  const evidenceSummary = english
    ? `Contract-backed evidence here still reaches into ${joinItems(
        resourceLabelsForPage,
        true,
      )}, so the page keeps basis and replay paths visible instead of flattening everything into conclusion-only copy.`
    : `这里的契约证据仍然能下钻到${joinItems(
        resourceLabelsForPage,
        false,
      )}，所以页面保留的不是只有结论，还包括依据和回放入口。`;
  const controlPlaneSummary = english
    ? `The same flows still keep ${joinItems(
        checkLabelsForPage,
        true,
      )} attached through the control plane, which is why review, boundary and execution proof remain visible before anything turns real.`
    : `同一组路径仍把${joinItems(
        checkLabelsForPage,
        false,
      )}这些控制面检查一起带着，所以在任何动作变成真实执行前，复核、边界和执行依据都还能被看见。`;

  return {
    contractFlowIds: [...contractFlowIds],
    contractWorkerIds: workers.map((worker) => worker.workerId),
    contractSkillIds: skills.map((skill) => skill.skillId),
    contractResourceIds: resources.map((resource) => resource.resourceId),
    pageWorkerAssignments: [
      ...supplementalWorkerAssignments,
      ...workerAssignments,
    ],
    pageWorkerSummary: unique([
      ...supplementalWorkerSummary,
      workerSummary,
    ]).filter(Boolean),
    pageEvidenceGroups: [...supplementalEvidenceGroups, ...evidenceGroups],
    pageEvidenceSummary: unique([
      ...supplementalEvidenceSummary,
      evidenceSummary,
      controlPlaneSummary,
    ]).filter(Boolean),
    pageEvidenceLinks: dedupeLinks([
      ...supplementalLinks,
      ...buildContractLinks(pageId, flows, resources, english),
    ]),
  };
}
