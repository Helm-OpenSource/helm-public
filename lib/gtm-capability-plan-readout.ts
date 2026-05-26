import type {
  ActionStatus,
  ApprovalStatus,
  PartnerProgramStatus,
  ProgramApplicationStatus,
  SalesReferralStatus,
} from "@prisma/client";
import type { GtmDemandBriefDraftActionInput } from "@/lib/gtm-customer-demand-brief-draft";

export type GtmCapabilityPlanStatus = "ready" | "review_required" | "planned";

export type GtmCapabilityPlanReadoutItem = {
  id: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  blocker: string;
  nextAction: string;
  href: string;
  priorityScore: number;
};

export type GtmCapabilityPlanReadout = {
  visible: true;
  title: string;
  summary: string;
  boundary: string;
  counts: {
    programCount: number;
    applicationCount: number;
    submittedApplicationCount: number;
    acceptedPendingInviteCount: number;
    activeReferralCount: number;
    programTermsGapCount: number;
  };
  topWorkItems: GtmCapabilityPlanReadoutItem[];
  guidedIntake: GtmGuidedIntakeBriefPrototype;
  demandBriefDraftFlow: GtmDemandBriefDraftFlowPrototype;
  confirmationAndEvidence: GtmConfirmationEvidencePrototype;
  diagnosticAndProofPack: GtmDiagnosticProofPackPrototype;
  capabilityPlans: Array<{
    id: string;
    label: string;
    status: GtmCapabilityPlanStatus;
    nextAction: string;
  }>;
};

export type GtmGuidedIntakeEntryMode = "sales_led" | "self_serve";

export type GtmGuidedIntakeStep = {
  id: string;
  label: string;
  questionCount: number;
  inputMode: string;
};

export type GtmGuidedIntakeBriefPrototype = {
  title: string;
  entryModes: Array<{
    id: GtmGuidedIntakeEntryMode;
    label: string;
    posture: string;
  }>;
  requiredFields: string[];
  steps: GtmGuidedIntakeStep[];
  missingInformation: string[];
  sourceTracePreview: string[];
  cleanHandoffChecks: string[];
  reviewGate: string;
};

export type GtmConfirmationEvidencePrototype = {
  title: string;
  allowedCustomerActions: Array<{
    id: "confirm" | "supplement" | "request_change";
    label: string;
    directApply: boolean;
    boundary: string;
  }>;
  materialRewriteFields: string[];
  controlLineTemplates: Array<{
    id: string;
    label: string;
    evidenceNeeded: string;
    manualAction: string;
    status: "draft" | "evidence_needed" | "review_required" | "trial_premise";
  }>;
  evidenceDowngradeRule: string;
};

export type GtmDiagnosticProofPackPrototype = {
  title: string;
  firstLoopContract: string[];
  diagnosticTriggers: string[];
  proofPackChecks: string[];
  claimLevels: Array<{
    id: "hypothesis" | "internal_proof" | "public_candidate";
    label: string;
    boundary: string;
  }>;
  publicUseGate: string;
};

export type GtmDemandBriefDraftTarget = {
  applicationId: string;
  label: string;
  sourceLabel: string;
  posture: string;
  missingInformation: string[];
  hasOpenDraft: boolean;
  latestDraftId: string | null;
  latestApprovalTaskId: string | null;
  latestDraftStatusLabel: string | null;
};

export type GtmDemandBriefDraftSummary = {
  id: string;
  label: string;
  statusLabel: string;
  applicationId: string | null;
  approvalTaskId: string | null;
};

export type GtmDemandBriefDraftFlowPrototype = {
  title: string;
  summary: string;
  boundary: string;
  actionLabel: string;
  existingDraftLabel: string;
  targets: GtmDemandBriefDraftTarget[];
  recentDrafts: GtmDemandBriefDraftSummary[];
};

export type GtmCapabilityPlanProgramInput = {
  id: string;
  title: string;
  slug: string;
  status: PartnerProgramStatus;
  applicationCount: number;
  activeTermsVersion: { id: string } | null;
};

