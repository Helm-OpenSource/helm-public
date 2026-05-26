import {
  AccessState,
  ActionExecutionMode,
  ActionType,
  ActorType,
  MembershipStatus,
  RiskLevel,
  WorkspaceClass,
  WorkspaceRole,
  WorkspaceStatus,
} from "@prisma/client";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { buildWorkerCommercialWiringView, FIRST_PARTY_CORE_WORKERS } from "@/lib/billing/add-on-worker-commercial";
import {
  ensureWorkspaceCommercialFoundation,
  getWorkspaceBillingSnapshot,
  INCLUDED_ADMIN_SEATS,
  TRIAL_COLLABORATOR_SEATS,
} from "@/lib/billing/foundation";
import { buildMembershipLifecycleSummary } from "@/lib/billing/ops-summary";
import { db } from "@/lib/db";
import { type UiLocale } from "@/lib/i18n/config";
import { getLocalizedRoleLabels } from "@/lib/i18n/labels";
import { defaultWorkspaceFeatureFlags, serializeWorkspaceFeatureFlags } from "@/lib/workspace-ops";

const DEFAULT_POLICY_RULES = {
  "zh-CN": [
    ["外发邮件默认审批", ActionType.DRAFT_EXTERNAL_EMAIL, ActionExecutionMode.REQUIRES_APPROVAL, RiskLevel.MEDIUM, "外发动作", "对外动作默认先走审批，避免在试用初期误触发高风险外发。"],
    ["内部纪要自动执行", ActionType.DRAFT_INTERNAL_NOTE, ActionExecutionMode.AUTO_WITHIN_THRESHOLD, RiskLevel.HIGH, "内部动作", "内部纪要默认允许自动执行，帮助团队快速进入工作节奏。"],
    ["创建会议自动执行", ActionType.CREATE_MEETING, ActionExecutionMode.AUTO_WITHIN_THRESHOLD, RiskLevel.MEDIUM, "日程类", "低风险建会动作默认可自动执行。"],
    ["机会阶段更新默认自动", ActionType.UPDATE_OPPORTUNITY_STAGE, ActionExecutionMode.AUTO_WITHIN_THRESHOLD, RiskLevel.MEDIUM, "机会类", "机会阶段更新默认在阈值内自动推进。"],
    ["创建待办默认自动", ActionType.CREATE_TASK, ActionExecutionMode.AUTO_WITHIN_THRESHOLD, RiskLevel.MEDIUM, "内部动作", "会后待办默认自动创建，帮助新组织快速形成经营闭环。"],
    ["指派负责人需审批", ActionType.ASSIGN_OWNER, ActionExecutionMode.REQUIRES_APPROVAL, RiskLevel.MEDIUM, "协同类", "负责人变更仍需要显式人工把关。"],
    ["修改截止时间需审批", ActionType.CHANGE_DUE_DATE, ActionExecutionMode.REQUIRES_APPROVAL, RiskLevel.MEDIUM, "治理类", "截止时间变更会影响节奏判断，默认进入审批。"],
    ["安排面试默认审批", ActionType.SCHEDULE_INTERVIEW, ActionExecutionMode.REQUIRES_APPROVAL, RiskLevel.MEDIUM, "招聘类", "招聘场景下的面试安排默认需要审批。"],
  ],
  "en-US": [
    ["External outreach requires approval", ActionType.DRAFT_EXTERNAL_EMAIL, ActionExecutionMode.REQUIRES_APPROVAL, RiskLevel.MEDIUM, "External actions", "External actions start inside approvals so the first trial loop stays reviewable."],
    ["Internal summaries auto-run by default", ActionType.DRAFT_INTERNAL_NOTE, ActionExecutionMode.AUTO_WITHIN_THRESHOLD, RiskLevel.HIGH, "Internal actions", "Internal summaries can auto-run so the trial workspace quickly feels operational."],
    ["Calendar creation auto-runs", ActionType.CREATE_MEETING, ActionExecutionMode.AUTO_WITHIN_THRESHOLD, RiskLevel.MEDIUM, "Scheduling", "Low-risk calendar creation stays available by default."],
    ["Opportunity stage updates auto-run", ActionType.UPDATE_OPPORTUNITY_STAGE, ActionExecutionMode.AUTO_WITHIN_THRESHOLD, RiskLevel.MEDIUM, "Opportunity flow", "Opportunity progress updates can move automatically within policy thresholds."],
    ["Task creation auto-runs", ActionType.CREATE_TASK, ActionExecutionMode.AUTO_WITHIN_THRESHOLD, RiskLevel.MEDIUM, "Internal actions", "Post-meeting tasks auto-create so the workspace starts with visible momentum."],
    ["Owner changes require approval", ActionType.ASSIGN_OWNER, ActionExecutionMode.REQUIRES_APPROVAL, RiskLevel.MEDIUM, "Collaboration", "Owner changes remain explicitly reviewable."],
    ["Due-date changes require approval", ActionType.CHANGE_DUE_DATE, ActionExecutionMode.REQUIRES_APPROVAL, RiskLevel.MEDIUM, "Governance", "Due-date shifts affect execution posture and stay approval-bound."],
    ["Interview scheduling requires approval", ActionType.SCHEDULE_INTERVIEW, ActionExecutionMode.REQUIRES_APPROVAL, RiskLevel.MEDIUM, "Recruiting", "Scheduling interviews stays approval-bound in the default trial posture."],
  ],
} as const;

