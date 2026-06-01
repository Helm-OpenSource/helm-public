import type { UiLocale } from "@/lib/i18n/config";
import { isEnglishLocale } from "@/lib/i18n/config";
import { safeParseJson } from "@/lib/utils";

export type DemoMode = "sales" | "recruiter" | "founder";

export type DemoModeProfile = {
  mode: DemoMode;
  accountEmail: string;
  accountName: string;
  accountRoleLabel: string;
  workspaceName: string;
  badge: string;
  homepagePriorityLabel: string;
  homepageMarketingCopy: string;
  title: string;
  description: string;
  idealCustomer: string;
  experienceSummary: string;
  experienceHighlights: string[];
  conversionPrompt: string;
  quickPath: Array<{
    label: string;
    href: string;
  }>;
};

type SearchParamsLike = {
  get(name: string): string | null;
};

type WorkspaceDemoConfig = {
  demoMode?: DemoMode | null;
};

const zhProfiles: Record<DemoMode, DemoModeProfile> = {
  sales: {
    mode: "sales",
    accountEmail: "saleslead@demo.com",
    accountName: "周玥",
    accountRoleLabel: "商务转化模式",
    workspaceName: "中国企业软件销售转化演示",
    badge: "商务转化演示",
    homepagePriorityLabel: "首页首推模式",
    homepageMarketingCopy: "如果客户是中国 B2B 软件、AI 服务或企业服务团队，先看这一站。它展示 Helm 如何把会议、邮件和 CRM 信号收成今天必须推进的客户动作。",
    title: "企业软件销售 vertical：把大客户试点、老单恢复、安全评审卡点收成今天的推进动作",
    description: "围绕大客户试点、老机会恢复、安全评审卡点三条线展开，让客户看到 Helm 不是替代 CRM，而是把分散信号变成可推进、可复核、可追踪的商务动作。",
    idealCustomer: "30-300 人中国 B2B SaaS、企业软件、AI 服务商和高客单咨询交付团队，已经有 CRM，但会后推进、客户复盘和跨部门协同仍然靠销售负责人盯人。",
    experienceSummary: "打开即看到：今天最该推进的大客户、已经逾期的恢复单、卡在安全评审的项目，以及从 HubSpot 导入后自动串起的客户事实。",
    experienceHighlights: [
      "3 个中国企业客户机会：1 个试点升温 / 1 个老单恢复 / 1 个安全与交付协同卡点",
      "会议纪要已经沉淀成客户承诺、风险卡点和下一步动作",
      "HubSpot 导入结果、身份冲突复核和今日推进顺序已经就绪",
    ],
    conversionPrompt: "不用替换 CRM。Helm 把会议、邮件、复核边界和掉单风险接起来，10 分钟让销售负责人看到今天最该推进的 3 件事。",
    quickPath: [
      { label: "首页看经营局势", href: "/dashboard" },
      {
        label: "机会页看推进顺序",
        href: "/opportunities?mine=1&action=priority#opportunity-judgement-workspace",
      },
      {
        label: "机会页看关系判断",
        href: "/opportunities?mine=1#opportunity-memory-summary",
      },
      { label: "CRM 导入页看 HubSpot 价值", href: "/imports/crm" },
    ],
  },
  recruiter: {
    mode: "recruiter",
    accountEmail: "recruiter@demo.com",
    accountName: "沈乔",
    accountRoleLabel: "猎头顾问模式",
    workspaceName: "猎头顾问交付工作台演示",
    badge: "猎头顾问演示",
    homepagePriorityLabel: "第三优先模式",
    homepageMarketingCopy: "猎头模式是最贴的垂直证明：把「职位推进 / 候选人体验 / 面试跟进 / 审批边界」收成一条交付控制链。",
    title: "招聘 / 猎头：让候选人不再因为反馈拖到第 9 天而被别家挖走",
    description: "围绕「候选人在降温 / 反馈逾期 / 职位真实压力」三件事展开，让顾问看到交付节奏正在被系统接住，不再靠脑子硬记。",
    idealCustomer: "Retained search、RPO 和高客单招聘顾问团队，尤其是已经在 Salesforce 管职位但终面到 offer 这一段总是掉地的团队。",
    experienceSummary: "打开即看到：本周哪位终面在降温、哪条反馈已逾期、哪个职位的客户压力是真的，以及已接入推进链的 Salesforce 活动。",
    experienceHighlights: [
      "1 个核心职位 + 2 条候选人主推进 + 1 条已流失但可维系的样例",
      "会议、沟通线程、复核、时间线全部围绕候选人体验组织",
      "Salesforce 活动和任务已经转成会议、时间线和下一步建议",
    ],
    conversionPrompt: "你们已经有 ATS 或 CRM。Helm 补的是面试到 offer 这一段——让候选短名单不再因为反馈节奏掉地。",
    quickPath: [
      { label: "首页看职位压力", href: "/dashboard" },
      {
        label: "机会页看职位与候选人推进",
        href: "/opportunities?mine=1&action=priority#opportunity-judgement-workspace",
      },
      { label: "会议页看会后安排", href: "/meetings" },
      { label: "复核与边界看面试安排控制", href: "/approvals#approval-preview" },
    ],
  },
  founder: {
    mode: "founder",
    accountEmail: "founder@demo.com",
    accountName: "林舟",
    accountRoleLabel: "创始人工作台模式",
    workspaceName: "创始人经营工作台演示",
    badge: "创始人 / COO 演示",
    homepagePriorityLabel: "第二优先模式",
    homepageMarketingCopy: "如果客户是创始人办公室或 COO，再看这一站。它展示 Helm 如何把销售推进、内部资源和复核边界收成经营者当天要拍板的事项。",
    title: "创始人 / COO：今天必须由你拍板的事，已经排好顺序在等你",
    description: "不是又一个工具。是把销售推进、内部协同冲突、审批边界、策略变更全部收在同一前台——你不用再当全公司的传话员。",
    idealCustomer: "创始人办公室、COO、经营负责人——同时盯销售、合作、内部资源冲突和审批边界的人。",
    experienceSummary: "打开即看到：今天必须创始人拍板的 3 件事、会后推进、边界状态、经营记忆和多源数据健康度。",
    experienceHighlights: [
      "合作拓展 / 内部资源冲突 / 高风险审批，全部在同一前台",
      "会议页、复核中心、策略页、诊断页串成完整的「可控 AI」叙事",
      "HubSpot / Salesforce / 现场录制 / 智能处理 / 改进建议——已闭环",
    ],
    conversionPrompt: "这不是 CRM，也不是聊天机器人。是你团队的经营前台——把今天最重要的动作、风险和复核边界收在同一屏。",
    quickPath: [
      { label: "首页看跨线局势", href: "/dashboard" },
      { label: "会议页看会后闭环", href: "/meetings" },
      { label: "复核与边界看控制边界", href: "/approvals#approval-preview" },
      { label: "诊断页看试点准备度", href: "/diagnostics" },
    ],
  },
};