export type GtmCapabilityPlanApplicationInput = {
  id: string;
  applicantName: string;
  applicantOrganization: string | null;
  status: ProgramApplicationStatus;
  createdAt: Date;
  partnerProgram: {
    title: string;
    slug: string;
  } | null;
  participantPortalAccess: {
    id: string;
  } | null;
};

export type GtmCapabilityPlanSalesReferralInput = {
  id: string;
  beneficiaryLabel: string;
  status: SalesReferralStatus;
  createdAt: Date;
};

export type GtmCapabilityPlanReadoutInput = {
  english: boolean;
  programs: GtmCapabilityPlanProgramInput[];
  applications: GtmCapabilityPlanApplicationInput[];
  salesReferrals: GtmCapabilityPlanSalesReferralInput[];
  demandBriefDrafts?: GtmDemandBriefDraftActionInput[];
};

function programTitle(program: { title: string } | null, english: boolean) {
  return program?.title || (english ? "Program" : "合作项目");
}

function applicantLabel(application: GtmCapabilityPlanApplicationInput) {
  return application.applicantOrganization?.trim() || application.applicantName;
}

function applicationStatusLabel(
  status: ProgramApplicationStatus,
  english: boolean,
) {
  if (english) return status;

  switch (status) {
    case "SUBMITTED":
      return "已提交";
    case "ACCEPTED":
      return "已接受";
    case "WAITLISTED":
      return "等待名单";
    case "REJECTED":
      return "已拒绝";
    default:
      return status;
  }
}

function submittedApplicationItem(
  application: GtmCapabilityPlanApplicationInput,
  english: boolean,
): GtmCapabilityPlanReadoutItem {
  const label = applicantLabel(application);
  return {
    id: `application-review:${application.id}`,
    title: english ? `Review application: ${label}` : `复核申请：${label}`,
    subtitle: english
      ? `${programTitle(application.partnerProgram, true)} · controlled application intake`
      : `${programTitle(application.partnerProgram, false)} · 受控申请入口`,
    statusLabel: english ? "Review required" : "需要内部复核",
    blocker: english
      ? "Application is submitted but not yet accepted, waitlisted or rejected."
      : "申请已提交，但还没有接受、等待名单或拒绝结论。",
    nextAction: english
      ? "Open the reserved billing/program review surface and record the decision."
      : "打开保留区账务 / 合作项目复核面，记录审核结论。",
    href: "/settings?tab=billing",
    priorityScore: 120,
  };
}

function acceptedPendingInviteItem(
  application: GtmCapabilityPlanApplicationInput,
  english: boolean,
): GtmCapabilityPlanReadoutItem {
  const label = applicantLabel(application);
  return {
    id: `application-invite:${application.id}`,
    title: english ? `Issue controlled invite: ${label}` : `发放受控邀请：${label}`,
    subtitle: english
      ? `${programTitle(application.partnerProgram, true)} · accepted but no portal access`
      : `${programTitle(application.partnerProgram, false)} · 已接受但未发放门户访问`,
    statusLabel: english ? "Invite pending" : "待发邀请",
    blocker: english
      ? "Accepted does not create participant portal access automatically."
      : "accepted 不会自动创建参与方门户访问。",
    nextAction: english
      ? "Issue the invite only after the internal review posture is still valid."
      : "确认内部复核姿态仍成立后，再发放邀请。",
    href: "/settings?tab=billing",
    priorityScore: 105,
  };
}

function programTermsGapItem(
  program: GtmCapabilityPlanProgramInput,
  english: boolean,
): GtmCapabilityPlanReadoutItem {
  return {
    id: `program-terms-gap:${program.id}`,
    title: english ? `Repair active terms: ${program.title}` : `补齐有效条款：${program.title}`,
    subtitle: english
      ? "Program catalog needs an active terms version before it can anchor GTM intake."
      : "合作项目目录需要有效条款，才能承接 GTM intake。",
    statusLabel: english ? "Terms gap" : "条款缺口",
    blocker: english
      ? "The program exists, but no active terms version is available for controlled application review."
      : "合作项目存在，但缺少可用于受控申请审核的有效条款版本。",
    nextAction: english
      ? "Restore the active terms baseline before widening GTM motion."
      : "先恢复有效条款基线，再扩大 GTM 推进。",
    href: `/programs/${program.slug}`,
    priorityScore: 92,
  };
}