const DEFAULT_BUDGET_RULES = {
  "zh-CN": [
    {
      name: "外发动作审批预算",
      scope: "外发动作",
      monthlyLimit: 120,
      spent: 0,
      warningThreshold: 80,
    },
    {
      name: "会议与日程自动执行额度",
      scope: "会议与日程",
      monthlyLimit: 80,
      spent: 0,
      warningThreshold: 75,
    },
  ],
  "en-US": [
    {
      name: "External approval budget",
      scope: "External actions",
      monthlyLimit: 120,
      spent: 0,
      warningThreshold: 80,
    },
    {
      name: "Meeting automation budget",
      scope: "Meetings and scheduling",
      monthlyLimit: 80,
      spent: 0,
      warningThreshold: 75,
    },
  ],
} as const;

type CreateSelfServeTrialOrganizationInput = {
  user: {
    id: string;
    email: string;
    name: string;
    title?: string | null;
  };
  organizationName: string;
  locale: UiLocale;
};

export type TrialOnboardingSurfaceData = {
  organizationName: string;
  roleLabel: string;
  accessState: AccessState;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
  seatSummary: string;
  lifecycleSummary: string;
  graceRule: string;
  purchasePath: string;
  currentJudgement: string;
  whyItMatters: string;
  helmDid: string[];
  nextSteps: Array<{
    title: string;
    description: string;
    href?: string;
  }>;
  boundaryNote: string;
  includedWorkers: Array<{
    key: string;
    label: string;
    description: string;
  }>;
};

function slugifyWorkspaceName(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "helm-team"
  );
}

async function getUniqueWorkspaceSlug(baseName: string) {
  const base = slugifyWorkspaceName(baseName);
  let slug = base;
  let index = 1;

  while (await db.workspace.findUnique({ where: { slug }, select: { id: true } })) {
    index += 1;
    slug = `${base}-${index}`;
  }

  return slug;
}

async function seedDefaultPoliciesAndBudgets(workspaceId: string, locale: UiLocale) {
  const [policyCount, budgetCount] = await Promise.all([
    db.policyRule.count({ where: { workspaceId } }),
    db.budgetRule.count({ where: { workspaceId } }),
  ]);

  if (policyCount === 0) {
    const policyRules = DEFAULT_POLICY_RULES[locale];
    await db.policyRule.createMany({
      data: policyRules.map(([name, actionType, mode, riskThreshold, appliesTo, description]) => ({
        workspaceId,
        name,
        actionType,
        mode,
        riskThreshold,
        appliesTo,
        description,
      })),
    });
  }

  if (budgetCount === 0) {
    await db.budgetRule.createMany({
      data: DEFAULT_BUDGET_RULES[locale].map((rule) => ({
        workspaceId,
        ...rule,
      })),
    });
  }
}

