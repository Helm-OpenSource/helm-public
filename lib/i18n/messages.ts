import { isEnglishLocale, type UiLocale } from "@/lib/i18n/config";

const zh = {
  shell: {
    brand: "Helm",
    shellHeadline: "今天该做什么，已经排好了",
    shellBody:
      "会议、邮件、CRM 串成一条推进链。客户可见的动作，永远等你点。",
    nav: {
      dashboard: "今天",
      operating: "今天业务",
      opportunities: "客户推进",
      meetings: "会议工作",
      approvals: "待你复核",
      inbox: "客户消息",
      memory: "客户记忆",
      capture: "现场记录",
      analytics: "效果变化",
      reports: "经营复盘",
      imports: "数据接入",
      diagnostics: "就绪检查",
      tenantHealth: "客户健康",
      gtmLeads: "增长线索",
      mobile: "移动工作",
      settings: "设置",
      search: "搜索",
    },
    pendingApprovals: "待你点的复核",
    pendingApprovalsBody: "客户可见的草稿全部停在这里等你点。",
    viewQueue: "去复核",
    searchPlaceholder: "搜联系人、机会、会议，或直接问问题（Cmd/Ctrl + K）",
    commandPalette: "命令面板",
    quickCreate: "快速创建",
    notifications: "通知",
    workspaceTagline: "客户推进 · 判断 / 复核 / 沉淀",
    mobileCurrentActions: "今天待处理",
    localeLabel: "界面语言",
    pilotBadge: "需你确认",
    demoEntry: "演示入口",
    demoEntryBody: "随时回到角色切换 / 演示账号 / 价值说明。",
    trialSignup: "申请试点",
    trialSignupBody:
      "把演示里看到的卡片，变成你团队真实的工作区配置。",
  },
  crm: {
    eyebrow: "CRM 接入",
    title: "接入 HubSpot / Salesforce，先看今天该推进什么",
    description:
      "联系人、公司、机会和活动接进来后，先看今日重点、阻塞、承诺和下一步。",
    intelligenceLayer: "经营判断层",
    connectedCrmSources: "已连接 CRM 来源",
    importHistory: "历史导入任务",
    openConflicts: "待人工冲突",
    recentSuccessRecords: "最近成功记录",
    connect: "连接",
    connectDemo: "接入示例工作区",
    preview: "预览导入",
    firstImport: "首次导入",
    incrementalSync: "增量同步",
    disconnect: "断开连接",
    directPreview: "直接预览导入",
    warmupReady: "预热就绪",
    usingMock: "当前使用示例数据预览。如需切换到真实数据，请先在「连接」页配置真实的 OAuth 凭据。",
    usingReal: "当前使用真实 CRM 数据预览。",
    latestJobs: "最近导入结果",
    warmupValue: "导入后价值预热",
  },
  settings: {
    eyebrow: "工作区设置",
    title: "今天的工作区哪里会卡住",
    description:
      "这里统一管理组织状态、席位、收入归因、暂缓付款、内部使用、CRM / 阿里邮箱连接、动作策略、预算、团队关系、分析诊断，以及中国区续费、恢复和计费刷新路径。修改后会立即影响当前工作区的运营姿态。",
    restoreDefaults: "恢复默认值",
    rerunSetup: "重新体验初始化向导",
    tabs: {
      account: "工作区",
      billing: "计费",
      connectors: "连接",
      policies: "动作规则",
      budgets: "预算规则",
      permissions: "团队",
      pilot: "运行预设",
    },
    pilot: {
      title: "试点运营与多语言控制",
      description:
        "这里收口 Salesforce / HubSpot 客户试点最关心的边界：默认语言、试点模式、能力开关、保留策略和现场记录授权提示。",
      locale: "默认界面语言",
      pilotMode: "试点模式",
      retention: "转写文本 / 洞察保留天数",
      consent: "开始现场记录前要求授权确认",
      flags: "能力开关",
      save: "保存试点设置",
      diagnostics: "打开试点诊断页",
      hint: "这些配置会立即影响全局 shell、试点诊断页和会话捕获边界。",
    },
  },
  diagnostics: {
    eyebrow: "协同就绪度",
    title: "会议回路现在能不能继续放大",
    description:
      "先看会议、会后动作、记忆和接入是否卡住，再决定下一步该进会议、复核还是设置。",
    readiness: "协同回路准备度",
    quality: "质量回归",
    integrations: "接入健康度",
    llmAsr: "智能服务 / 转写健康度",
    recentJobs: "最近的导入与采集任务",
  },
  capture: {
    entryLabel: "开始录制",
    pageEyebrow: "60 分钟会议 → 90 秒变事实",
    pageTitle: "录下这场会，把承诺和阻塞带回工作区",
    pageDescription:
      "会后先得到事实、承诺、阻塞和跟进动作；需要确认的内容进复核，稳定信息进入经营记忆。",
    start: "开始录制",
    consentTitle: "录制前请先确认对方授权",
    consentDescription:
      "当前工作区要求每次会前明确授权确认。一句「我授权录制和转写」就够，但必须有。勾选即表示你已完成对被录方的口头告知并获得同意；该确认将随会话记录存档。",
    consentCheckbox: "我已确认本次会议的录音 / 转写授权",
  },
};