function referralProofItem(
  referral: GtmCapabilityPlanSalesReferralInput,
  english: boolean,
): GtmCapabilityPlanReadoutItem {
  return {
    id: `referral-proof:${referral.id}`,
    title: english
      ? `Review referral proof: ${referral.beneficiaryLabel}`
      : `复核转介绍证据：${referral.beneficiaryLabel}`,
    subtitle: english
      ? "Referral can inform GTM attribution, but it is not payable by itself."
      : "转介绍可以进入 GTM 归因判断，但本身不等于应付款。",
    statusLabel: english ? "Proof candidate" : "证据候选",
    blocker: english
      ? "Contribution evidence must stay separate from settlement or payout execution."
      : "贡献证据必须与结算或打款执行保持分离。",
    nextAction: english
      ? "Attach proof or keep it as a reviewed GTM signal only."
      : "补充证据，或继续只作为已复核 GTM 信号保留。",
    href: "/settings?tab=billing",
    priorityScore: 70,
  };
}

function actionStatusLabel(status: ActionStatus, english: boolean) {
  switch (status) {
    case "PENDING_APPROVAL":
      return english ? "pending review" : "待复核";
    case "APPROVED":
      return english ? "reviewed candidate" : "已复核候选";
    case "EXECUTED":
      return english ? "closed" : "已关闭";
    case "REJECTED":
      return english ? "rejected" : "已拒绝";
    case "WITHDRAWN":
      return english ? "withdrawn" : "已撤回";
    case "BLOCKED":
      return english ? "blocked" : "已阻断";
    case "MANUAL":
      return english ? "manual review" : "人工处理";
    case "SUGGESTED":
    default:
      return english ? "draft" : "草稿";
  }
}

function approvalStatusLabel(status: ApprovalStatus | null, english: boolean) {
  if (!status) return null;
  switch (status) {
    case "PENDING":
      return english ? "approval pending" : "审批待处理";
    case "EXECUTED":
      return english ? "approval executed" : "审批已执行";
    case "REJECTED":
      return english ? "approval rejected" : "审批已拒绝";
    case "WITHDRAWN":
      return english ? "approval withdrawn" : "审批已撤回";
    default:
      return english ? "approval state" : "审批状态";
  }
}

function isOpenDemandBriefDraft(status: ActionStatus) {
  return ["PENDING_APPROVAL", "APPROVED", "SUGGESTED", "MANUAL", "BLOCKED"].includes(
    status,
  );
}

function draftByApplication(
  demandBriefDrafts: GtmDemandBriefDraftActionInput[],
) {
  const latest = new Map<string, GtmDemandBriefDraftActionInput>();
  for (const draft of demandBriefDrafts) {
    const applicationId = draft.metadata?.applicationId;
    if (!applicationId || latest.has(applicationId)) continue;
    latest.set(applicationId, draft);
  }
  return latest;
}

function demandBriefTargetMissingInformation(
  application: GtmCapabilityPlanApplicationInput,
  english: boolean,
) {
  return [
    !application.applicantOrganization?.trim()
      ? english
        ? "customer organization"
        : "客户组织"
      : null,
    english ? "business pressure tags" : "经营压力标签",
    english ? "resource tags" : "资源标签",
    english ? "role map" : "角色地图",
    english ? "reviewed success criteria" : "已复核成功标准",
  ].filter((item): item is string => Boolean(item));
}

