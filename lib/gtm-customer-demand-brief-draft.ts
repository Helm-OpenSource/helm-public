import type { ActionStatus, ApprovalStatus, ProgramApplicationStatus } from "@prisma/client";
import { safeParseJson } from "@/lib/utils";

export const GTM_CUSTOMER_DEMAND_BRIEF_DRAFT_KIND =
  "gtm_customer_demand_brief_draft";

export type GtmCustomerDemandBriefDraftMetadata = {
  kind: typeof GTM_CUSTOMER_DEMAND_BRIEF_DRAFT_KIND;
  version: 1;
  applicationId: string;
  programSlug: string | null;
  sourceType: "program_application";
  requestedBy: string;
  requestedAt: string;
  requiredFields: string[];
  missingInformation: string[];
  sourceTrace: string[];
  cleanHandoffChecks: string[];
  boundary: {
    reservedOnly: true;
    doesNotCreateWorkspace: true;
    doesNotSendMaterial: true;
    doesNotWriteCustomerSystems: true;
    trialInitializationCandidateOnly: true;
    excludesReferralSettlementContributionAttribution: true;
  };
};

export type GtmDemandBriefDraftApplicationInput = {
  id: string;
  applicantName: string;
  applicantEmail: string;
  applicantOrganization: string | null;
  roleTitle: string | null;
  website: string | null;
  regionLabel: string | null;
  background: string | null;
  contributionPlan: string | null;
  internalNotes: string | null;
  status: ProgramApplicationStatus;
  partnerProgram: {
    title: string;
    slug: string;
  } | null;
  participantPortalAccess: {
    id: string;
  } | null;
  salesReferral: {
    id: string;
    beneficiaryLabel: string;
  } | null;
};

export type GtmDemandBriefDraftActionInput = {
  id: string;
  title: string;
  status: ActionStatus;
  createdAt: Date;
  approvalTask: {
    id: string;
    status: ApprovalStatus;
  } | null;
  metadata: GtmCustomerDemandBriefDraftMetadata | null;
};

export type GtmCustomerDemandBriefDraftSpec = {
  title: string;
  description: string;
  aiReason: string;
  draftContent: string;
  resultPreview: string;
  approvalReasoning: string;
  approvalChannel: string;
  metadata: GtmCustomerDemandBriefDraftMetadata;
};

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function customerLabel(application: GtmDemandBriefDraftApplicationInput) {
  return (
    normalizeText(application.applicantOrganization) ??
    normalizeText(application.applicantName) ??
    "Unknown customer"
  );
}

function sourceTrace(application: GtmDemandBriefDraftApplicationInput, english: boolean) {
  return [
    english
      ? `program application:${application.id}`
      : `合作项目申请:${application.id}`,
    application.partnerProgram
      ? english
        ? `program catalog:${application.partnerProgram.slug}`
        : `合作项目目录:${application.partnerProgram.slug}`
      : null,
    application.salesReferral
      ? english
        ? `sales referral signal:${application.salesReferral.beneficiaryLabel}`
        : `销售转介绍信号:${application.salesReferral.beneficiaryLabel}`
      : null,
    application.participantPortalAccess
      ? english
        ? "participant portal access exists"
        : "已存在参与方门户访问"
      : null,
  ].filter((item): item is string => Boolean(item));
}

function requiredFields(english: boolean) {
  return english
    ? [
        "customer identity",
        "business pressure tags",
        "resource tags",
        "role map",
        "success criteria",
      ]
    : ["客户身份", "经营压力标签", "资源标签", "角色地图", "成功标准"];
}

function missingInformation(
  application: GtmDemandBriefDraftApplicationInput,
  english: boolean,
) {
  return [
    !normalizeText(application.applicantOrganization)
      ? english
        ? "customer organization"
        : "客户组织"
      : null,
    !normalizeText(application.background)
      ? english
        ? "business pressure tags"
        : "经营压力标签"
      : null,
    !normalizeText(application.contributionPlan)
      ? english
        ? "resource tags"
        : "资源标签"
      : null,
    !normalizeText(application.roleTitle)
      ? english
        ? "role map"
        : "角色地图"
      : null,
    english ? "reviewed success criteria" : "已复核成功标准",
  ].filter((item): item is string => Boolean(item));
}

function cleanHandoffChecks(english: boolean) {
  return english
    ? [
        "internalSalesNotes remain reserved-only",
        "customerVisibleSummary requires human review",
        "trialInitializationPayload excludes referral, settlement and contribution attribution",
        "draft candidate does not create workspace, send material or write customer systems",
      ]
    : [
        "internalSalesNotes 只保留在 reserved 内部",
        "customerVisibleSummary 必须先人工复核",
        "trialInitializationPayload 不夹带转介绍、结算或贡献归因",
        "草稿候选不创建 workspace、不外发材料、不写客户系统",
      ];
}

