import type { OperatingFoundationSummary } from "@/lib/operating-system/foundation";
import {
  buildHighFrequencyActionTemplateHint,
  getHighFrequencyActionTemplate,
  type HighFrequencyActionTemplateKey,
} from "@/lib/operating-system/action-templates";

export type GoalDrivenHomeLink = {
  label: string;
  hint: string;
  href: string;
};

export type GoalDrivenHomeCampaign = {
  title: string;
  summary: string;
  boundary: string;
  href: string;
};

export type GoalDrivenHomeModel = {
  eyebrow: string;
  title: string;
  description: string;
  currentCampaign: GoalDrivenHomeCampaign;
  topJudgements: GoalDrivenHomeLink[];
  immediateActions: GoalDrivenHomeLink[];
  topChains: GoalDrivenHomeLink[];
  topBlockers: GoalDrivenHomeLink[];
  topDecisionRequests: GoalDrivenHomeLink[];
  helmDid: GoalDrivenHomeLink[];
  roleHandoffs: GoalDrivenHomeLink[];
  actionTemplates: GoalDrivenHomeLink[];
  retroFeedback: GoalDrivenHomeLink[];
  evidenceEntries: GoalDrivenHomeLink[];
  note: string;
};

type GoalDrivenHomeInput = {
  english: boolean;
  foundationSummary: OperatingFoundationSummary;
  dailyBriefTitle: string;
  dailyBriefSummary: string;
  topJudgements: GoalDrivenHomeLink[];
  topChains: GoalDrivenHomeLink[];
  topDecisionRequests: GoalDrivenHomeLink[];
  roleHandoffs: GoalDrivenHomeLink[];
  highRiskOpportunity?: GoalDrivenHomeLink | null;
  pendingApprovals: number;
  waitingOnUsThreadCount: number;
  followUpDueCount: number;
  meetingsToday: number;
  importedSignalCount: number;
  executedToday: number;
};

function fillToThree(
  items: GoalDrivenHomeLink[],
  fallback: GoalDrivenHomeLink[],
) {
  const unique = new Map<string, GoalDrivenHomeLink>();
  for (const item of [...items, ...fallback]) {
    if (!unique.has(item.label)) {
      unique.set(item.label, item);
    }
  }
  return Array.from(unique.values()).slice(0, 3);
}

function buildTemplateLinks(
  keys: HighFrequencyActionTemplateKey[],
  english: boolean,
): GoalDrivenHomeLink[] {
  return keys
    .map((key) => getHighFrequencyActionTemplate(key, english))
    .filter((template): template is NonNullable<typeof template> =>
      Boolean(template),
    )
    .map((template) => ({
      label: template.title,
      hint: buildHighFrequencyActionTemplateHint(template, english),
      href: template.href,
    }));
}