function buildDemandBriefDraftFlowPrototype(
  input: GtmCapabilityPlanReadoutInput,
): GtmDemandBriefDraftFlowPrototype {
  const { english } = input;
  const demandBriefDrafts = input.demandBriefDrafts ?? [];
  const latestDraftByApplication = draftByApplication(demandBriefDrafts);
  const draftableApplications = input.applications
    .filter((application) => ["SUBMITTED", "ACCEPTED", "WAITLISTED"].includes(application.status))
    .slice(0, 4);

  return {
    title: english
      ? "CustomerDemandBrief draft flow"
      : "客户需求简报草稿候选流",
    summary: english
      ? "Generate a reviewable internal brief candidate from a reserved program application."
      : "从保留区合作项目申请生成一份可复核的内部需求简报候选。",
    boundary: english
      ? "Draft creation writes only ActionItem + ApprovalTask. It does not create workspace, send material, write customer systems or start trial initialization."
      : "草稿生成只写动作项和审批任务；不创建工作区、不外发材料、不写客户系统、不启动试用初始化。",
    actionLabel: english ? "Create draft candidate" : "生成草稿候选",
    existingDraftLabel: english ? "Open review" : "打开复核",
    targets: draftableApplications.map((application) => {
      const latestDraft = latestDraftByApplication.get(application.id) ?? null;
      const approvalLabel = approvalStatusLabel(
        latestDraft?.approvalTask?.status ?? null,
        english,
      );
      const displayStatus = applicationStatusLabel(application.status, english);
      return {
        applicationId: application.id,
        label: applicantLabel(application),
        sourceLabel: application.partnerProgram
          ? `${programTitle(application.partnerProgram, english)} · ${displayStatus}`
          : displayStatus,
        posture:
          application.status === "ACCEPTED"
            ? english
              ? "accepted application; keep invite and trial initialization separate"
              : "已接受申请；邀请与试用初始化继续分离"
            : english
              ? "submitted application; prepare brief only after internal review"
              : "已提交申请；先准备内部简报，再复核",
        missingInformation: demandBriefTargetMissingInformation(application, english).slice(0, 5),
        hasOpenDraft: latestDraft ? isOpenDemandBriefDraft(latestDraft.status) : false,
        latestDraftId: latestDraft?.id ?? null,
        latestApprovalTaskId: latestDraft?.approvalTask?.id ?? null,
        latestDraftStatusLabel: latestDraft
          ? [actionStatusLabel(latestDraft.status, english), approvalLabel]
              .filter(Boolean)
              .join(" · ")
          : null,
      };
    }),
    recentDrafts: demandBriefDrafts.slice(0, 4).map((draft) => ({
      id: draft.id,
      label: draft.title,
      statusLabel: [
        actionStatusLabel(draft.status, english),
        approvalStatusLabel(draft.approvalTask?.status ?? null, english),
      ]
        .filter(Boolean)
        .join(" · "),
      applicationId: draft.metadata?.applicationId ?? null,
      approvalTaskId: draft.approvalTask?.id ?? null,
    })),
  };
}

function capabilityStatus(
  ready: boolean,
  reviewRequired: boolean,
): GtmCapabilityPlanStatus {
  if (reviewRequired) return "review_required";
  return ready ? "ready" : "planned";
}

