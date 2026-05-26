const TOKEN_CN: Record<string, string> = {
  access: "访问",
  account: "账户",
  action: "动作",
  actionitem: "动作项",
  application: "申请",
  approval: "审批",
  approvalrequest: "审批请求",
  approvaltask: "审批任务",
  artifact: "产物",
  artifactbundle: "产物包",
  artifactreview: "产物审核",
  artifactversion: "产物版本",
  assignment: "分配",
  attribution: "归因",
  audit: "审计",
  auditlog: "审计日志",
  auth: "认证",
  authenrollment: "注册认证",
  authsession: "认证会话",
  authverificationcode: "认证验证码",
  auto: "自动",
  batch: "批次",
  beneficiary: "收款方",
  beneficiarypayoutprofile: "收款方打款档案",
  bi: "BI",
  billing: "计费",
  billingaccount: "计费账户",
  bireportdelivery: "BI报表投递",
  bireportrun: "BI报表运行",
  bireportsubscription: "BI报表订阅",
  blocker: "阻塞",
  brief: "简报",
  briefing: "简报",
  briefingsnapshot: "简报快照",
  budget: "预算",
  budgetrule: "预算规则",
  bundle: "包",
  cache: "缓存",
  call: "调用",
  callback: "回调",
  candidate: "候选",
  capability: "能力",
  capabilitycatalogentry: "能力目录条目",
  capture: "采集",
  capturesession: "采集会话",
  catalog: "目录",
  checkpoint: "检查点",
  code: "编码",
  commitment: "承诺",
  company: "公司",
  composition: "组合",
  compositionfailure: "组合失败",
  conflict: "冲突",
  connector: "连接器",
  connectoringestionrecord: "连接器入站记录",
  consolidation: "汇总",
  consolidationjob: "汇总任务",
  contact: "联系人",
  context: "上下文",
  contexteditevent: "上下文编辑事件",
  conversation: "会话",
  conversationinsight: "会话洞察",
  conversationtranscript: "会话转写",
  coordination: "协同",
  coordinationmetricsdaily: "协同每日指标",
  correction: "纠正",
  custom: "自定义",
  customengagement: "定制服务",
  daily: "每日",
  dailyusagesnapshot: "每日使用快照",
  delivery: "投递",
  delta: "变更",
  deltaevent: "变更事件",
  dri: "负责人",
  driassignment: "负责人分配",
  edge: "边界",
  edgebrief: "边界简报",
  edit: "编辑",
  email: "邮件",
  emailmessage: "邮件消息",
  emailthread: "邮件线程",
  engagement: "服务",
  enrollment: "注册",
  entitlement: "权益",
  entry: "条目",
  event: "事件",
  eventlog: "事件日志",
  execution: "执行",
  extension: "扩展",
  external: "外部",
  externalmemoryrecord: "外部记忆记录",
  externalmemorysyncstate: "外部记忆同步状态",
  fact: "事实",
  failure: "失败",
  feedback: "反馈",
  follow: "跟进",
  handoff: "交接",
  handoffpacket: "交接包",
  human: "人工",
  humanactionexecution: "人工动作执行",
  identity: "身份",
  identitymatch: "身份匹配",
  import: "导入",
  importitem: "导入项",
  importjob: "导入任务",
  importsource: "导入来源",
  ingestion: "入站",
  initiative: "倡议",
  initiativerun: "倡议执行",
  insight: "洞察",
  intent: "意图",
  item: "项",
  job: "任务",
  ledger: "台账",
  limited: "受限",
  limitedautointent: "受限自动意图",
  line: "明细",
  link: "关联",
  llm: "大模型",
  llmcalllog: "模型调用日志",
  log: "日志",
  match: "匹配",
  meeting: "会议",
  meetingnote: "会议笔记",
  membership: "成员关系",
  memory: "记忆",
  memorycandidate: "记忆候选",
  memorycorrection: "记忆纠正",
  memoryentry: "记忆条目",
  memoryfact: "记忆事实",
  memoryitem: "记忆项",
  memorylink: "记忆关联",
  memorypromotion: "记忆提升",
  message: "消息",
  metrics: "指标",
  model: "模型",
  n: "",
  note: "笔记",
  notebook: "工作笔记",
  notification: "通知",
  official: "官方",
  officialfollowthrough: "官方跟进",
  officialwriteintent: "官方写入意图",
  opportunity: "商机",
  packet: "包",
  participant: "参与者",
  participantportalaccess: "参与者门户访问",
  partner: "伙伴",
  partnerprogram: "伙伴计划",
  pattern: "模式",
  patternfact: "模式事实",
  payload: "载荷",
  payment: "支付",
  paymentwebhookcallbackevent: "支付Webhook回调事件",
  payout: "打款",
  payoutledger: "打款台账",
  persisted: "持久化",
  persistedpayload: "持久化载荷",
  policy: "策略",
  policyrule: "策略规则",
  portal: "门户",
  preference: "偏好",
  preferencesignal: "偏好信号",
  problem: "问题",
  problemspace: "问题空间",
  profile: "档案",
  program: "计划",
  programapplication: "计划申请",
  programtermsversion: "计划条款版本",
  promotion: "提升",
  prompt: "提示",
  promptcachetelemetry: "提示缓存遥测",
  publisher: "发布方",
  recommendation: "推荐",
  recommendationfeedback: "推荐反馈",
  recommendationlog: "推荐日志",
  record: "记录",
  referral: "推荐人",
  report: "报表",
  request: "请求",
  result: "结果",
  retrieval: "检索",
  retrievaltrace: "检索追踪",
  revenue: "收入",
  revenueattributionledger: "收入归因台账",
  revenuerule: "收入规则",
  review: "审核",
  rule: "规则",
  run: "运行",
  runtime: "运行时",
  runtimeevent: "运行时事件",
  runtimesession: "运行时会话",
  sales: "销售",
  salesreferral: "销售推荐",
  seat: "席位",
  seatprofilejobrun: "席位画像任务运行",
  seatprofileresult: "席位画像结果",
  session: "会话",
  sessioncheckpoint: "会话检查点",
  sessionnotebook: "会话笔记",
  settlement: "结算",
  settlementbatch: "结算批次",
  settlementbatchline: "结算明细",
  signal: "信号",
  signalevent: "信号事件",
  skill: "技能",
  skillsuggestion: "技能建议",
  snapshot: "快照",
  solution: "方案",
  source: "来源",
  space: "空间",
  state: "状态",
  strategy: "策略",
  strategysuggestion: "策略建议",
  subscription: "订阅",
  suggestion: "建议",
  sync: "同步",
  task: "任务",
  telemetry: "遥测",
  terms: "条款",
  thread: "线程",
  through: "贯通",
  trace: "追踪",
  transcript: "转写",
  trial: "试用",
  trialstate: "试用状态",
  truth: "真值",
  truthconflict: "真值冲突",
  usage: "使用",
  usageledger: "使用台账",
  user: "用户",
  verification: "验证",
  verificationreport: "验证报告",
  version: "版本",
  webhook: "回调",
  weekly: "每周",
  weeklyreport: "周报",
  worker: "执行器",
  workerentitlement: "执行器权益",
  workerpublisherprofile: "执行器发布方档案",
  workerrun: "执行器运行",
  workspace: "工作区",
  workspacesolutionextension: "工作区方案扩展",
  world: "世界",
  worldmodelsnapshot: "世界模型快照",
  write: "写入",
};