export async function createSelfServeTrialOrganization(
  input: CreateSelfServeTrialOrganizationInput,
) {
  const english = input.locale === "en-US";
  const slug = await getUniqueWorkspaceSlug(input.organizationName);

  const workspace = await db.workspace.create({
    data: {
      name: input.organizationName,
      slug,
      status: WorkspaceStatus.ACTIVE,
      workspaceClass: WorkspaceClass.CUSTOMER,
      systemKey: null,
      description: english ? "Self-serve Helm trial workspace" : "Helm 自助试用工作区",
      connectedSources: JSON.stringify([]),
      focusAreas: JSON.stringify([]),
      defaultStrategies: JSON.stringify([]),
      configuration: JSON.stringify({
        onboardingMode: "self-serve-trial-v1",
        workspaceLabel: input.organizationName,
        operatingModel: english ? "Meeting-first operating workspace" : "会议优先的经营工作台",
      }),
      defaultLocale: input.locale,
      pilotMode: true,
      featureFlagsJson: serializeWorkspaceFeatureFlags(defaultWorkspaceFeatureFlags),
      dataRetentionDays: 90,
      captureConsentRequired: true,
      defaultLLMProvider: "qwen",
      defaultLLMModel: process.env.LLM_DEFAULT_MODEL || "qwen3.6-plus",
      extractionModel:
        process.env.LLM_EXTRACTION_MODEL || process.env.LLM_DEFAULT_MODEL || "qwen3.6-plus",
      briefingModel:
        process.env.LLM_BRIEFING_MODEL || process.env.LLM_DEFAULT_MODEL || "qwen3.6-plus",
      reasoningModel:
        process.env.LLM_REASONING_MODEL || process.env.LLM_DEFAULT_MODEL || "qwen3.6-plus",
      llmBudgetTier: "pilot",
      llmEnabled: process.env.LLM_ENABLED !== "false",
    },
  });

  const membership = await db.membership.create({
    data: {
      workspaceId: workspace.id,
      userId: input.user.id,
      role: WorkspaceRole.OWNER,
      status: MembershipStatus.ACTIVE,
      title: input.user.title ?? undefined,
      persona: input.user.title ?? undefined,
    },
  });

  await seedDefaultPoliciesAndBudgets(workspace.id, input.locale);
  await ensureWorkspaceCommercialFoundation(workspace.id);

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: input.user.id,
    actor: input.user.name,
    actorType: ActorType.USER,
    actionType: "ORGANIZATION_CREATED",
    targetType: "Workspace",
    targetId: workspace.id,
    summary: english
      ? `Started self-serve trial for ${workspace.name}`
      : `已为 ${workspace.name} 开启自助试用`,
    sourcePage: "/",
  });

  await logEvent({
    workspaceId: workspace.id,
    userId: input.user.id,
    eventName: "organization_created",
    eventCategory: "auth",
    targetType: "Workspace",
    targetId: workspace.id,
    metadata: {
      entry: "self-serve-trial",
      workspaceName: workspace.name,
      locale: input.locale,
    },
    sourcePage: "/",
  });

  return { workspace, membership };
}

function buildTrialLifecycleSummary(input: {
  accessState: AccessState;
  english: boolean;
  trialEndsAt: Date | null;
  graceEndsAt: Date | null;
}) {
  if (input.accessState === AccessState.TRIALING) {
    return input.english
      ? "Trial is live now. Core product access stays fully open until the trial window ends."
      : "试用已经生效。试用期内当前核心产品能力保持完整开放。";
  }

  if (input.accessState === AccessState.GRACE) {
    return input.english
      ? "The workspace is in grace. Viewing and exports remain available while new high-cost processing narrows."
      : "当前处于宽限期。查看和导出仍然保留，但新的高成本智能生成会开始收紧。";
  }

  if (input.accessState === AccessState.READ_ONLY) {
    return input.english
      ? "The workspace is now read-only. Viewing and exports remain open, while new high-cost processing stays paused."
      : "当前已经进入只读。查看和导出仍然保留，但新的高成本智能生成会继续暂停。";
  }

  return input.english
    ? "This workspace is already on an active paid access path."
    : "当前工作区已经进入正式付费访问路径。";
}