function buildGuidedIntakeBriefPrototype(
  input: GtmCapabilityPlanReadoutInput,
): GtmGuidedIntakeBriefPrototype {
  const { english } = input;
  const hasApplication = input.applications.length > 0;
  const hasProgram = input.programs.length > 0;
  const hasReferral = input.salesReferrals.length > 0;
  const hasOrganization = input.applications.some((application) =>
    Boolean(application.applicantOrganization?.trim()),
  );
  const acceptedApplication = input.applications.find(
    (application) => application.status === "ACCEPTED",
  );

  const missingInformation = [
    !hasOrganization
      ? english
        ? "customer identity"
        : "客户身份"
      : null,
    english ? "business pressure tags" : "经营压力标签",
    english ? "current resource tags" : "现有资源标签",
    english ? "role map" : "角色地图",
    english ? "success criteria" : "成功标准",
  ].filter((item): item is string => Boolean(item));

  return {
    title: english ? "Guided intake brief prototype" : "引导式需求收集简报原型",
    entryModes: [
      {
        id: "sales_led",
        label: english ? "Sales-led" : "销售预填",
        posture: acceptedApplication
          ? english
            ? "Resume from accepted application; the customer confirms instead of restarting."
            : "从已接受申请继续；客户进入确认，不从空白重填。"
          : english
            ? "Use the same brief contract when an owner pre-fills the customer context."
            : "内部负责人预填时仍使用同一份简报契约。",
      },
      {
        id: "self_serve",
        label: english ? "Self-serve" : "自助进入",
        posture: english
          ? "Start from the same CustomerDemandBrief fields with no internal prefill."
          : "没有内部预填时，也进入同一组客户需求简报字段。",
      },
    ],
    requiredFields: english
      ? [
          "customer identity",
          "business pressure tags",
          "resource tags",
          "role map",
          "success criteria",
        ]
      : ["客户身份", "经营压力标签", "资源标签", "角色地图", "成功标准"],
    steps: [
      {
        id: "source-and-identity",
        label: english ? "Source and identity" : "来源与客户身份",
        questionCount: 4,
        inputMode: english ? "choice + short fields" : "选项 + 短字段",
      },
      {
        id: "business-pressure",
        label: english ? "Business pressure" : "经营压力",
        questionCount: 3,
        inputMode: english ? "multi-select tags" : "多选标签",
      },
      {
        id: "resources-and-evidence",
        label: english ? "Resources and evidence" : "资源与证据",
        questionCount: 4,
        inputMode: english ? "resource tags + readiness" : "资源标签 + 证据状态",
      },
      {
        id: "roles-and-success",
        label: english ? "Roles and success" : "角色与成功标准",
        questionCount: 5,
        inputMode: english ? "role template + success tags" : "角色模板 + 成功标签",
      },
      {
        id: "handoff-review",
        label: english ? "Handoff review" : "交接复核",
        questionCount: 3,
        inputMode: english ? "review gate" : "复核门禁",
      },
    ],
    missingInformation: missingInformation.slice(0, 5),
    sourceTracePreview: [
      hasApplication
        ? english
          ? "program application"
          : "合作项目申请"
        : null,
      hasProgram
        ? english
          ? "program catalog"
          : "合作项目目录"
        : null,
      hasReferral
        ? english
          ? "sales referral signal"
          : "销售转介绍信号"
        : null,
    ].filter((item): item is string => Boolean(item)),
    cleanHandoffChecks: english
      ? [
          "internalSalesNotes remain reserved-only",
          "customerVisibleSummary requires human review",
          "trialInitializationPayload excludes referral, settlement and contribution attribution",
          "sales-led and self-serve share one CustomerDemandBrief contract",
        ]
      : [
          "内部销售记录只保留在保留区内部",
          "客户可见摘要必须先人工复核",
          "试用初始化数据不夹带转介绍、结算或贡献归因",
          "销售预填与自助进入共用同一份客户需求简报契约",
        ],
    reviewGate: english
      ? "Trial initialization stays blocked until the brief is reviewed; this prototype does not create workspace, send material or write customer systems."
      : "简报通过复核前不得进入试用初始化；该原型不建工作区、不外发材料、不写客户系统。",
  };
}

