export type DataIntakeLocale = "zh-CN" | "en-US";

export type DataIntakeLevelKey = "L0" | "L1" | "L2";

export type SourceIntakeOption = {
  key: string;
  label: string;
  material: string;
  level: DataIntakeLevelKey;
  posture: string;
  primaryAction: string;
  boundary: string;
};

export type DataIntakeLevel = {
  key: DataIntakeLevelKey;
  title: string;
  summary: string;
  output: string;
};

export type ResourceAccessCatalogItem = {
  key: string;
  title: string;
  level: DataIntakeLevelKey;
  permissionSummary: string;
  dryRunEvidence: string;
  readOnlyStatus: string;
  failurePosture: string;
  forbiddenAction: string;
};

export type ProofPackageFile = {
  file: string;
  purpose: string;
};

const zhSourceIntakeOptions: SourceIntakeOption[] = [
  {
    key: "meeting_summary",
    label: "会议 / workshop 摘要",
    material: "承诺、风险、owner、缺口和回执摘要",
    level: "L0",
    posture: "manual_card / meeting_summary",
    primaryAction: "生成诊断方案",
    boundary: "不上传 raw transcript，不自动生成客户可见承诺",
  },
  {
    key: "chat_email_digest",
    label: "IM / 邮件 digest",
    material: "脱敏线程摘要、证据别名、跟进负责人",
    level: "L1",
    posture: "chat_digest / email_digest",
    primaryAction: "准备脱敏材料请求",
    boundary: "不自动回复、不自动外发、不进入正式 memory",
  },
  {
    key: "crm_ticket_snapshot",
    label: "CRM / 工单 snapshot",
    material: "截图、导出行、阶段漂移、负责人缺失",
    level: "L1",
    posture: "crm_snapshot / ticket_snapshot",
    primaryAction: "运行 fixture dry-run",
    boundary: "不静默改 CRM 阶段，不自动分配 owner",
  },
  {
    key: "redacted_sheet",
    label: "脱敏表格",
    material: "alias-only CSV / JSON / Markdown",
    level: "L1",
    posture: "redacted_sheet",
    primaryAction: "转换为 HSI fixture",
    boundary: "原始表格不进 repo，不证明生产 connector 安全",
  },
  {
    key: "marked_business_system",
    label: "业务系统显式标记",
    material: "data-helm-* 字段或 collect() payload",
    level: "L0",
    posture: "marked_dom / programmatic_event",
    primaryAction: "查看只读接入要求",
    boundary: "不自动扫页面全文，不后台写回客户系统",
  },
  {
    key: "read_only_api",
    label: "只读 API 授权",
    material: "最小 OAuth/API scope、dry-run fixture、审计 trace",
    level: "L2",
    posture: "read_only_connector",
    primaryAction: "准备只读接入评审包",
    boundary: "不是写回、外发、审批或客户部署授权",
  },
];

const enSourceIntakeOptions: SourceIntakeOption[] = [
  {
    key: "meeting_summary",
    label: "Meeting / workshop summary",
    material: "Commitments, risks, owners, gaps, and receipt summaries",
    level: "L0",
    posture: "manual_card / meeting_summary",
    primaryAction: "Generate diagnostic path",
    boundary: "No raw transcript upload and no customer-visible commitment",
  },
  {
    key: "chat_email_digest",
    label: "IM / email digest",
    material: "Redacted thread digest, evidence aliases, follow-up owner",
    level: "L1",
    posture: "chat_digest / email_digest",
    primaryAction: "Prepare redacted material request",
    boundary: "No auto-reply, external send, or official memory promotion",
  },
  {
    key: "crm_ticket_snapshot",
    label: "CRM / ticket snapshot",
    material: "Screenshots, export rows, stage drift, missing owner",
    level: "L1",
    posture: "crm_snapshot / ticket_snapshot",
    primaryAction: "Run fixture dry-run",
    boundary: "No silent CRM stage change and no automatic owner assignment",
  },
  {
    key: "redacted_sheet",
    label: "Redacted spreadsheet",
    material: "Alias-only CSV / JSON / Markdown",
    level: "L1",
    posture: "redacted_sheet",
    primaryAction: "Convert to HSI fixture",
    boundary: "Raw sheets stay out of repo; this does not prove connector safety",
  },
  {
    key: "marked_business_system",
    label: "Marked business system",
    material: "data-helm-* fields or collect() payload",
    level: "L0",
    posture: "marked_dom / programmatic_event",
    primaryAction: "Review read-only requirements",
    boundary: "No automatic full-page scraping and no customer-system writeback",
  },
  {
    key: "read_only_api",
    label: "Read-only API authorization",
    material: "Minimum OAuth/API scope, dry-run fixture, audit trace",
    level: "L2",
    posture: "read_only_connector",
    primaryAction: "Prepare read-only access packet",
    boundary: "Not writeback, external send, approval, or deployment authorization",
  },
];