function buildTrialPurchasePath(input: { accessState: AccessState; english: boolean }) {
  if (input.accessState === AccessState.GRACE) {
    return input.english
      ? "Use Settings > Billing overview to renew now and keep the workspace moving before grace ends."
      : "前往「智能设置 > 计费总览」立即续费恢复，在宽限期结束前保持工作区继续推进。";
  }

  if (input.accessState === AccessState.READ_ONLY || input.accessState === AccessState.CANCELED) {
    return input.english
      ? "Use Settings > Billing overview to restore access. Viewing and exports stay open while new high-cost processing remains paused."
      : "前往「智能设置 > 计费总览」恢复访问。当前仍可查看和导出，但新的高成本智能生成会保持暂停。";
  }

  return input.english
    ? "Purchase and restore stay in Settings > Billing overview. Trial access remains fully open until the lifecycle changes."
    : "购买和恢复入口都在「智能设置 > 计费总览」。在 生命周期变化前，试用访问会保持完整开放。";
}

function buildTrialNextSteps(input: { accessState: AccessState; english: boolean }) {
  if (input.accessState === AccessState.GRACE) {
    return [
      {
        title: input.english ? "Renew workspace access" : "续费恢复工作区",
        description: input.english
          ? "Open Billing overview and finish renew / restore before grace ends."
          : "打开计费总览，在宽限期结束前完成续费 / 恢复。",
        href: "/settings",
      },
      {
        title: input.english ? "Review what still stays available" : "确认当前仍可继续做什么",
        description: input.english
          ? "Viewing and exports stay open while new high-cost processing narrows."
          : "当前仍可查看和导出，但新的高成本智能生成会开始收紧。",
      },
      {
        title: input.english ? "Return to the dashboard after setup" : "完成初始化后回到工作台",
        description: input.english
          ? "Make sure the workspace still has the right priorities, owners, and meeting flow."
          : "确认工作台里的优先级、负责人和会议主回路仍然正确。",
        href: "/dashboard",
      },
    ];
  }

  if (input.accessState === AccessState.READ_ONLY || input.accessState === AccessState.CANCELED) {
    return [
      {
        title: input.english ? "Restore paid access" : "恢复正式访问",
        description: input.english
          ? "Use Billing overview to reactivate the organization."
          : "通过计费总览重新激活组织访问。",
        href: "/settings",
      },
      {
        title: input.english ? "Keep reviewing and exporting" : "继续查看与导出",
        description: input.english
          ? "Existing records remain visible while high-cost processing stays paused."
          : "现有记录仍可查看与导出，但高成本智能生成会保持暂停。",
      },
      {
        title: input.english ? "Finish onboarding posture" : "完成初始化姿态收口",
        description: input.english
          ? "Make sure persona, connectors, focus areas, and policies reflect the real organization."
          : "确认身份、连接器、关注目标和策略已经贴近真实组织。",
      },
    ];
  }

  return [
    {
      title: input.english ? "Finish initial setup" : "完成首次初始化",
      description: input.english
        ? "Confirm who runs the workspace, which signals Helm should watch first, and who reviews follow-through."
        : "确认谁操盘、Helm 先看哪些信号、谁参与复核。",
    },
    {
      title: input.english ? "Invite teammates into the workspace" : "邀请团队成员进入工作区",
      description: input.english
        ? "Use work email to invite the first teammates so they can enter the same organization without demo accounts."
        : "通过工作邮箱邀请第一批团队成员，让他们不依赖演示账号也能进入同一个组织。",
      href: "/setup#team-invite",
    },
    {
      title: input.english ? "Open dashboard and billing overview" : "打开工作台并核对计费姿态",
      description: input.english
        ? "Confirm the trial workspace already has a clear next move, then verify trial end date, seat posture, and purchase / restore paths."
        : "确认这个试用组织已经进入清楚的下一步行动状态，再核对试用结束时间、团队访问和购买 / 恢复路径。",
      href: "/dashboard",
    },
  ];
}