function buildConfirmationEvidencePrototype(
  input: GtmCapabilityPlanReadoutInput,
): GtmConfirmationEvidencePrototype {
  const { english } = input;
  const hasApplication = input.applications.length > 0;
  const hasActiveReferral = input.salesReferrals.some(
    (referral) => referral.status === "ACTIVE",
  );

  return {
    title: english
      ? "Confirmation and evidence review prototype"
      : "确认与证据复核原型",
    allowedCustomerActions: [
      {
        id: "confirm",
        label: english ? "Confirm" : "确认",
        directApply: true,
        boundary: english
          ? "Customer can confirm visible facts, roles and goals."
          : "客户可以确认可见事实、角色和目标。",
      },
      {
        id: "supplement",
        label: english ? "Supplement" : "补充",
        directApply: true,
        boundary: english
          ? "Customer can add owned context and resource availability."
          : "客户可以补充自有上下文和资源可得性。",
      },
      {
        id: "request_change",
        label: english ? "Request change" : "申请修改",
        directApply: false,
        boundary: english
          ? "Material change enters review_required and cannot overwrite internal judgement silently."
          : "实质改写进入需要复核状态，不能静默覆盖内部判断。",
      },
    ],
    materialRewriteFields: english
      ? [
          "pain tag",
          "control line template",
          "key resource readiness",
          "trial premise",
          "owner or reviewer",
        ]
      : ["痛点标签", "控制线模板", "关键资源可用性", "试用前提", "负责人或复核人"],
    controlLineTemplates: [
      {
        id: "lead-follow-up",
        label: english ? "Lead follow-up" : "线索跟进",
        evidenceNeeded: english
          ? "lead list, recent touch record and next-step owner"
          : "线索列表、近期触达记录和下一步负责人",
        manualAction: english
          ? "Sales reviews priority and manually prepares outreach."
          : "销售复核优先级并手工准备触达。",
        status: hasApplication ? "review_required" : "draft",
      },
      {
        id: "customer-review",
        label: english ? "Customer review" : "客户复盘",
        evidenceNeeded: english
          ? "meeting notes, customer status and unresolved risk"
          : "会议记录、客户状态和未解决风险",
        manualAction: english
          ? "Owner reviews the risk and schedules a manual conversation."
          : "负责人复核风险并手工安排沟通。",
        status: "evidence_needed",
      },
      {
        id: "opportunity-judgement",
        label: english ? "Opportunity judgement" : "销售机会判断",
        evidenceNeeded: english
          ? "opportunity stage, decision criteria and proof refs"
          : "商机阶段、决策标准和证据引用",
        manualAction: english
          ? "AE reviews whether the opportunity should advance."
          : "销售负责人复核该机会是否值得推进。",
        status: hasActiveReferral ? "review_required" : "draft",
      },
    ],
    evidenceDowngradeRule: english
      ? "pain captured or evidence declared cannot become trial_premise until evidence is reviewed."
      : "已记录痛点或已声明证据在证据复核前不能变成试用前提。",
  };
}

function buildDiagnosticProofPackPrototype(
  input: GtmCapabilityPlanReadoutInput,
): GtmDiagnosticProofPackPrototype {
  const { english } = input;
  const hasProofCandidate = input.salesReferrals.some(
    (referral) => referral.status === "ACTIVE",
  );

  return {
    title: english ? "Diagnostic and proof pack plan" : "诊断与证据包计划",
    firstLoopContract: english
      ? ["observe", "judge", "prepare", "human review", "manual action", "verify", "learn"]
      : ["观察", "判断", "准备", "人工复核", "手工执行", "验证", "学习"],
    diagnosticTriggers: english
      ? [
          "reviewed CustomerDemandBrief",
          "reviewed control-line candidate",
          "evidence readiness",
          "role readiness",
        ]
      : ["已复核客户需求简报", "已复核控制线候选", "证据就绪度", "角色就绪度"],
    proofPackChecks: english
      ? [
          "before / after state",
          "evidence refs",
          "customer confirmation or internal review",
          "boundary / prerequisite / dependency / non-commitment notes",
        ]
      : ["前后状态", "证据引用", "客户确认或内部复核", "边界 / 前置条件 / 依赖 / 非承诺说明"],
    claimLevels: [
      {
        id: "hypothesis",
        label: english ? "Hypothesis" : "假设",
        boundary: english
          ? "No reviewed proof pack yet."
          : "尚无已复核证据包。",
      },
      {
        id: "internal_proof",
        label: english ? "Internal proof" : "内部证据",
        boundary: hasProofCandidate
          ? english
            ? "Can support internal GTM learning after review."
            : "复核后可支持内部 GTM 学习。"
          : english
            ? "Needs proof refs before reuse."
            : "复用前需要证据引用。",
      },
      {
        id: "public_candidate",
        label: english ? "Public candidate" : "公开候选",
        boundary: english
          ? "Requires explicit human approval before public use."
          : "公开使用前必须显式人工审批。",
      },
    ],
    publicUseGate: english
      ? "Proof pack can create an internal GTM asset candidate, but it cannot publish a customer-visible claim automatically."
      : "证据包可以形成内部 GTM 资产候选，但不能自动发布客户可见主张。",
  };
}