const zhDataIntakeLevels: DataIntakeLevel[] = [
  {
    key: "L0",
    title: "L0 诊断材料",
    summary: "没有系统权限时，先用会议、IM、截图或显式标记形成 signal card。",
    output: "signal ledger / customer materials request",
  },
  {
    key: "L1",
    title: "L1 脱敏样本",
    summary: "用 redacted / synthetic fixture 跑 quality eval、HSI eval 和 review packet。",
    output: "fixture dry-run / proof package",
  },
  {
    key: "L2",
    title: "L2 只读接入",
    summary: "只在最小 scope、dry-run 和人工评审包成立后接 read-only connector。",
    output: "read-only ingest / audit trace",
  },
];

const enDataIntakeLevels: DataIntakeLevel[] = [
  {
    key: "L0",
    title: "L0 Diagnostic material",
    summary: "Without system access, start from meetings, IM, screenshots, or explicit markers.",
    output: "signal ledger / customer materials request",
  },
  {
    key: "L1",
    title: "L1 Redacted sample",
    summary: "Use redacted or synthetic fixtures for quality eval, HSI eval, and review packet.",
    output: "fixture dry-run / proof package",
  },
  {
    key: "L2",
    title: "L2 Read-only access",
    summary: "Attach read-only connectors only after minimum scope, dry-run, and review packet.",
    output: "read-only ingest / audit trace",
  },
];

const zhResourceAccessCatalog: ResourceAccessCatalogItem[] = [
  {
    key: "crm",
    title: "CRM / 工单",
    level: "L1",
    permissionSummary: "先用 snapshot 或脱敏导出；L2 只需要读取阶段、owner、时间和证据别名。",
    dryRunEvidence: "crm_snapshot fixture + HSI eval + review packet",
    readOnlyStatus: "真实 OAuth 前必须有 dry-run 通过记录",
    failurePosture: "认证失败、速率限制或空结果只显示提示并降级",
    forbiddenAction: "禁止自动写 CRM 阶段、自动派单或创建正式承诺",
  },
  {
    key: "mail-chat",
    title: "邮件 / IM",
    level: "L1",
    permissionSummary: "先收 digest；L2 只读线程摘要和证据别名，不默认读取完整私密原文。",
    dryRunEvidence: "email_digest / chat_digest ledger quality report",
    readOnlyStatus: "只读采集进入 review packet，不自动发送",
    failurePosture: "权限不明或 raw private 命中时 quarantine",
    forbiddenAction: "禁止自动回复、自动外发或自动进入正式 memory",
  },
  {
    key: "meeting",
    title: "会议 / workshop",
    level: "L0",
    permissionSummary: "优先人工摘要或脱敏纪要；不把实时录音平台当默认前提。",
    dryRunEvidence: "meeting_summary ledger + customer materials request",
    readOnlyStatus: "只准备承诺、风险、owner 和缺口候选",
    failurePosture: "缺 reviewer 或证据不足时只生成补证据请求",
    forbiddenAction: "禁止把会议摘要直接变成客户承诺或官方 memory",
  },
  {
    key: "sheet",
    title: "表格 / BI 导出",
    level: "L1",
    permissionSummary: "只接受 alias-only 或 redacted rows；原始表格不进入 public path。",
    dryRunEvidence: "redacted_sheet -> HSI fixture -> signal-quality report",
    readOnlyStatus: "作为 fixture candidate，不等于生产新鲜度证明",
    failurePosture: "发现私有字段、邮箱、URL 或 token 时拒绝/隔离",
    forbiddenAction: "禁止把原始表格提交进仓库或当作客户部署回执",
  },
  {
    key: "business-system",
    title: "业务 Web 系统",
    level: "L0",
    permissionSummary: "只读取显式 data-helm-* 标记或 collect() payload。",
    dryRunEvidence: "marked_dom example + local signal ledger",
    readOnlyStatus: "本地 ledger 先行，不创建 hosted ingest endpoint",
    failurePosture: "未显式标记的 DOM 文本不采集",
    forbiddenAction: "禁止页面全文扫描、后台写回或无授权追踪",
  },
  {
    key: "read-only-api",
    title: "只读 API",
    level: "L2",
    permissionSummary: "最小 OAuth/API scope、加密凭据、trace 和撤销路径必须齐备。",
    dryRunEvidence: "MOCK authMode fixture + connector tests + public-release guard",
    readOnlyStatus: "仅 read-only ingest；写回/外发需要单独 owner 审批链",
    failurePosture: "token 失效、回调 mismatch 或 scope 缺失时显式降级",
    forbiddenAction: "禁止把连接成功描述成写回、外发、审批或部署授权",
  },
];

