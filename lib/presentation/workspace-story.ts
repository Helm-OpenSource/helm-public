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
      description: "",
    },
    meetings: {
      eyebrow: english ? "Meetings" : "会议",
      description: "",
    },
    approvals: {
      eyebrow: english ? "Review queue" : "复核队列",
      description: "",
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
      eyebrow: english ? "Customer memory" : "客户记忆",
      description: "",
    },
    reports: {
      eyebrow: english ? "Weekly read" : "周复盘",
      title: english ? "Weekly review" : "经营复盘",
      description: "",
    },
    settings: {
      eyebrow: english ? "Workspace settings" : "工作区设置",
      description: "",
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
        description: "",
      },
    },
    sales: {
      dashboard: {
        eyebrow: english ? "Sales demo · today" : "销售模式 · 今天",
        description: "",
      },
      opportunities: {
        eyebrow: english ? "Sales demo · pipeline" : "销售模式 · 管线",
        description: "",
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
