import type { UiLocale } from "@/lib/i18n/config";
import {
  ROLE_PRESET_KEYS,
  getRolePresetDefinition,
  localizeRolePreset,
  type RolePresetKey,
} from "@/lib/definitions/role-presets";
import { getOperatingSkillById } from "@/lib/operating-system/skill-catalog";
import type { OperatingSkillId } from "@/lib/operating-system/types";

type LocalizedText = {
  zh: string;
  en: string;
};

type RoleStarterSkillSuggestionDefinition = {
  skillId: OperatingSkillId;
  rationale: LocalizedText;
  activationCue: LocalizedText;
};

type RoleStarterSkillPackDefinition = {
  summary: LocalizedText;
  boundaryNote: LocalizedText;
  suggestions: RoleStarterSkillSuggestionDefinition[];
};

export type RoleFoundationContextInput = {
  workspaceProfileType?: string | null;
  focusAreas?: string[] | null;
};

export type LocalizedRoleFoundationContext = {
  postureSummary: string | null;
  focusSummary: string | null;
  adaptationNote: string | null;
};

export type LocalizedRoleStarterSkillSuggestion = {
  skillId: OperatingSkillId;
  skillName: string;
  rationale: string;
  activationCue: string;
};

export type LocalizedRoleStarterSkillPack = {
  summary: string;
  boundaryNote: string;
  suggestions: LocalizedRoleStarterSkillSuggestion[];
};

export type LocalizedRoleFoundation = {
  rolePresetKey: RolePresetKey;
  soulLite: {
    label: string;
    summary: string;
    mission: string;
    ownedOutcomes: string[];
    mainJudgements: string[];
    handoffEdges: string[];
    successSignals: string[];
    boundaryNotes: string[];
  };
  starterSkillPack: LocalizedRoleStarterSkillPack;
  workspaceContext: LocalizedRoleFoundationContext;
};

const localizedOperatingSkillNames: Record<
  OperatingSkillId,
  LocalizedText
> = {
  "meeting-briefing": {
    zh: "会前简报",
    en: "Meeting briefing",
  },
  "meeting-follow-through": {
    zh: "会后动作提炼",
    en: "Post-meeting follow-through",
  },
  "external-followup-draft": {
    zh: "外部跟进草稿",
    en: "External follow-up draft",
  },
  "approval-review": {
    zh: "审批判断",
    en: "Approval review",
  },
  "opportunity-push": {
    zh: "机会推进判断",
    en: "Opportunity push",
  },
  "relationship-revival": {
    zh: "关系恢复动作",
    en: "Relationship revival",
  },
  "memory-correction": {
    zh: "记忆修正",
    en: "Memory correction",
  },
  "pilot-readiness-diagnostics": {
    zh: "试点 就绪度 诊断",
    en: "Pilot readiness diagnostics",
  },
};

const sharedStarterBoundaryNote: LocalizedText = {
  zh: "这只是 starter skill suggestion 资料。它最多应进入候选 capability / candidate capability 姿态，不自动授权、不过路由，也不等于 正式 skill / formal skill。",
  en: "This is only a starter skill suggestion pack. At most it should enter a candidate capability posture; it does not auto-grant authority, routing, or formal-skill status.",
};

const focusAreaSkillSignals: Array<{
  matchers: string[];
  weights: Partial<Record<OperatingSkillId, number>>;
}> = [
  {
    matchers: ["客户跟进", "client follow-up", "customer follow-up", "renewal", "客户"],
    weights: {
      "external-followup-draft": 4,
      "opportunity-push": 3,
      "relationship-revival": 2,
      "meeting-follow-through": 1,
    },
  },
  {
    matchers: ["招聘推进", "hiring pipeline", "hiring", "招聘", "候选人", "interview"],
    weights: {
      "meeting-briefing": 3,
      "meeting-follow-through": 3,
      "relationship-revival": 2,
      "external-followup-draft": 1,
    },
  },
  {
    matchers: ["合作拓展", "partnership", "partnerships", "合作"],
    weights: {
      "external-followup-draft": 4,
      "meeting-briefing": 2,
      "opportunity-push": 2,
      "approval-review": 1,
    },
  },
  {
    matchers: ["内部事项", "internal work", "internal"],
    weights: {
      "meeting-follow-through": 3,
      "memory-correction": 2,
      "approval-review": 2,
      "pilot-readiness-diagnostics": 1,
    },
  },
];