const en = {
  shell: {
    brand: "Helm",
    shellHeadline:
      "Today's calls that need you are already lined up.",
    shellBody:
      "Meetings, mail and CRM joined into one push chain. Customer-facing moves always wait for your click.",
    nav: {
      dashboard: "Today",
      operating: "Command",
      opportunities: "Customer work",
      meetings: "Meeting work",
      approvals: "Your reviews",
      inbox: "Customer messages",
      memory: "Business memory",
      capture: "Field notes",
      analytics: "Outcome change",
      reports: "Operating review",
      imports: "Data sources",
      diagnostics: "Readiness check",
      tenantHealth: "Customer health",
      gtmLeads: "Growth signals",
      mobile: "Mobile work",
      settings: "Settings",
      search: "Search",
    },
    pendingApprovals: "Waiting on your click",
    pendingApprovalsBody:
      "Customer-facing drafts stop here. None of them go out without you.",
    viewQueue: "Open review queue",
    searchPlaceholder:
      "Search contacts, deals, meetings — or just ask a question (Cmd/Ctrl + K)",
    commandPalette: "Command palette",
    quickCreate: "Quick create",
    notifications: "Notifications",
    workspaceTagline: "Operating loop · judge, review, remember",
    mobileCurrentActions: "Waiting on you today",
    localeLabel: "UI language",
    pilotBadge: "Controlled pilot",
    demoEntry: "Demo entry",
    demoEntryBody:
      "Jump back to role switcher, demo accounts, value framing — any time.",
    trialSignup: "Apply for pilot",
    trialSignupBody:
      "Turn the demo cards you saw into your team's real workspace.",
  },
  crm: {
    eyebrow: "CRM connector",
    title:
      "Connect HubSpot / Salesforce, then see today's customer work.",
    description:
      "Bring in contacts, companies, opportunities and activity, then start with priorities, blockers, commitments and the next step.",
    intelligenceLayer: "intelligence layer",
    connectedCrmSources: "Connected CRM sources",
    importHistory: "Import jobs",
    openConflicts: "Open conflicts",
    recentSuccessRecords: "Recently imported records",
    connect: "Connect",
    connectDemo: "Use demo workspace",
    preview: "Preview import",
    firstImport: "Initial import",
    incrementalSync: "Incremental sync",
    disconnect: "Disconnect",
    directPreview: "Preview now",
    warmupReady: "Warmup ready",
    usingMock: "Preview is currently based on demo CRM data. To switch to real data, configure live OAuth credentials in Connections first.",
    usingReal: "Preview is currently based on real CRM data.",
    latestJobs: "Recent import results",
    warmupValue: "Post-import warmup",
  },
  settings: {
    eyebrow: "Intelligence settings",
    title:
      "What can block today’s workspace",
    description:
      "This page now keeps organization state, lifecycle, seat posture, worker entitlements, revenue attribution, payable-later posture, internal usage, CRM / Aliyun Mail connections, action policies, budgets, team controls, analytics diagnostics, and the China renew / restore / billing refresh operator path in one place.",
    restoreDefaults: "Restore defaults",
    rerunSetup: "Replay setup wizard",
    tabs: {
      account: "Workspace",
      billing: "Billing",
      connectors: "Connections",
      policies: "Action rules",
      budgets: "Budget rules",
      permissions: "Team",
      pilot: "Operating preset",
    },
    pilot: {
      title: "Pilot operations and multilingual controls",
      description:
        "This is where trial controls for Salesforce / HubSpot customers live: default locale, pilot mode, feature flags, retention window and capture consent.",
      locale: "Default UI locale",
      pilotMode: "Pilot mode",
      retention: "Transcript / insight retention days",
      consent: "Require consent confirmation before capture",
      flags: "Feature flags",
      save: "Save pilot settings",
      diagnostics: "Open diagnostics",
      hint: "These settings affect the global shell, diagnostics view and conversation-capture boundary immediately.",
    },
  },
  diagnostics: {
    eyebrow: "Trial diagnostics",
    title: "Can the meeting loop scale now",
    description:
      "Check meetings, follow-through, memory and ingress blockers before deciding the next meeting, review or settings action.",
    readiness: "Pilot readiness",
    quality: "Quality baseline",
    integrations: "Integration health",
    llmAsr: "LLM / ASR health",
    recentJobs: "Recent import and capture jobs",
  },
  capture: {
    entryLabel: "Start recording",
    pageEyebrow: "60-min meeting → 90-second facts",
    pageTitle: "Record the meeting, keep commitments and blockers",
    pageDescription:
      "After the meeting, facts, commitments, blockers and follow-ups are ready. Items that need confirmation go to review; stable facts enter memory.",
    start: "Start recording",
    consentTitle: "Confirm recording consent before you press record",
    consentDescription:
      "This workspace requires an explicit consent confirmation each time. \"I authorize recording and transcription\" is enough, but it has to be stated. Ticking the box confirms you have verbally notified the recorded party and obtained consent; the confirmation is archived with the session.",
    consentCheckbox:
      "I have confirmed recording / transcription consent for this session",
  },
};

export type UiMessages = typeof zh;

export function getUiMessages(locale: UiLocale): UiMessages {
  return isEnglishLocale(locale) ? en : zh;
}
