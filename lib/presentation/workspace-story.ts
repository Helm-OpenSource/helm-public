import type { DemoMode } from "@/lib/demo/demo-modes";
import type { UiLocale } from "@/lib/i18n/config";

type WorkspacePageKey =
  | "dashboard"
  | "opportunities"
  | "meetings"
  | "approvals"
  | "contacts"
  | "companies"
  | "memory"
  | "reports"
  | "settings";

type WorkspaceStory = {
  eyebrow: string;
  title?: string;
  description: string;
};

function isEnglish(locale: UiLocale) {
  return locale === "en-US";
}

export function getWorkspaceStory(
  page: WorkspacePageKey,
  locale: UiLocale,
  demoMode: DemoMode | null,
): WorkspaceStory {
  const english = isEnglish(locale);

  const base: Record<WorkspacePageKey, WorkspaceStory> = {
    dashboard: {
      eyebrow: english ? "Today" : "今天",
      title: english ? "Today's work" : "今天的工作",
      description: "",
    },
    opportunities: {
      eyebrow: english ? "Pipeline" : "销售管线",
      description: english
        ? "Heating up, slipping, dead. With the next move named for each."
        : "升温的、掉速的、已死的。每条都标好下一步该做什么。",
    },
    meetings: {
      eyebrow: english ? "Meetings" : "会议",
      description: "",
    },
    approvals: {
      eyebrow: english ? "Review queue" : "复核队列",
      description: english
        ? "Drafts that touch your customer or your CRM stop here. Approve, edit, or hold — every choice lands an audit trace you can replay."
        : "客户可见的草稿、客户关系系统阶段变更，全部停在这里等你点。通过 / 改写 / 保留——每一次都会落一条可回放的审计 trace。",
    },
    contacts: {
      eyebrow: english ? "Relationships" : "关系视图",
      description: "",
    },
    companies: {
      eyebrow: english ? "Accounts" : "账户视图",
      description: "",
    },
    memory: {
      eyebrow: english ? "Customer asset trail" : "客户资产脉络",
      description: english
        ? "Every customer fact, promise, blocker and correction stays traceable."
        : "客户事实、承诺、阻塞和修正都留在同一条脉络里。",
    },
    reports: {
      eyebrow: english ? "Weekly read" : "周复盘",
      title: english
        ? "Two weeks of movement and next week’s pressure points."
        : "两周推进、风险和下周抓手，一页看清。",
      description: english
        ? "Which opportunities moved, which follow-ups slipped, and which risks still need an owner before the leadership 1:1."
        : "哪些机会推进了、哪些回访掉了、哪些风险还没人接——为周一的领导 1:1 准备好。",
    },
    settings: {
      eyebrow: english ? "Workspace settings" : "工作区设置",
      description: english
        ? "Ingress, review queue, team access, cost — check these so today doesn't get blocked."
        : "入口、复核队列、团队权限、成本——先看一眼，免得今天被卡住。",
    },
  };

  if (!demoMode) return base[page];

  const demoStories: Record<
    DemoMode,
    Partial<Record<WorkspacePageKey, WorkspaceStory>>
  > = {
    founder: {
      dashboard: {
        eyebrow: english ? "Founder demo · today" : "创始人模式 · 今天",
        description: "",
      },
      meetings: {
        eyebrow: english ? "Founder demo · meetings" : "创始人模式 · 会议",
        description: "",
      },
      approvals: {
        eyebrow: english ? "Founder demo · review" : "创始人模式 · 复核",
        description: english
          ? "Where AI runs free, where the founder must sign. The line is drawn — and it's never automatic on customer-facing moves."
          : "AI 可自动跑的地方 vs 创始人必须亲自签的地方。线画得很清楚——客户可见的事永远不自动。",
      },
    },
    sales: {
      dashboard: {
        eyebrow: english ? "Sales demo · today" : "销售模式 · 今天",
        description: "",
      },
      opportunities: {
        eyebrow: english ? "Sales demo · pipeline" : "销售模式 · 管线",
        description: english
          ? "Heating up, slipping, dead — sorted by which one most needs you, not by close date."
          : "升温的 / 掉速的 / 已死的——按「现在最需要你」排序，不是按预计成交日。",
      },
      contacts: {
        eyebrow: english ? "Sales demo · relationships" : "销售模式 · 关系",
        description: "",
      },
    },
    recruiter: {
      dashboard: {
        eyebrow: english ? "Recruiter demo · today" : "猎头模式 · 今天",
        description: "",
      },
      meetings: {
        eyebrow: english ? "Recruiter demo · meetings" : "猎头模式 · 面试",
        description: "",
      },
      contacts: {
        eyebrow: english ? "Recruiter demo · candidates" : "猎头模式 · 候选人",
        description: "",
      },
    },
  };

  return {
    ...base[page],
    ...(demoStories[demoMode][page] ?? {}),
  };
}