export function buildGoalDrivenHomeModel(
  input: GoalDrivenHomeInput,
): GoalDrivenHomeModel {
  const goalItem =
    input.foundationSummary.items.find((item) => /Goal/.test(item.label)) ??
    input.foundationSummary.items[input.foundationSummary.items.length - 1];
  const goalConnection =
    input.foundationSummary.connections.find((item) =>
      /Goal|campaign/i.test(item.label),
    ) ?? input.foundationSummary.connections[0];

  const blockerFallback: GoalDrivenHomeLink[] = [
    input.highRiskOpportunity ?? {
      label: input.english ? "High-risk pressure" : "高风险压力",
      hint: input.english
        ? "Review the highest-risk active opportunity before new outward movement."
        : "先看当前最高风险的活跃机会，再决定要不要继续对外推进。",
      href: "/opportunities?preset=high-risk",
    },
    {
      label: input.english
        ? `${input.pendingApprovals} actions still need approval`
        : `还有 ${input.pendingApprovals} 个动作待审批`,
      hint: input.english
        ? "Pending approvals still block safe external movement and clean execution."
        : "待审批动作还在阻塞安全的对外推进和干净执行。",
      href: "/approvals",
    },
    {
      label: input.english
        ? `${input.waitingOnUsThreadCount} threads are waiting on us`
        : `还有 ${input.waitingOnUsThreadCount} 条线程在等我方回应`,
      hint: input.english
        ? "Inbox pressure is now shaping opportunity and customer-success momentum."
        : "收件箱等待压力已经开始改写机会推进和客户 success 节奏。",
      href: "/inbox?status=WAITING_US",
    },
    {
      label: input.english
        ? `${input.followUpDueCount} follow-ups are due`
        : `还有 ${input.followUpDueCount} 个 follow-up 到期`,
      hint: input.english
        ? "Delayed follow-up will keep cooling warm chains if not pulled forward."
        : "如果不把这些 follow-up 往前拉，暖线会继续掉温。",
      href: "/opportunities?preset=overdue",
    },
  ];

  const decisionFallback: GoalDrivenHomeLink[] = [
    ...input.topDecisionRequests,
    {
      label: input.english
        ? "Clear pending approval boundaries"
        : "先收清待审批边界",
      hint: input.english
        ? "Do not let approval backlog hide which move is safe to send."
        : "不要让审批积压掩盖哪一步现在可以安全往外走。",
      href: "/approvals",
    },
    {
      label: input.english ? "Re-rank active chains" : "重排当前推进链",
      hint: input.english
        ? "Use operating home to confirm the one or two chains the team should protect first."
        : "回到 operating home，确认团队现在真正该先保哪一两条经营链。",
      href: "/operating",
    },
    {
      label: input.english
        ? "Refresh memory and trace"
        : "回看系统记忆与来龙去脉",
      hint: input.english
        ? "When judgement feels noisy, reopen replay and memory before widening scope."
        : "当当前判断开始发散，就先回看系统记忆、会议回放和审批记录，而不是直接扩场。",
      href: "/memory",
    },
  ];

  const helmDidFallback: GoalDrivenHomeLink[] = [
    {
      label: input.english
        ? `${input.executedToday} actions already executed today`
        : `今天已经替团队推进了 ${input.executedToday} 个已执行动作`,
      hint: input.english
        ? "Execution history is already changing the next recommendation order."
        : "这些已执行动作已经开始改写后续判断建议的排序。",
      href: "/memory",
    },
    {
      label: input.english
        ? `${input.meetingsToday} meetings already prepared`
        : `今天已经提前准备了 ${input.meetingsToday} 场会议`,
      hint: input.english
        ? "Meeting briefings and follow-through are part of the current operating loop."
        : "会前准备和会后跟进已经进入今天的经营闭环。",
      href: "/meetings",
    },
    {
      label: input.english
        ? `${input.importedSignalCount} new work signals were ingested`
        : `今天已经收进 ${input.importedSignalCount} 条新业务信号`,
      hint: input.english
        ? "Fresh inputs are already reshaping ranking, follow-up and handoff pressure."
        : "新输入已经开始影响排序、跟进节奏和接手压力。",
      href: "/imports",
    },
  ];

  const evidenceEntries = fillToThree(
    input.foundationSummary.connections
      .filter((connection) => Boolean(connection.href))
      .map((connection) => ({
        label: connection.value,
        hint: connection.description,
        href: connection.href ?? "/memory",
      })),
    [
      {
        label: input.english
          ? "Memory timeline and replay"
          : "记忆时间线与回放",
        hint: input.english
          ? "Use replay, audit and corrections when the team needs proof."
          : "当团队需要证据时，回到回放、审计和 修正。",
        href: "/memory",
      },
      {
        label: input.english
          ? "Internal operating workspace"
          : "内部经营 workspace",
        hint: input.english
          ? "Use operating home when you need object, role and chain context together."
          : "当你需要把对象、角色和经营链放在一起看时，回到 operating home。",
        href: "/operating",
      },
      {
        label: input.english ? "Approval boundary" : "审批边界",
        hint: input.english
          ? "Approval queue shows which moves are still waiting on a real commitment."
          : "审批队列会明确告诉你哪些动作还在等待真正的承诺。",
        href: "/approvals",
      },
    ],
  );

  const immediateActions = fillToThree(
    [
      ...input.roleHandoffs.map((item) => ({
        label: input.english
          ? `Route now: ${item.label}`
          : `现在接手：${item.label}`,
        hint: item.hint,
        href: item.href,
      })),
      ...input.topDecisionRequests.map((item) => ({
        label: input.english
          ? `Decide now: ${item.label}`
          : `现在拍板：${item.label}`,
        hint: item.hint,
        href: item.href,
      })),
      ...input.topChains.map((item) => ({
        label: input.english
          ? `Advance now: ${item.label}`
          : `现在推进：${item.label}`,
        hint: item.hint,
        href: item.href,
      })),
    ],
    [
      {
        label: input.english
          ? "Open the founder handoff now"
          : "现在打开创始人接手面",
        hint: input.english
          ? "Use the founder lane when campaign shape, blockers and priority order still need one real owner."
          : "当主战场形状、阻塞和优先级还需要一个人来拍板时，先回创始人接手面。",
        href: "/operating/roles/founder",
      },
      {
        label: input.english
          ? "Push the hottest customer chain"
          : "先推进最热客户链",
        hint: input.english
          ? "Move the warmest chain before another approval, inbox or blocker loop cools it down."
          : "在审批、收件箱或阻塞再次让它降温之前，先把最热的那条链往前推。",
        href: "/operating/roles/sales",
      },
      {
        label: input.english
          ? "Write back the latest review result"
          : "先回挂最新复盘结果",
        hint: input.english
          ? "Keep the latest meeting or review result from floating outside memory and campaign."
          : "不要让最新会议或复盘结果继续飘在系统外面，先把它收回系统。",
        href: "/memory",
      },
    ],
  );

  const actionTemplates = buildTemplateLinks(
    ["follow-up", "review-request", "escalation", "proposal-offer-next-step"],
    input.english,
  );

  const retroFeedback = fillToThree(
    [
      {
        label: input.english
          ? "Meeting / review -> memory"
          : "会议 / 复盘结果 → 系统记忆",
        hint: input.english
          ? "Write the latest meeting and review result back into memory before the team re-judges the same chain."
          : "先把最新会议和复盘结果回写进系统记忆，再继续推进同一条链。",
        href: "/memory",
      },
      {
        label: input.english
          ? "Decision / blocker -> campaign"
          : "阻塞变化 / 新决策 → 当前主战场",
        hint: input.english
          ? "Update the current campaign when a blocker clears or a decision reshapes priority."
          : "当阻塞被清掉，或新决策改写了优先级，就把它回挂到当前主战场。",
        href: "/operating",
      },
      {
        label: input.english
          ? "Follow-through result -> object summary"
          : "推进结果 → 对象摘要",
        hint: input.english
          ? "Keep object summaries honest by writing the latest result back instead of re-explaining it elsewhere."
          : "把最新结果直接回写到对象摘要里，而不是在别处重新解释一遍。",
        href: "/operating",
      },
    ],
    evidenceEntries,
  );

  return {
    eyebrow: input.english ? "Goal-driven home" : "目标驱动首页",
    title: input.english
      ? "Run the workspace through campaign, blockers and handoffs first"
      : "先按主战场、阻塞和接手关系来看今天的经营总盘",
    description: input.english
      ? "The dashboard should now answer what war the company is fighting, which chains deserve protection, and which decision requests need a real owner next."
      : "首页现在先回答公司在打哪场仗、哪几条经营链最值得保，以及哪几件事现在真的需要有人拍板。",
    currentCampaign: {
      title: input.dailyBriefTitle,
      summary: goalItem?.value ?? input.dailyBriefSummary,
      boundary: goalConnection?.description ?? input.foundationSummary.note,
      href: goalConnection?.href ?? "/operating",
    },
    topJudgements: fillToThree(input.topJudgements, [
      {
        label: input.english
          ? "Refresh today’s priorities"
          : "刷新今天最值得处理的事",
        hint: input.dailyBriefSummary,
        href: "/dashboard#today-priorities",
      },
      {
        label: input.english
          ? "Check the main approval boundary"
          : "先确认关键审批边界",
        hint: input.english
          ? "Use approval pressure to confirm which move still needs a real decision owner."
          : "先用审批压力确认哪一步现在还需要真正有人拍板。",
        href: "/approvals",
      },
      {
        label: input.english
          ? "Keep the main chain visible"
          : "让主推进链继续保持可见",
        hint: input.english
          ? "Do not let object browsing replace the current operating judgement."
          : "不要让对象浏览重新替代今天最重要的判断。",
        href: "/operating",
      },
    ]),
    immediateActions,
    topChains: fillToThree(input.topChains, [
      {
        label: input.english
          ? "Open the current operating chain"
          : "查看当前经营链",
        hint: input.english
          ? "Use operating home when you need the current chain instead of another object list."
          : "当你需要当前经营链，而不是另一张对象表时，回到 operating home。",
        href: "/operating",
      },
      {
        label: input.english
          ? "Open the hottest proposal / offer chain"
          : "打开最热的方案 / 报价链",
        hint: input.english
          ? "Keep the commercial chain warm before it cools into another stale list."
          : "在商业链掉温前，把最热的方案 / 报价继续往前推进。",
        href: "/opportunities",
      },
      {
        label: input.english
          ? "Open the active customer-success chain"
          : "打开当前客户成功主链",
        hint: input.english
          ? "Use the current success chain when renewal or issue pressure starts shaping the day."
          : "当续费风险或问题处理开始影响今天判断时，先回到客户成功主链。",
        href: "/customer-success",
      },
    ]),
    topBlockers: fillToThree([], blockerFallback),
    topDecisionRequests: fillToThree(
      input.topDecisionRequests,
      decisionFallback,
    ),
    helmDid: fillToThree([], helmDidFallback),
    roleHandoffs: fillToThree(input.roleHandoffs, [
      {
        label: input.english ? "Founder handoff" : "创始人接手",
        hint: input.english
          ? "Keep strategic decisions and boundary pressure visible."
          : "把战略拍板和关键边界继续摆在前台。",
        href: "/operating/roles/founder",
      },
      {
        label: input.english ? "Sales handoff" : "销售接手",
        hint: input.english
          ? "Move the hottest lead and the clearest follow-up next."
          : "把最热的机会和最清楚的下一步跟进往前推。",
        href: "/operating/roles/sales",
      },
      {
        label: input.english ? "Customer success handoff" : "客户成功接手",
        hint: input.english
          ? "Keep issue, escalation and renewal pressure readable."
          : "继续把问题处理、升级压力和续费风险讲清楚。",
        href: "/operating/roles/customer-success",
      },
    ]),
    actionTemplates,
    retroFeedback,
    evidenceEntries,
    note: input.english
      ? "This goal-driven home now keeps immediate actions, action packs and retro write-back visible while still staying campaign-first, evidence-secondary and safely bounded."
      : "这张目标驱动首页会把立刻动作、常用动作模板和结果回写都摆到前台，同时继续保持主战场优先、依据第二层、边界清楚。",
  };
}