export function buildGtmCapabilityPlanReadout(
  input: GtmCapabilityPlanReadoutInput,
): GtmCapabilityPlanReadout {
  const { english } = input;
  const submittedApplications = input.applications.filter(
    (application) => application.status === "SUBMITTED",
  );
  const acceptedPendingInvite = input.applications.filter(
    (application) =>
      application.status === "ACCEPTED" && !application.participantPortalAccess,
  );
  const programsWithTermsGap = input.programs.filter(
    (program) => program.status === "ACTIVE" && !program.activeTermsVersion,
  );
  const activeReferrals = input.salesReferrals.filter(
    (referral) => referral.status === "ACTIVE",
  );

  const topWorkItems = [
    ...submittedApplications.map((application) =>
      submittedApplicationItem(application, english),
    ),
    ...acceptedPendingInvite.map((application) =>
      acceptedPendingInviteItem(application, english),
    ),
    ...programsWithTermsGap.map((program) => programTermsGapItem(program, english)),
    ...activeReferrals.slice(0, 2).map((referral) => referralProofItem(referral, english)),
  ]
    .sort((left, right) => right.priorityScore - left.priorityScore)
    .slice(0, 3);

  const hasApplicationInput = input.applications.length > 0;
  const hasReviewPressure =
    submittedApplications.length > 0 || acceptedPendingInvite.length > 0;
  const hasProofCandidate = activeReferrals.length > 0;

  return {
    visible: true,
    title: english ? "GTM capability plan" : "GTM 能力计划",
    summary: english
      ? "Reserved-only GTM readout: review applications, preserve clean handoff, and keep proof before public claims."
      : "保留区 GTM 读面：先复核申请、保留干净交接，并坚持证据先于公开主张。",
    boundary: english
      ? "This is not CRM, marketplace, auto-send, workspace creation, connector runtime, payout execution or customer-visible commitment."
      : "这不是 CRM、市场交易平台、自动外发、自动建工作区、连接器运行时、打款执行或客户可见承诺。",
    counts: {
      programCount: input.programs.length,
      applicationCount: input.applications.length,
      submittedApplicationCount: submittedApplications.length,
      acceptedPendingInviteCount: acceptedPendingInvite.length,
      activeReferralCount: activeReferrals.length,
      programTermsGapCount: programsWithTermsGap.length,
    },
    topWorkItems,
    guidedIntake: buildGuidedIntakeBriefPrototype(input),
    demandBriefDraftFlow: buildDemandBriefDraftFlowPrototype(input),
    confirmationAndEvidence: buildConfirmationEvidencePrototype(input),
    diagnosticAndProofPack: buildDiagnosticProofPackPrototype(input),
    capabilityPlans: [
      {
        id: "reserved-readout",
        label: english ? "Reserved GTM readout" : "保留区 GTM 读面",
        status: capabilityStatus(input.programs.length > 0 || hasApplicationInput, false),
        nextAction: english
          ? "Keep the first screen focused on work items."
          : "首屏继续只展示可推进工作。",
      },
      {
        id: "guided-intake",
        label: english ? "Guided intake and brief" : "引导式需求收集与需求简报",
        status: capabilityStatus(hasApplicationInput, hasReviewPressure),
        nextAction: english
          ? "Turn accepted demand into a reviewed brief before trial initialization."
          : "进入试用初始化前，先把需求收成已复核简报。",
      },
      {
        id: "confirmation-rewrite",
        label: english ? "Customer confirmation" : "客户确认与受控改写",
        status: hasApplicationInput ? "planned" : "planned",
        nextAction: english
          ? "Prototype confirm / supplement / request-change without exposing internal judgement."
          : "原型化确认 / 补充 / 申请修改，同时不暴露内部判断。",
      },
      {
        id: "evidence-review",
        label: english ? "Control-line evidence review" : "控制线证据复核",
        status: hasProofCandidate ? "review_required" : "planned",
        nextAction: english
          ? "Keep pain and referral signals as hypotheses until evidence is reviewed."
          : "痛点和转介绍信号在证据复核前都只保持假设。",
      },
      {
        id: "proof-pack",
        label: english ? "Proof pack and asset candidate" : "证据包与资产候选",
        status: "planned",
        nextAction: english
          ? "No public claim before a reviewed proof pack exists."
          : "没有已复核证据包前，不生成公开主张。",
      },
    ],
  };
}