const enProfiles: Record<DemoMode, DemoModeProfile> = {
  sales: {
    mode: "sales",
    accountEmail: "saleslead@demo.com",
    accountName: "Zhou Yue",
    accountRoleLabel: "Commercial conversion mode",
    workspaceName: "China Enterprise Software Sales Demo",
    badge: "Commercial Conversion Demo",
    homepagePriorityLabel: "Primary homepage mode",
    homepageMarketingCopy: "Start here for B2B software, AI service and enterprise-service buyers in China. It shows how Helm turns meetings, mail and CRM signals into the customer moves that need attention today.",
    title: "Enterprise software sales vertical: warming pilots, recovery deals and security-review stalls turned into today's push moves.",
    description: "Lead with one warming pilot, one recovery deal and one security-review stall so buyers see Helm as the operating layer above CRM, not a CRM replacement.",
    idealCustomer: "Best for 30-300 person B2B SaaS, enterprise software, AI service and high-value consulting teams in China that already use CRM but still rely on sales leaders to chase follow-through.",
    experienceSummary: "The first screen already shows the top enterprise account, the overdue recovery deal, the security-review stall and the HubSpot import signals behind the judgement.",
    experienceHighlights: [
      "Three client opportunities cover warming, at-risk and internal-coordination stall scenarios",
      "Sales meetings are already converted into commitments, blockers and recommendations",
      "HubSpot import results, conflict review and today focus warmup are ready to show",
    ],
    conversionPrompt: "Conversion framing: you do not need to replace the CRM. Helm sits above it and turns meetings, follow-up, approvals and risk visibility into a daily operating layer.",
    quickPath: [
      { label: "Start from the dashboard", href: "/dashboard" },
      {
        label: "Show opportunity order",
        href: "/opportunities?mine=1&action=priority#opportunity-judgement-workspace",
      },
      {
        label: "Open relationship judgement",
        href: "/opportunities?mine=1#opportunity-memory-summary",
      },
      { label: "Show HubSpot import value", href: "/imports/crm" },
    ],
  },
  recruiter: {
    mode: "recruiter",
    accountEmail: "recruiter@demo.com",
    accountName: "Shen Qiao",
    accountRoleLabel: "Recruiter mode",
    workspaceName: "Recruiter Delivery Workspace Demo",
    badge: "Recruiter Demo",
    homepagePriorityLabel: "Third recommended mode",
    homepageMarketingCopy: "Recruiter mode is the vertical proof point. It turns role delivery, candidate experience, interview follow-through and approval control into one operating loop.",
    title: "Search teams: stop losing finalists to silent feedback windows. Helm keeps the rhythm alive.",
    description: "Center on cooling finalists, overdue feedback and real role pressure. The candidate experience is the product — not the ATS field. Show that.",
    idealCustomer: "Best for retained search, RPO and high-value recruiting teams that already track roles in Salesforce or ATS, but still lose momentum in the last mile.",
    experienceSummary: "The first screen already shows role pressure, candidate timing risk, interview movement and imported Salesforce activity value.",
    experienceHighlights: [
      "One core role plus two live candidate tracks and one recovery path",
      "Meetings, threads, approvals and timelines are organized around candidate experience",
      "Salesforce events and tasks already feed meetings, timelines and recommendations",
    ],
    conversionPrompt: "Conversion framing: your ATS keeps records, while this workspace keeps the delivery rhythm from breaking between client calls, interviews and approvals.",
    quickPath: [
      { label: "Open the dashboard", href: "/dashboard" },
      {
        label: "Open the role pipeline",
        href: "/opportunities?mine=1&action=priority#opportunity-judgement-workspace",
      },
      { label: "Open the meeting page", href: "/meetings" },
      { label: "Show approval control", href: "/approvals#approval-preview" },
    ],
  },
  founder: {
    mode: "founder",
    accountEmail: "founder@demo.com",
    accountName: "Lin Zhou",
    accountRoleLabel: "Founder workspace mode",
    workspaceName: "Founder Operating Workspace Demo",
    badge: "Founder / COO Demo",
    homepagePriorityLabel: "Second recommended mode",
    homepageMarketingCopy: "Use founder mode after the commercial conversion path. It shows how founders and COOs see sales movement, internal resource tradeoffs and review boundaries in one operating surface.",
    title: "Founders & COOs: today's calls only you can make — already lined up.",
    description: "Helm isn't a point tool. It's the one front end where partnerships, internal tradeoffs, approvals, policy and audit come together — so you stop being the company's middleware.",
    idealCustomer: "Best for founders, COOs and operator-led teams that need one surface for external momentum, internal tradeoffs and policy-controlled execution.",
    experienceSummary: "The first screen already combines cross-line priorities, meetings, approval load, evolution signals and operating diagnostics.",
    experienceHighlights: [
      "Partnerships, internal conflicts and high-risk approvals live in the same operating view",
      "Meeting, approval, policy and diagnostics pages tell a complete controlled-agent story",
      "HubSpot, Salesforce, capture, LLM and evolution already connect into one loop",
    ],
    conversionPrompt: "Conversion framing: this is not another CRM or chatbot. It is the operating control layer that tells the team what matters, what is risky and what AI can do under policy.",
    quickPath: [
      { label: "Open the dashboard", href: "/dashboard" },
      {
        label: "See post-meeting loop on the meeting page",
        href: "/meetings",
      },
      { label: "Open approvals", href: "/approvals#approval-preview" },
      { label: "Open diagnostics", href: "/diagnostics" },
    ],
  },
};

