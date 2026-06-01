type BreadcrumbSegmentMeta = Record<
  string,
  {
    label: string;
    isNavigable?: boolean;
  }
>;

export type BreadcrumbCrumb = {
  href: string;
  label: string;
  isDynamic: boolean;
  isNavigable: boolean;
};

export function buildBreadcrumbSegmentLabels(
  english: boolean,
): BreadcrumbSegmentMeta {
  return {
    dashboard: { label: english ? "Today" : "目标推进台" },
    assets: { label: english ? "Business assets" : "经营资产" },
    customer: { label: english ? "Customer asset" : "客户资产", isNavigable: false },
    opportunity: { label: english ? "Opportunity asset" : "机会资产", isNavigable: false },
    commitment: { label: english ? "Commitment asset" : "承诺资产", isNavigable: false },
    risk: { label: english ? "Risk asset" : "风险资产", isNavigable: false },
    operating: { label: english ? "Operating" : "经营总盘" },
    opportunities: { label: english ? "Opportunities" : "机会" },
    contacts: { label: english ? "Contacts" : "联系人" },
    companies: { label: english ? "Companies" : "公司" },
    meetings: { label: english ? "Meetings" : "会议与推进" },
    approvals: { label: english ? "Approvals" : "待确认动作" },
    inbox: { label: english ? "Inbox" : "收件箱" },
    memory: { label: english ? "Memory" : "经营记忆" },
    analytics: { label: english ? "Judgement performance" : "判断表现" },
    "customer-success": { label: english ? "Customer success" : "客户成功" },
    "success-checks": {
      label: english ? "Success checks" : "成功复盘",
      isNavigable: false,
    },
    "expansion-reviews": {
      label: english ? "Expansion reviews" : "扩展复盘",
      isNavigable: false,
    },
    "review-requests": {
      label: english ? "Review requests" : "复核请求",
      isNavigable: false,
    },
    "follow-ups": {
      label: english ? "Follow-ups" : "跟进详情",
      isNavigable: false,
    },
    proposals: {
      label: english ? "Proposals" : "方案详情",
      isNavigable: false,
    },
    sendability: {
      label: english ? "Sendability" : "发送边界",
      isNavigable: false,
    },
    roles: {
      label: english ? "Role handoff" : "角色接手",
      isNavigable: false,
    },
    packages: { label: english ? "Packages" : "方案包" },
    reports: { label: english ? "Weekly operating review" : "本周经营复盘" },
    imports: { label: english ? "Connections" : "连接" },
    settings: { label: english ? "Workspace settings" : "工作区设置" },
    search: { label: english ? "Search" : "搜索" },
    setup: { label: english ? "Setup" : "初始化" },
    capture: { label: english ? "Start capture" : "开始记录" },
    diagnostics: { label: english ? "Diagnostics" : "协同就绪度" },
    readout: { label: english ? "Signal review" : "信号复核" },
    crm: { label: "CRM" },
    jobs: { label: english ? "Jobs" : "任务", isNavigable: false },
    conflicts: { label: english ? "Conflicts" : "冲突" },
  };
}

function buildUnknownSegmentCrumb(input: {
  pathnameParts: string[];
  index: number;
  english: boolean;
}): Omit<BreadcrumbCrumb, "href"> {
  if (input.index === 0) {
    return {
      label: input.english ? "Customer workspace" : "客户工作区",
      isDynamic: false,
      isNavigable: false,
    };
  }

  if (input.index === 1 && input.pathnameParts.length >= 3) {
    return {
      label: input.english ? "Business system" : "业务系统",
      isDynamic: false,
      isNavigable: false,
    };
  }

  return {
    label: input.english ? "Detail" : "详情",
    isDynamic: true,
    isNavigable: false,
  };
}

export function buildBreadcrumbCrumbs(pathname: string, english: boolean): BreadcrumbCrumb[] {
  const parts = pathname.split("/").filter(Boolean);
  const segmentLabels = buildBreadcrumbSegmentLabels(english);

  return parts.reduce<BreadcrumbCrumb[]>((crumbs, part, index) => {
    if (part.startsWith("(")) {
      return crumbs;
    }

    const previousPart = parts[index - 1];
    const isDynamic = !segmentLabels[part] && index > 0 && previousPart in segmentLabels;
    const href = `/${parts.slice(0, index + 1).join("/")}`;
    const fallback = buildUnknownSegmentCrumb({
      pathnameParts: parts,
      index,
      english,
    });

    crumbs.push({
      href,
      label: segmentLabels[part]?.label ?? fallback.label,
      isDynamic: segmentLabels[part] ? false : isDynamic || fallback.isDynamic,
      isNavigable: segmentLabels[part]
        ? (segmentLabels[part].isNavigable ?? true)
        : fallback.isNavigable,
    });
    return crumbs;
  }, []);
}