const roleStarterSkillPacks: Record<RolePresetKey, RoleStarterSkillPackDefinition> = {
  FOUNDER_CEO: {
    summary: {
      zh: "先守住经营主线、关键会议准备和高风险边界，再决定今天最该推进哪条线。",
      en: "Protect the operating line, key meeting prep, and high-risk boundaries before deciding what moves first today.",
    },
    boundaryNote: sharedStarterBoundaryNote,
    suggestions: [
      {
        skillId: "opportunity-push",
        rationale: {
          zh: "帮助创始人先看清最值得推进的经营机会，而不是被碎片任务分散。",
          en: "Helps leadership see the most valuable operating opportunity before getting fragmented by random tasks.",
        },
        activationCue: {
          zh: "适用于需要收敛本周 top 动作、资源优先级或关键机会推进顺序的时候。",
          en: "Use when the team needs a top move, resource priority, or an order for key opportunity pushes.",
        },
      },
      {
        skillId: "approval-review",
        rationale: {
          zh: "把高风险对外表达和重要状态变更保留在明确复核边界内。",
          en: "Keeps high-risk external language and important state changes inside an explicit review boundary.",
        },
        activationCue: {
          zh: "适用于提案、报价解释、关键阶段变更或高风险外发草稿前。",
          en: "Use before proposals, pricing explanations, key stage changes, or risky outbound drafts.",
        },
      },
      {
        skillId: "meeting-briefing",
        rationale: {
          zh: "让关键会前先看到承诺、阻塞和对象状态，不用临场重建上下文。",
          en: "Lets leadership see commitments, blockers, and object state before a key meeting instead of rebuilding context live.",
        },
        activationCue: {
          zh: "适用于董事会、关键客户会、招聘终面或内部决策会前。",
          en: "Use before board-style reviews, key customer calls, final interviews, or internal decision meetings.",
        },
      },
    ],
  },
  SALES_LEAD: {
    summary: {
      zh: "先稳住机会排序、外部跟进质量和审批边界，再谈放量。",
      en: "Stabilize opportunity order, outbound follow-up quality, and approval boundaries before scaling activity.",
    },
    boundaryNote: sharedStarterBoundaryNote,
    suggestions: [
      {
        skillId: "opportunity-push",
        rationale: {
          zh: "帮助销售负责人判断今天最该推进哪条机会，而不是平均用力。",
          en: "Helps a sales lead decide which opportunity deserves attention today instead of spreading effort evenly.",
        },
        activationCue: {
          zh: "适用于 pipeline 复核、阶段推进和 conversion 阻塞排序。",
          en: "Use during pipeline review, stage progression, and conversion-blocker prioritization.",
        },
      },
      {
        skillId: "external-followup-draft",
        rationale: {
          zh: "把客户语境、阻塞和承诺收成更稳的跟进草稿。",
          en: "Turns customer context, blockers, and promises into a more reliable follow-up draft.",
        },
        activationCue: {
          zh: "适用于会后跟进、提案 clarifications 和异议处理。",
          en: "Use for post-meeting follow-up, proposal clarifications, and objection handling.",
        },
      },
      {
        skillId: "approval-review",
        rationale: {
          zh: "确保销售压力不会把高风险措辞直接推过复核边界。",
          en: "Ensures sales pressure does not push high-risk wording past the review boundary.",
        },
        activationCue: {
          zh: "适用于客户催报价、催时间线 或需要解释商业条件时。",
          en: "Use when customers push for pricing, timeline, or commercial-condition explanations.",
        },
      },
    ],
  },
  ACCOUNT_EXECUTIVE: {
    summary: {
      zh: "先把单条机会的外联、线程恢复和下一步动作收顺，再追求更多触达量。",
      en: "Keep outreach, thread revival, and the next step coherent on each opportunity before chasing more volume.",
    },
    boundaryNote: sharedStarterBoundaryNote,
    suggestions: [
      {
        skillId: "external-followup-draft",
        rationale: {
          zh: "帮助 AE 更快产出可审的对外跟进草稿。",
          en: "Helps an AE produce reviewable outbound follow-up drafts faster.",
        },
        activationCue: {
          zh: "适用于客户会后、线程停滞后和回应 draft 需要更快落笔时。",
          en: "Use after customer calls, when threads stall, or when a reply draft needs to move quickly.",
        },
      },
      {
        skillId: "relationship-revival",
        rationale: {
          zh: "当联系人掉速或卡在等待我方时，先生成低阻力恢复动作。",
          en: "When a contact cools or waits on us, it generates a low-friction revival move first.",
        },
        activationCue: {
          zh: "适用于沉默联系人、未回邮件和需要轻量重启对话的时候。",
          en: "Use for silent contacts, unanswered emails, or lightweight conversation restarts.",
        },
      },
      {
        skillId: "opportunity-push",
        rationale: {
          zh: "把单条机会的 下一步 绑回阶段、风险和承诺，而不是只做一次性跟进。",
          en: "Binds the next step back to stage, risk, and promises instead of treating follow-up as one-off outreach.",
        },
        activationCue: {
          zh: "适用于判断该约会、改阶段还是先补内部同步的时候。",
          en: "Use when deciding whether to book, change stage, or sync internally first.",
        },
      },
    ],
  },
  RECRUITER: {
    summary: {
      zh: "先把候选人会前准备、会后动作和失温恢复收顺，再扩大流程吞吐。",
      en: "Keep candidate prep, follow-through, and revival coherent before expanding process throughput.",
    },
    boundaryNote: sharedStarterBoundaryNote,
    suggestions: [
      {
        skillId: "meeting-briefing",
        rationale: {
          zh: "让面试或候选人同步前先看到岗位、候选人和反馈链上下文。",
          en: "Shows role, candidate, and feedback-chain context before an interview or candidate sync.",
        },
        activationCue: {
          zh: "适用于初面、复面、offer 沟通或 hiring sync 会前。",
          en: "Use before screening calls, panel interviews, offer discussions, or hiring syncs.",
        },
      },
      {
        skillId: "meeting-follow-through",
        rationale: {
          zh: "把面试反馈、责任人和下一轮动作收成明确推进链。",
          en: "Turns interview feedback, owners, and the next round into a clear progress chain.",
        },
        activationCue: {
          zh: "适用于面试后需要同步反馈、约下一轮或明确负责人的时候。",
          en: "Use after interviews when feedback, next rounds, or ownership need to be made explicit.",
        },
      },
      {
        skillId: "relationship-revival",
        rationale: {
          zh: "帮助招聘顾问处理候选人掉线、迟疑或等待我方的情况。",
          en: "Helps a recruiter handle candidates who cool off, hesitate, or wait on us.",
        },
        activationCue: {
          zh: "适用于候选人迟迟未回、面试安排停滞或需要低阻力重启联系的时候。",
          en: "Use when candidates stop responding, interview scheduling stalls, or a low-friction restart is needed.",
        },
      },
    ],
  },
  CUSTOMER_SUCCESS: {
    summary: {
      zh: "先把客户风险、续约扩容线索和 follow-through 收顺，再谈更主动的经营动作。",
      en: "Keep customer risk, renewal-expansion signals, and follow-through coherent before more proactive commercial moves.",
    },
    boundaryNote: sharedStarterBoundaryNote,
    suggestions: [
      {
        skillId: "relationship-revival",
        rationale: {
          zh: "帮助 CS 在客户沉默、活跃度下降或 issue 等待我方时先恢复节奏。",
          en: "Helps CS restore tempo when customers go quiet, engagement drops, or an issue waits on us.",
        },
        activationCue: {
          zh: "适用于续约前沉默、上线后冷却或升级处理停住的时候。",
          en: "Use before renewals when a customer goes quiet, after launch cooling, or when escalations stall.",
        },
      },
      {
        skillId: "external-followup-draft",
        rationale: {
          zh: "把风险说明、下一步和客户语境收成更稳的 follow-up 草稿。",
          en: "Turns risk explanation, next steps, and customer context into a more reliable follow-up draft.",
        },
        activationCue: {
          zh: "适用于续约跟进、升级回复、上线回顾和扩容探测时。",
          en: "Use for renewal follow-up, escalation replies, launch reviews, and expansion probes.",
        },
      },
      {
        skillId: "meeting-follow-through",
        rationale: {
          zh: "把客户会后的负责人、时间窗口和 follow-through 写回统一上下文。",
          en: "Writes owners, timing windows, and follow-through back into one customer context after a meeting.",
        },
        activationCue: {
          zh: "适用于 QBR、问题复盘、续约评估和风险升级会后。",
          en: "Use after QBRs, issue reviews, renewal evaluations, and risk-escalation meetings.",
        },
      },
    ],
  },
  DELIVERY_LEAD: {
    summary: {
      zh: "先把交付前提、会前上下文和会后负责人收顺，再扩大客户承诺面。",
      en: "Keep delivery prerequisites, pre-meeting context, and post-meeting ownership coherent before widening any customer promise surface.",
    },
    boundaryNote: sharedStarterBoundaryNote,
    suggestions: [
      {
        skillId: "meeting-briefing",
        rationale: {
          zh: "帮助交付负责人在关键对齐会前先看到范围、依赖和阻塞。",
          en: "Helps a delivery lead see scope, dependencies, and blockers before a key alignment meeting.",
        },
        activationCue: {
          zh: "适用于 kickoff、走查、提案复核和风险 sync 会前。",
          en: "Use before kickoffs, walkthroughs, proposal reviews, and risk syncs.",
        },
      },
      {
        skillId: "meeting-follow-through",
        rationale: {
          zh: "把会后的交付 下一步、责任人和时间窗口收成执行链。",
          en: "Turns the next delivery step, owner, and timing window after a meeting into an execution chain.",
        },
        activationCue: {
          zh: "适用于方案确认、上线排期、问题复盘和跨团队交接会后。",
          en: "Use after solution alignment, launch scheduling, issue reviews, and cross-team handoffs.",
        },
      },
      {
        skillId: "approval-review",
        rationale: {
          zh: "确保时间线、范围和实施表述仍带前置 / 依赖边界。",
          en: "Ensures timeline, scope, and implementation language still carries prerequisite and dependency boundaries.",
        },
        activationCue: {
          zh: "适用于客户追问交付日期、范围确认或资源承诺的时候。",
          en: "Use when customers push on delivery dates, scope confirmation, or resourcing commitments.",
        },
      },
    ],
  },
  PRODUCT_ENGINEER: {
    summary: {
      zh: "先把问题定义、会后动作和事实修正收顺，再推进更大的实现切片。",
      en: "Keep problem definition, post-meeting moves, and fact correction coherent before pushing larger implementation slices.",
    },
    boundaryNote: sharedStarterBoundaryNote,
    suggestions: [
      {
        skillId: "meeting-briefing",
        rationale: {
          zh: "帮助产品/工程在讨论前先看到对象状态、未完成承诺和已知阻塞。",
          en: "Helps product and engineering see object state, unfinished commitments, and known blockers before discussion.",
        },
        activationCue: {
          zh: "适用于需求澄清、设计评审、实施 kick-off 和问题复盘会前。",
          en: "Use before requirement clarification, design review, implementation kickoff, and issue review meetings.",
        },
      },
      {
        skillId: "meeting-follow-through",
        rationale: {
          zh: "把讨论结果收成明确动作、负责人和下一步验证窗口。",
          en: "Condenses discussion results into explicit actions, owners, and the next validation window.",
        },
        activationCue: {
          zh: "适用于评审后需要拆 动作item、指派负责人或补审批入口的时候。",
          en: "Use after reviews when action items, owners, or approval entry points need to be made explicit.",
        },
      },
      {
        skillId: "memory-correction",
        rationale: {
          zh: "帮助团队及时修正失效事实、误读需求和过期判断。",
          en: "Helps the team correct stale facts, misunderstood requirements, and outdated judgements promptly.",
        },
        activationCue: {
          zh: "适用于需求漂移、事实冲突或会后发现总结有误的时候。",
          en: "Use when requirements drift, facts conflict, or meeting summaries later prove inaccurate.",
        },
      },
    ],
  },
  OPERATIONS_FINANCE: {
    summary: {
      zh: "先把治理判断、就绪度 诊断和状态修正收顺，再扩大内部支持动作。",
      en: "Keep governance judgement, readiness diagnostics, and state correction coherent before widening internal support actions.",
    },
    boundaryNote: sharedStarterBoundaryNote,
    suggestions: [
      {
        skillId: "approval-review",
        rationale: {
          zh: "帮助运营/财务/支持角色守住高风险状态变更和人工复核边界。",
          en: "Helps operations, finance, and support roles protect high-risk state changes behind explicit human review.",
        },
        activationCue: {
          zh: "适用于 seat、billing、support exception 或高风险组织状态更新前。",
          en: "Use before seat, billing, support-exception, or high-risk organization-state updates.",
        },
      },
      {
        skillId: "pilot-readiness-diagnostics",
        rationale: {
          zh: "帮助这类角色把 recommendation、经营记忆、LLM、采集 和审批边界压成 就绪度 判断。",
          en: "Helps these roles compress recommendation, memory, LLM, capture, and approval boundaries into a readiness judgement.",
        },
        activationCue: {
          zh: "适用于试点复盘、上线前检查和运行健康度排查。",
          en: "Use during pilot reviews, pre-launch checks, and operating health investigations.",
        },
      },
      {
        skillId: "memory-correction",
        rationale: {
          zh: "让错误状态、过期例外和不再成立的支持判断被及时修正。",
          en: "Ensures incorrect states, expired exceptions, and stale support judgements are corrected quickly.",
        },
        activationCue: {
          zh: "适用于对账差异、支持记录错误和组织状态解释链不一致的时候。",
          en: "Use when reconciliation differs, support records are wrong, or the organization-state reason chain no longer matches reality.",
        },
      },
    ],
  },
  GENERAL_OPERATOR: {
    summary: {
      zh: "先把会后推进、事实修正和复核边界收顺，再逐步分化更细角色。",
      en: "Keep post-meeting follow-through, fact correction, and review boundaries coherent before splitting into narrower roles.",
    },
    boundaryNote: sharedStarterBoundaryNote,
    suggestions: [
      {
        skillId: "meeting-follow-through",
        rationale: {
          zh: "这是通用运营位最容易产生稳定价值的起步技能，能直接减少动作掉线。",
          en: "This is the most reliable starting skill for a general operator because it directly reduces dropped actions.",
        },
        activationCue: {
          zh: "适用于任何需要把会议或同步结果收成动作、负责人和时间窗口的时候。",
          en: "Use whenever a meeting or sync needs to become actions, owners, and timing windows.",
        },
      },
      {
        skillId: "memory-correction",
        rationale: {
          zh: "帮助通用运营位先把事实、阻塞和承诺的基础数据守准。",
          en: "Helps a general operator keep the base facts, blockers, and commitments accurate first.",
        },
        activationCue: {
          zh: "适用于信息冲突、上下文失真或旧判断继续被引用的时候。",
          en: "Use when information conflicts, context drifts, or stale judgements keep getting reused.",
        },
      },
      {
        skillId: "approval-review",
        rationale: {
          zh: "避免通用执行位在主动协同时越过高风险复核边界。",
          en: "Prevents a general execution role from crossing high-risk review boundaries while being proactive.",
        },
        activationCue: {
          zh: "适用于需要代整理外发草稿、状态更新或协调多方动作的时候。",
          en: "Use when preparing outbound drafts, state updates, or coordinating multi-party moves.",
        },
      },
    ],
  },
};