const TABLE_OVERRIDES: Record<string, string> = {
  contacttomeeting: "联系人与会议关联表",
  contacttoopportunity: "联系人与商机关联表",
};

const COLUMN_OVERRIDES: Record<string, string> = {
  id: "主键ID",
  legacy_id: "业务兼容ID",
  create_time: "创建时间",
  modify_time: "修改时间",
  a: "关联对象A ID",
  b: "关联对象B ID",
};

const TABLE_COLUMN_OVERRIDES: Record<string, Record<string, string>> = {
  contacttomeeting: {
    a: "联系人ID",
    b: "会议ID",
  },
  contacttoopportunity: {
    a: "联系人ID",
    b: "商机ID",
  },
};

function splitSnake(value: string) {
  return value
    .split("_")
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeTableName(tableName: string) {
  if (tableName.startsWith("n_")) {
    return tableName.slice(2);
  }
  return tableName;
}

function tokensToChinese(tokens: string[]) {
  const translated = tokens
    .map((token) => TOKEN_CN[token] ?? "")
    .filter(Boolean)
    .join("");
  return translated;
}

function baseCnFromName(name: string) {
  const direct = TOKEN_CN[name];
  if (direct) {
    return direct;
  }
  const tokens = splitSnake(name);
  const combined = tokensToChinese(tokens);
  if (combined) {
    return combined;
  }
  return "";
}

function fallbackLabel(raw: string, suffix: string) {
  return `业务${suffix}(${raw})`;
}

export function describeTableComment(tableName: string) {
  const normalized = normalizeTableName(tableName);
  if (TABLE_OVERRIDES[normalized]) {
    return TABLE_OVERRIDES[normalized];
  }
  const cn = baseCnFromName(normalized);
  if (cn) {
    return `${cn}表`;
  }
  return fallbackLabel(normalized, "数据表");
}

function composeIdComment(base: string, plural = false) {
  if (!base) {
    return plural ? "关联ID列表" : "关联ID";
  }
  return plural ? `${base}ID列表` : `${base}ID`;
}

function composeTimeComment(base: string, suffix: "时间" | "日期") {
  if (!base) {
    return suffix;
  }
  return `${base}${suffix}`;
}

export function describeColumnComment(tableName: string, columnName: string) {
  const normalizedTable = normalizeTableName(tableName);
  const tableOverrides = TABLE_COLUMN_OVERRIDES[normalizedTable];
  if (tableOverrides?.[columnName]) {
    return tableOverrides[columnName];
  }
  if (COLUMN_OVERRIDES[columnName]) {
    return COLUMN_OVERRIDES[columnName];
  }

  if (columnName.startsWith("is_")) {
    const base = baseCnFromName(columnName.slice(3));
    return base ? `是否${base}` : fallbackLabel(columnName, "标记");
  }
  if (columnName.startsWith("has_")) {
    const base = baseCnFromName(columnName.slice(4));
    return base ? `是否有${base}` : fallbackLabel(columnName, "标记");
  }
  if (columnName.startsWith("should_")) {
    const base = baseCnFromName(columnName.slice(7));
    return base ? `是否应${base}` : fallbackLabel(columnName, "标记");
  }
  if (columnName.startsWith("requires_")) {
    const base = baseCnFromName(columnName.slice(9));
    return base ? `是否需要${base}` : fallbackLabel(columnName, "标记");
  }

  if (columnName === "enabled") {
    return "是否启用";
  }
  if (columnName === "active") {
    return "是否激活";
  }
  if (columnName === "archived") {
    return "是否归档";
  }

  const suffixRules: Array<[string, (base: string) => string]> = [
    ["_ids", (base) => composeIdComment(base, true)],
    ["_id", (base) => composeIdComment(base)],
    ["_at", (base) => composeTimeComment(base, "时间")],
    ["_time", (base) => composeTimeComment(base, "时间")],
    ["_date", (base) => composeTimeComment(base, "日期")],
    ["_json", (base) => (base ? `${base}JSON` : "JSON数据")],
    ["_count", (base) => (base ? `${base}数量` : "数量")],
    ["_status", (base) => (base ? `${base}状态` : "状态")],
    ["_type", (base) => (base ? `${base}类型` : "类型")],
    ["_key", (base) => (base ? `${base}标识` : "标识")],
    ["_name", (base) => (base ? `${base}名称` : "名称")],
    ["_url", (base) => (base ? `${base}链接` : "链接")],
    ["_flag", (base) => (base ? `${base}标记` : "标记")],
    ["_score", (base) => (base ? `${base}评分` : "评分")],
    ["_level", (base) => (base ? `${base}等级` : "等级")],
    ["_reason", (base) => (base ? `${base}原因` : "原因")],
    ["_summary", (base) => (base ? `${base}摘要` : "摘要")],
    ["_note", (base) => (base ? `${base}说明` : "说明")],
    ["_notes", (base) => (base ? `${base}说明` : "说明")],
    ["_content", (base) => (base ? `${base}内容` : "内容")],
    ["_payload", (base) => (base ? `${base}载荷` : "载荷")],
  ];

  for (const [suffix, formatter] of suffixRules) {
    if (columnName.endsWith(suffix)) {
      const stem = columnName.slice(0, columnName.length - suffix.length);
      const base = baseCnFromName(stem);
      return formatter(base);
    }
  }

  const full = baseCnFromName(columnName);
  if (full) {
    return `${full}字段`;
  }

  return fallbackLabel(columnName, "字段");
}
