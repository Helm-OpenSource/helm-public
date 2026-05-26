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
    crm: { label: "CRM" },
    jobs: { label: english ? "Jobs" : "任务", isNavigable: false },
    conflicts: { label: english ? "Conflicts" : "冲突" },
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
    const label = segmentLabels[part]?.label ?? (isDynamic ? (english ? "Detail" : "详情") : part);
    const href = `/${parts.slice(0, index + 1).join("/")}`;

    crumbs.push({
      href,
      label,
      isDynamic,
      isNavigable: !isDynamic && (segmentLabels[part]?.isNavigable ?? true),
    });
    return crumbs;
  }, []);
}