function localizeText(text: LocalizedText, locale: UiLocale) {
  return locale === "en-US" ? text.en : text.zh;
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function localizeOperatingSkillName(skillId: OperatingSkillId, locale: UiLocale) {
  const localizedName = localizedOperatingSkillNames[skillId];

  if (localizedName) {
    return localizeText(localizedName, locale);
  }

  return getOperatingSkillById(skillId)?.name ?? skillId;
}

function matchesAny(text: string, matchers: string[]) {
  return matchers.some((matcher) => text.includes(normalizeText(matcher)));
}

function buildContextWeights(
  context: RoleFoundationContextInput | undefined,
): Partial<Record<OperatingSkillId, number>> {
  const weights: Partial<Record<OperatingSkillId, number>> = {};
  const focusAreas = (context?.focusAreas ?? [])
    .map((item) => item.trim())
    .filter(Boolean);

  for (const focusArea of focusAreas) {
    const normalizedFocusArea = normalizeText(focusArea);

    for (const signal of focusAreaSkillSignals) {
      if (!matchesAny(normalizedFocusArea, signal.matchers)) {
        continue;
      }

      for (const [skillId, weight] of Object.entries(signal.weights) as Array<
        [OperatingSkillId, number | undefined]
      >) {
        if (!weight) continue;
        weights[skillId] = (weights[skillId] ?? 0) + weight;
      }
    }
  }

  return weights;
}

function buildWorkspaceContext(
  rolePresetKey: RolePresetKey,
  locale: UiLocale,
  context: RoleFoundationContextInput | undefined,
): LocalizedRoleFoundationContext {
  const english = locale === "en-US";
  const preset = getRolePresetDefinition(rolePresetKey);
  const profileType = context?.workspaceProfileType?.trim() || null;
  const focusAreas = (context?.focusAreas ?? [])
    .map((item) => item.trim())
    .filter(Boolean);
  const normalizedProfileType = normalizeText(profileType);
  const profileMatchesPreset =
    !!normalizedProfileType &&
    (normalizedProfileType.includes(normalizeText(preset.defaultWorkspaceProfileType)) ||
      matchesAny(normalizedProfileType, preset.matchers));

  return {
    postureSummary: profileType
      ? profileMatchesPreset
        ? english
          ? `Current workspace posture already reads like ${profileType}, so this preset is a stable starting point.`
          : `当前工作区姿态已经接近“${profileType}”，所以这个角色预设可以作为稳定起点。`
        : english
          ? `Current workspace posture is ${profileType}, so treat this preset as an editable starting point rather than the final role contract.`
          : `当前工作区姿态是“${profileType}”，所以这组角色定义更适合作为可编辑起点，而不是最终角色合同。`
      : english
        ? "Workspace posture is still unset, so this preset should stay a starting point rather than a final role contract."
        : "当前工作区姿态还未设置，所以这组角色定义更应被当作起点，而不是最终角色合同。",
    focusSummary:
      focusAreas.length > 0
        ? english
          ? `Current focus areas: ${focusAreas.join(", ")}. Starter skills are ordered to help translate those threads into the next operating moves.`
          : `当前关注重点：${focusAreas.join("、")}。下面的 starter skills 已按这些主线做了轻量排序，帮助把它们翻译成下一步经营动作。`
        : null,
    adaptationNote:
      profileType && !profileMatchesPreset
        ? english
          ? "Because the workspace posture and preset are not a perfect match yet, keep editing the mission, handoff edges, and starter skill posture to fit how the team actually works."
          : "由于当前工作区姿态和所选预设还不是完全贴合，这组使命、交接边缘和 starter skill姿态 仍需要继续按团队真实协作方式改写。"
        : null,
  };
}

export function getRoleStarterSkillPack(
  rolePresetKey: RolePresetKey,
  locale: UiLocale,
  context?: RoleFoundationContextInput,
): LocalizedRoleStarterSkillPack {
  const pack = roleStarterSkillPacks[rolePresetKey];
  const contextWeights = buildContextWeights(context);
  const localizedSuggestions = pack.suggestions.map((suggestion) => ({
    skillId: suggestion.skillId,
    skillName: localizeOperatingSkillName(suggestion.skillId, locale),
    rationale: localizeText(suggestion.rationale, locale),
    activationCue: localizeText(suggestion.activationCue, locale),
  }));
  const orderedSuggestions = localizedSuggestions
    .map((suggestion, index) => ({
      suggestion,
      index,
      weight: contextWeights[suggestion.skillId] ?? 0,
    }))
    .sort((left, right) => right.weight - left.weight || left.index - right.index)
    .map((item) => item.suggestion);

  return {
    summary: localizeText(pack.summary, locale),
    boundaryNote: localizeText(pack.boundaryNote, locale),
    suggestions: orderedSuggestions,
  };
}

export function getRoleFoundation(
  rolePresetKey: RolePresetKey,
  locale: UiLocale,
  context?: RoleFoundationContextInput,
): LocalizedRoleFoundation {
  const localizedPreset = localizeRolePreset(
    getRolePresetDefinition(rolePresetKey),
    locale,
  );

  return {
    rolePresetKey,
    soulLite: {
      label: localizedPreset.label,
      summary: localizedPreset.summary,
      mission: localizedPreset.mission,
      ownedOutcomes: localizedPreset.ownedOutcomes,
      mainJudgements: localizedPreset.mainJudgements,
      handoffEdges: localizedPreset.handoffEdges,
      successSignals: localizedPreset.successSignals,
      boundaryNotes: localizedPreset.boundaryNotes,
    },
    starterSkillPack: getRoleStarterSkillPack(rolePresetKey, locale, context),
    workspaceContext: buildWorkspaceContext(rolePresetKey, locale, context),
  };
}

export function listRoleFoundations(
  locale: UiLocale,
  context?: RoleFoundationContextInput,
) {
  return ROLE_PRESET_KEYS.map((rolePresetKey) =>
    getRoleFoundation(rolePresetKey, locale, context),
  );
}