export async function buildTrialOnboardingSurfaceData(input: {
  workspaceId: string;
  role: WorkspaceRole;
  locale: UiLocale;
  accessState: AccessState;
  organizationName: string;
}) : Promise<TrialOnboardingSurfaceData> {
  const english = input.locale === "en-US";
  const billingSnapshot = await getWorkspaceBillingSnapshot(input.workspaceId);
  const roleLabels = getLocalizedRoleLabels(input.locale);
  const membershipLifecycle = buildMembershipLifecycleSummary({
    memberships: billingSnapshot.memberships,
    includedAdminSeats: INCLUDED_ADMIN_SEATS,
    trialCollaboratorSeats: TRIAL_COLLABORATOR_SEATS,
  });
  const includedWorkers = billingSnapshot.workerEntitlements
    .filter((entitlement) => entitlement.workerKey && FIRST_PARTY_CORE_WORKERS.some((worker) => worker.key === entitlement.workerKey))
    .map((entitlement) => buildWorkerCommercialWiringView(entitlement))
    .map((view) => ({
      key: view.workerKey,
      label: english ? view.label.en : view.label.zh,
      description: english ? view.description.en : view.description.zh,
    }));

  const seatSummary = english
    ? `${membershipLifecycle.activeSeatCount} active teammate now, ${INCLUDED_ADMIN_SEATS} included administrator seat, and ${billingSnapshot.trialCollaboratorSeats} trial collaborator seats available. Invited members stay visible but do not count as active teammates yet.`
    : `当前有 ${membershipLifecycle.activeSeatCount} 位活跃成员，含 ${INCLUDED_ADMIN_SEATS} 个已包含管理员席位，并附带 ${billingSnapshot.trialCollaboratorSeats} 个试用协作席位。已邀请成员会显示在组织里，但暂时不计入活跃成员。`;

  const currentJudgement = english
    ? "Your organization is now live in trial, and the next job is to turn it from a fresh shell into a working operating workspace."
    : "你的组织已经进入试用中，当前最重要的任务是把它从新建壳层收成真正可用的经营工作区。";

  const whyItMatters = english
    ? "Trial already includes the current core product, the owner seat, collaborator allowance, and included core workers. Setup is what turns those defaults into a usable daily operating posture."
    : "试用已经附带当前核心产品、负责人席位、协作席位和已包含的核心能力。现在真正决定体验质量的，是把这些默认值收成可用的日常经营姿态。";

  const helmDid = [
    english ? `Created organization ${input.organizationName}` : `已创建组织：${input.organizationName}`,
    english ? `Assigned you as ${roleLabels[input.role]}` : `已把你设为${roleLabels[input.role]}`,
    english
      ? `Started a 30-day trial and attached ${TRIAL_COLLABORATOR_SEATS} collaborator trial seats`
      : `已开启 30 天试用，并附带 ${TRIAL_COLLABORATOR_SEATS} 个协作试用席位`,
    english
      ? `Enabled included core workers: ${includedWorkers.map((worker) => worker.label).join(", ")}`
      : `已启用核心能力：${includedWorkers.map((worker) => worker.label).join("、")}`,
  ];

  const boundaryNote = english
    ? "Trial keeps the core product fully open. Lifecycle changes later affect renewal posture and high-cost processing boundaries, not whether Helm suddenly turns into a crippled product."
    : "试用不会把核心产品做成功能阉割版。后续生命周期变化影响的是续费姿态和高成本智能生成边界，而不是让 Helm 突然变成残缺产品。";

  return {
    organizationName: input.organizationName,
    roleLabel: roleLabels[input.role],
    accessState: input.accessState,
    trialEndsAt: billingSnapshot.trialState?.trialEndsAt ?? null,
    graceEndsAt: billingSnapshot.trialState?.graceEndsAt ?? null,
    seatSummary,
    lifecycleSummary: buildTrialLifecycleSummary({
      accessState: input.accessState,
      english,
      trialEndsAt: billingSnapshot.trialState?.trialEndsAt ?? null,
      graceEndsAt: billingSnapshot.trialState?.graceEndsAt ?? null,
    }),
    graceRule: english
      ? "After trial ends, Helm moves into a 7-day grace window before read-only. Viewing and exports stay available while new high-cost processing narrows."
      : "试用结束后会先进入 7 天宽限期，再进入只读。查看和导出仍然保留，但新的高成本智能生成会逐步收紧。",
    purchasePath: buildTrialPurchasePath({
      accessState: input.accessState,
      english,
    }),
    currentJudgement,
    whyItMatters,
    helmDid,
    nextSteps: buildTrialNextSteps({
      accessState: input.accessState,
      english,
    }),
    boundaryNote,
    includedWorkers,
  };
}