const enResourceAccessCatalog: ResourceAccessCatalogItem[] = [
  {
    key: "crm",
    title: "CRM / tickets",
    level: "L1",
    permissionSummary: "Start from snapshots or redacted exports; L2 reads stage, owner, time, and evidence aliases only.",
    dryRunEvidence: "crm_snapshot fixture + HSI eval + review packet",
    readOnlyStatus: "Real OAuth requires a passing dry-run record first",
    failurePosture: "Auth failure, rate limits, or empty results show a banner and degrade",
    forbiddenAction: "No automatic CRM stage write, owner assignment, or official commitment",
  },
  {
    key: "mail-chat",
    title: "Email / IM",
    level: "L1",
    permissionSummary: "Start from digests; L2 reads thread summaries and evidence aliases, not full private originals by default.",
    dryRunEvidence: "email_digest / chat_digest ledger quality report",
    readOnlyStatus: "Read-only ingest prepares a review packet and never sends",
    failurePosture: "Permission ambiguity or raw private data is quarantined",
    forbiddenAction: "No auto-reply, external send, or official memory promotion",
  },
  {
    key: "meeting",
    title: "Meetings / workshops",
    level: "L0",
    permissionSummary: "Prefer human summary or redacted notes; real-time recording is not the default premise.",
    dryRunEvidence: "meeting_summary ledger + customer materials request",
    readOnlyStatus: "Only commitment, risk, owner, and gap candidates are prepared",
    failurePosture: "Missing reviewer or evidence produces an evidence request only",
    forbiddenAction: "No meeting summary becomes customer commitment or official memory automatically",
  },
  {
    key: "sheet",
    title: "Spreadsheet / BI export",
    level: "L1",
    permissionSummary: "Accept alias-only or redacted rows only; raw sheets stay out of public paths.",
    dryRunEvidence: "redacted_sheet -> HSI fixture -> signal-quality report",
    readOnlyStatus: "Fixture candidate only; not production freshness proof",
    failurePosture: "Private fields, emails, URLs, or tokens are rejected or quarantined",
    forbiddenAction: "No raw sheet commit and no customer deployment receipt claim",
  },
  {
    key: "business-system",
    title: "Business web system",
    level: "L0",
    permissionSummary: "Read explicit data-helm-* markers or collect() payloads only.",
    dryRunEvidence: "marked_dom example + local signal ledger",
    readOnlyStatus: "Local ledger first; no hosted ingest endpoint",
    failurePosture: "Unmarked DOM text is not collected",
    forbiddenAction: "No full-page scraping, background writeback, or unauthorized tracking",
  },
  {
    key: "read-only-api",
    title: "Read-only API",
    level: "L2",
    permissionSummary: "Minimum OAuth/API scope, encrypted credential storage, trace, and revocation path are required.",
    dryRunEvidence: "MOCK authMode fixture + connector tests + public-release guard",
    readOnlyStatus: "Read-only ingest only; writeback/send needs a separate owner approval chain",
    failurePosture: "Expired token, callback mismatch, or missing scope degrades visibly",
    forbiddenAction: "No connected state implies writeback, external send, approval, or deployment authorization",
  },
];

const zhProofPackageFiles: ProofPackageFile[] = [
  { file: "MANIFEST.json", purpose: "记录 evalCommand、生成文件和 public-safe proof package 边界" },
  { file: "customer-materials.md", purpose: "给客户的最小脱敏材料请求底稿" },
  { file: "signal-quality-report.md", purpose: "离线 ledger-vs-golden 质量评估" },
  { file: "hsi-fixture.json", purpose: "可运行 HSI eval 的 fixture candidate" },
  { file: "review-packet.md", purpose: "只读、复核优先的证据 / 风险 / 下一步包" },
];

const enProofPackageFiles: ProofPackageFile[] = [
  { file: "MANIFEST.json", purpose: "Records evalCommand, generated files, and public-safe proof package boundary" },
  { file: "customer-materials.md", purpose: "Minimum redacted customer materials request draft" },
  { file: "signal-quality-report.md", purpose: "Offline ledger-vs-golden quality evaluation" },
  { file: "hsi-fixture.json", purpose: "Fixture candidate for HSI eval" },
  { file: "review-packet.md", purpose: "Read-only, review-first evidence / risk / next-step packet" },
];

function english(localeOrFlag: DataIntakeLocale | boolean) {
  return localeOrFlag === true || localeOrFlag === "en-US";
}

const sourceIntakeOptionKeys = new Set(
  zhSourceIntakeOptions.map((option) => option.key),
);

export function getSourceIntakeOptions(localeOrFlag: DataIntakeLocale | boolean) {
  return english(localeOrFlag) ? enSourceIntakeOptions : zhSourceIntakeOptions;
}

export function isSourceIntakeOptionKey(key: string) {
  return sourceIntakeOptionKeys.has(key);
}

export function formatSourceIntakeLabel(
  key: string,
  localeOrFlag: DataIntakeLocale | boolean,
) {
  return getSourceIntakeOptions(localeOrFlag).find((option) => option.key === key)
    ?.label ?? key;
}

export function getDataIntakeLevels(localeOrFlag: DataIntakeLocale | boolean) {
  return english(localeOrFlag) ? enDataIntakeLevels : zhDataIntakeLevels;
}

export function getResourceAccessCatalog(localeOrFlag: DataIntakeLocale | boolean) {
  return english(localeOrFlag) ? enResourceAccessCatalog : zhResourceAccessCatalog;
}

export function getProofPackageFiles(localeOrFlag: DataIntakeLocale | boolean) {
  return english(localeOrFlag) ? enProofPackageFiles : zhProofPackageFiles;
}