export function getDemoModeProfiles(locale: UiLocale) {
  const profiles = isEnglishLocale(locale) ? enProfiles : zhProfiles;
  return [profiles.sales, profiles.founder, profiles.recruiter];
}

export function getDemoModeProfile(mode: DemoMode, locale: UiLocale) {
  return (isEnglishLocale(locale) ? enProfiles : zhProfiles)[mode];
}

export function getDemoAccountCards(locale: UiLocale) {
  return getDemoModeProfiles(locale).map((profile) => ({
    email: profile.accountEmail,
    name: profile.accountName,
    roleLabel: profile.accountRoleLabel,
    description: profile.description,
    badge: profile.badge,
    workspaceName: profile.workspaceName,
    idealCustomer: profile.idealCustomer,
  }));
}

export function resolveWorkspaceDemoMode(rawConfiguration: string | null | undefined): DemoMode | null {
  const parsed = safeParseJson<WorkspaceDemoConfig | null>(rawConfiguration, null);
  const demoMode = parsed?.demoMode;
  if (demoMode === "sales" || demoMode === "recruiter" || demoMode === "founder") {
    return demoMode;
  }
  return null;
}

export function demoQuickPathMatchesLocation(
  href: string,
  pathname: string,
  searchParams?: SearchParamsLike,
) {
  const target = new URL(href, "https://helm.local");
  const exactPathMatch = pathname === target.pathname;
  const nestedPathMatch =
    target.pathname !== "/" && pathname.startsWith(`${target.pathname}/`);

  if (!exactPathMatch && !nestedPathMatch) {
    return false;
  }

  for (const [key, value] of target.searchParams.entries()) {
    if ((searchParams?.get(key) ?? null) !== value) {
      return false;
    }
  }

  return true;
}