function draftLines(input: {
  application: GtmDemandBriefDraftApplicationInput;
  english: boolean;
  missing: string[];
  checks: string[];
  trace: string[];
}) {
  const { application, english, missing, checks, trace } = input;
  const customer = customerLabel(application);
  const program = application.partnerProgram?.title ?? (english ? "Program" : "合作项目");
  const background =
    normalizeText(application.background) ??
    (english ? "Needs human review before it becomes a pressure tag." : "需要人工复核后才能变成压力标签。");
  const resources =
    normalizeText(application.contributionPlan) ??
    (english ? "Needs resource tags before trial initialization." : "进入试用初始化前需要补齐资源标签。");
  const role =
    normalizeText(application.roleTitle) ??
    (english ? "Role map pending." : "角色地图待补。");
  const region =
    normalizeText(application.regionLabel) ??
    (english ? "Region not specified." : "区域未明确。");
  const website =
    normalizeText(application.website) ??
    (english ? "Website not provided." : "未提供网站。");
  const internalNotes = normalizeText(application.internalNotes);

  if (english) {
    return [
      "CustomerDemandBrief draft candidate",
      `Customer identity: ${customer} / ${application.applicantName} / ${application.applicantEmail}`,
      `Program source: ${program}`,
      `Region and website: ${region} / ${website}`,
      `Business pressure: ${background}`,
      `Resources and evidence: ${resources}`,
      `Role map: ${role}`,
      "Success criteria: pending human review before any trial initialization.",
      `Missing before handoff: ${missing.join(" / ") || "none visible from source"}`,
      `Source trace: ${trace.join(" / ")}`,
      `Clean handoff: ${checks.join(" / ")}`,
      internalNotes ? `Reserved internal notes: ${internalNotes}` : null,
      "Boundary: this is an internal draft candidate only. It does not create workspace, send material, write customer systems, start trial initialization, or carry referral / settlement / contribution attribution into a customer workspace.",
    ].filter((line): line is string => Boolean(line));
  }

  return [
    "CustomerDemandBrief 草稿候选",
    `客户身份：${customer} / ${application.applicantName} / ${application.applicantEmail}`,
    `项目来源：${program}`,
    `区域与网站：${region} / ${website}`,
    `经营压力：${background}`,
    `资源与证据：${resources}`,
    `角色地图：${role}`,
    "成功标准：进入任何试用初始化前必须人工复核。",
    `交接前缺口：${missing.join(" / ") || "当前来源下没有显性缺口"}`,
    `来源追踪：${trace.join(" / ")}`,
    `Clean handoff：${checks.join(" / ")}`,
    internalNotes ? `Reserved 内部备注：${internalNotes}` : null,
    "边界：这只是内部草稿候选，不创建 workspace、不外发材料、不写客户系统、不启动试用初始化，也不把 referral / settlement / contribution attribution 带入客户 workspace。",
  ].filter((line): line is string => Boolean(line));
}

export function buildGtmCustomerDemandBriefDraft(
  input: {
    application: GtmDemandBriefDraftApplicationInput;
    english: boolean;
    requestedBy: string;
    requestedAt?: Date;
  },
): GtmCustomerDemandBriefDraftSpec {
  const requestedAt = input.requestedAt ?? new Date();
  const customer = customerLabel(input.application);
  const missing = missingInformation(input.application, input.english);
  const checks = cleanHandoffChecks(input.english);
  const trace = sourceTrace(input.application, input.english);
  const metadata: GtmCustomerDemandBriefDraftMetadata = {
    kind: GTM_CUSTOMER_DEMAND_BRIEF_DRAFT_KIND,
    version: 1,
    applicationId: input.application.id,
    programSlug: input.application.partnerProgram?.slug ?? null,
    sourceType: "program_application",
    requestedBy: input.requestedBy,
    requestedAt: requestedAt.toISOString(),
    requiredFields: requiredFields(input.english),
    missingInformation: missing,
    sourceTrace: trace,
    cleanHandoffChecks: checks,
    boundary: {
      reservedOnly: true,
      doesNotCreateWorkspace: true,
      doesNotSendMaterial: true,
      doesNotWriteCustomerSystems: true,
      trialInitializationCandidateOnly: true,
      excludesReferralSettlementContributionAttribution: true,
    },
  };

  const draftContent = draftLines({
    application: input.application,
    english: input.english,
    missing,
    checks,
    trace,
  }).join("\n");

  return {
    title: input.english
      ? `CustomerDemandBrief draft: ${customer}`
      : `CustomerDemandBrief 草稿：${customer}`,
    description: input.english
      ? "Reserved-only CustomerDemandBrief draft candidate generated from a program application. Review is required before trial initialization."
      : "从 ProgramApplication 生成的 reserved-only CustomerDemandBrief 草稿候选。进入试用初始化前必须人工复核。",
    aiReason: input.english
      ? "The program application contains enough source context to prepare an internal demand brief candidate, but clean handoff and customer-visible material remain review-bound."
      : "ProgramApplication 已具备生成内部需求简报候选的来源上下文，但 clean 交接与客户可见材料仍必须先复核。",
    draftContent,
    resultPreview: input.english
      ? "Approval keeps the brief as an internal reviewed candidate only; it still does not create workspace, send material or write customer systems."
      : "审批通过后仍只是内部已复核候选；不会创建 workspace、外发材料或写客户系统。",
    approvalReasoning: input.english
      ? "Review whether this CustomerDemandBrief candidate is clean enough for later trial initialization planning."
      : "复核这份 CustomerDemandBrief 候选是否足够干净，可进入后续试用初始化规划。",
    approvalChannel: input.english ? "Reserved GTM demand brief" : "Reserved GTM 需求简报",
    metadata,
  };
}

export function parseGtmCustomerDemandBriefDraftMetadata(
  value?: string | null,
) {
  const parsed = safeParseJson<GtmCustomerDemandBriefDraftMetadata | null>(
    value,
    null,
  );
  if (!parsed || parsed.kind !== GTM_CUSTOMER_DEMAND_BRIEF_DRAFT_KIND) {
    return null;
  }
  return parsed;
}
