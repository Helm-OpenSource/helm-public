> **语言 / Language**：**中文** · [English](CHANGELOG.en.md)

# Changelog

本文件记录 Helm 仓库面向外部读者的可观察变更。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

Helm 当前处于受控试点阶段，公开 release 仍在 `v0.1.0-trial` 之前。`Unreleased` 段记录已经在 `main` 落地、但未发布的变更。

---

## [Unreleased]

### Added

- **AuditLog 强制 trace 链路（README #5 兑现）**：`AuditLog` 增加 `traceId / requestId / parentEventId` 三列与 `(workspaceId, traceId)` / `(workspaceId, requestId)` 索引；新 `lib/audit/trace-context.ts` 用 AsyncLocalStorage 提供 request-scoped 关联 ID；`writeAuditLog` 自动消费 ambient context；migration `20260430190000_audit_log_trace_context_columns`
- **Ask Helm 证据化行动包**：`/search?mode=ask` 对计划分解、草稿准备、复核材料包、内部跟进、交接和执行类需求新增只读 action packet，展示 evidence refs、risks、missing info、review checklist 和 next surface；新增 `eval:ask-helm-action-packet` 并接入 `eval:ask-helm`，继续不授权自动外发、自动审批、自动执行或 official write
- **DingTalk Directory invite 复核闸门**：`syncAndInviteDingTalkDirectory` 默认 `dryRun: true`；live send 必须显式传 `confirmation: { confirmedByUserId, confirmedAt, sourcePage }`，否则抛 `DingTalkLiveSendConfirmationRequiredError` 在 DB / 网络调用前 fail-fast；每个真实外发 + 失败都落 per-recipient `AuditLog` 行
- License 决策落地：`LICENSE`、`NOTICE` 与 `package.json` 的 `"license": "Apache-2.0"` 字段
- 五月开源 + 云端公开试用 launch plan：[docs/product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md](docs/product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md)
- 公开试用数据政策（30 天 active + 7 天 grace + 阿里云 sub-processor 实名）：[docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)
- Phase 3 runtime adoption 受限解禁评审文档：[docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md](docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md)
- `scripts/public-release-guard.ts` 与 `npm run check:public-release`：公开发布前的关键文件存在性、租户 slug / 内部 host / URL-embedded credential 检测，excerpt 输出经过 secret masking
- `scripts/decision-first-boundary-check.ts` 新增 tenant-slug 反向边界检查：阻止公开层引入特定租户 slug 引用
- `scripts/business-advancement-phase3p-redacted-snapshot-collector.ts` 与 `external-resource-kit` dry-run evaluator scaffold（带 synthetic demo）
- 治理文档套：`CONTRIBUTING.md`、`SECURITY.md`、`CODE_OF_CONDUCT.md`、`CHANGELOG.md`
- `docker-compose.yml` + `Dockerfile` + `.dockerignore`：`git clone && docker compose up` 起 MySQL 8.4 + Node 22 应用栈，访问 `/mobile`
- `.env.example` 分层为 `MUST` / `OPTIONAL_AI` / `OPTIONAL_CONNECTORS`，`scripts/validate-env.ts` 实现分级校验
- `lib/extensions/registry.tsx`：唯一允许 compile-time 引用 `@/extensions/<tenant>/*` 的 shared-layer seam；导出 `resolveReportsExtensions` / `resolveImportsExtensions` / `resolveApprovalsExtensions`，让共享路由不再直接 import 租户扩展
- Public-release-guard 新增 `credential:url-embedded` 规则与 `maskSecrets()` excerpt 脱敏；`PRIVATE_FILES` 标记 `docs/HELM_INTERNAL_FREEZE_REFERENCE.md` 为内部专属；`POLICY_DESCRIPTOR_PREFIX_ALLOW_LIST` 让历史/closeout/requirements docs 免扫但 credential 规则依旧全局
- `BI_REPORT_ODPS_KNOWLEDGE_PATH` env var：`lib/bi-report-skill/odps-knowledge.ts` 路径配置化，租户专属 knowledge 文件在 `extensions/<tenant>/` 内通过 env 注入
- Phase 3 Required Reviewer 候选名单**框架**：[docs/reviews/HELM_PHASE3_REQUIRED_REVIEWER_CANDIDATE_FRAMEWORK_V1.md](docs/reviews/HELM_PHASE3_REQUIRED_REVIEWER_CANDIDATE_FRAMEWORK_V1.md)。5 个 canonical role 各自必备 / 优先加分 / 否决条件 / 时间承诺四档，互斥规则，conflict-of-interest 自检清单，3 次会议节奏与 audit event 钩子。具体 candidate 人名 owner 待填入
- 公开路线图：[docs/roadmap/HELM_PUBLIC_ROADMAP.md](docs/roadmap/HELM_PUBLIC_ROADMAP.md)（Now / Next 30 days / Later / Out of scope）；公开试用 runbook：[docs/pilot/PUBLIC_TRIAL_RUNBOOK.md](docs/pilot/PUBLIC_TRIAL_RUNBOOK.md)
- 数据保留状态卡片设计：[docs/product/HELM_RETENTION_STATUS_CARD_DESIGN_V1.md](docs/product/HELM_RETENTION_STATUS_CARD_DESIGN_V1.md)（4 阶段视图 / 组件契约 / server actions / 状态机 / 验证 checklist；不引入新 cron / API）
- DirectMail 提醒模板：[docs/product/HELM_RETENTION_REMINDER_EMAIL_TEMPLATES_V1.md](docs/product/HELM_RETENTION_REMINDER_EMAIL_TEMPLATES_V1.md)（4 模板 × 中英双版：T-7 / T-1 active→grace / T-1 grace→deletion / 删除证明；幂等 key、调度硬约束、防误发、audit 对应）
- Phase 3 runtime adoption 工程层 scaffold（disabled-by-default，不激活 production query 路径）：
  - [`lib/feature-flags.ts`](lib/feature-flags.ts) — env-driven `BUSINESS_ADVANCEMENT_RUNTIME_ENABLED` + `BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST`，默认 disabled
  - [`lib/business-advancement/invariant-guards.ts`](lib/business-advancement/invariant-guards.ts) — 5 个 invariant guards：commitment overdueFlag 只读、deterministic ranking source、单 workspace scope、TPQR id 范围、no official-write intent；专用 `BusinessAdvancementInvariantViolationError`
  - [`lib/business-advancement/evidence-chain-audit.ts`](lib/business-advancement/evidence-chain-audit.ts) — `persistAdvancementJudgementEvidenceChain` 写到 `AuditLog.payload` JSON 列（无 schema 改动）；`actionType=ADVANCEMENT_JUDGEMENT_EVIDENCE_CHAIN_PERSISTED`
  - [`features/business-advancement/runtime/thin-read-model-adapter.ts`](features/business-advancement/runtime/thin-read-model-adapter.ts) — gated stub；`...WithFallback` helper 让 caller 优雅降级到 read-first
  - [`features/business-advancement/runtime/ask-helm-asset-capture.ts`](features/business-advancement/runtime/ask-helm-asset-capture.ts) — Ask Helm 候选写入 scaffold；`assertNoChatHistoryInPayload` 拒绝 7 个 raw conversation key
  - `features/mobile/lib/mobile-command-read-model.ts` 在 6 source 聚合前插入 Phase 3 probe；flag off → 沿用 read-first（行为不变），invariant violation 上抛到路由边界
- Boundary check 新增 6 条 Phase 3 静态规则与 invariant guards 配对：`phase3_runtime_no_tpqr_002_or_005_in_shared_layer` / `..._no_official_write_intent_in_adapter_call_sites` / `..._no_llm_final_ranking_source` / `..._no_cross_workspace_aggregation_in_advancement_path` / `..._no_skill_suggestion_auto_promotion` / `..._ask_helm_no_chat_history_persistence`；总数 194 → 200
- Agentic Governance P0/P1 gate 与 `/settings` 只读 readout：external agent outcome / trace、connector permission summary、messaging rewrite guard、back-office signal guard 与 safe artifact reason-code expansion 进入 offline eval；`/settings?tab=connectors` 展示 connector data scope、auto / review / never 三轨、credential / sync posture 和 boundary note，继续不提供 permission editor、connector control plane、send/write-back/approve/pay action、runtime adapter 或 provider credential
- public-release-guard 二次硬化（P0 audit findings 后续）：(a) `KNOWN_LEAKED_TOKEN_SHA256` deny list — 已知泄露凭据的 SHA-256（明文不入源），已为 `rm-shuyao-dev-pub` 历史泄露值注入 hash 并通过临时注入 / 移除测试**确认能捕获**；(b) `docs/reviews/` 大豁免拆解为 19 个 explicit 文件 allow-list；(c) bare-token 启发式撤回为 deterministic 防线，避免 PascalCase 类名假阳性；(d) 跳过 `.claude/`、`.codex/`、`generated/` 等本地 / 派生目录与 `.db .node .dylib` 二进制扩展名
- v0.1.0-trial release readiness 闸门：[`scripts/release-readiness-check.ts`](scripts/release-readiness-check.ts) + `npm run release:check`。17 步自动化（FAST 覆盖 `eval:agentic-governance`、`eval:intelligence-growth-boundary-static`、`eval:intelligence-growth-determinism`、`eval:business-advancement-trace-roi`、`eval:gate-consolidation`、`eval:external-agent-intake-p0-req-07`；FULL 额外跑 test / build / quality / e2e）+ 7 个人工 release receipt：`RELEASE_READINESS_CREDENTIAL_ROTATED`、`RELEASE_READINESS_SECRET_HISTORY_REMEDIATED`、`RELEASE_READINESS_DOCKER_SMOKE_PASSED`、`RELEASE_READINESS_ONCALL_RESPONSE_POLICY_READY`、`RELEASE_READINESS_AUDIT_TRACE_PUBLIC_POSTURE`、`RELEASE_READINESS_REVIEWER_APPROVAL_RECORD_ID`、`RELEASE_READINESS_CALIBRATION_REPORT`。任一自动项失败或 receipt 未满足 → exit 1 / NOT READY
- `/mobile` Must Push outcome checkpoint：第一屏展示项默认带结果回收口，Hero 与 supporting card 展示 `dueHint` / `expectedSignal`，并只把 outcome review 暴露为安全内部导航；不新增 API、DB migration、CRM 写回、自动发送、自动审批或结果自动写回。
- `/mobile` Outcome Ledger：从展示项 `outcomeCheckpoint` 派生只读结果回收台账，显示下一条待回收 / 待复核结果信号、顶部 outcome 覆盖数和 no-write 边界；不新增 API、DB migration、外部写回、自动结果确认或客户结果承诺。
- `/mobile` Outcome Review Cue：在 Outcome Ledger 内派生人工复核提示，列出该看什么证据和允许的判断姿态；只准备人工复核，不关闭事项、不确认外部成功、不写回系统。

### Changed

- **二级经营页面客户资产首屏收敛**：`/reports`、`/imports`、`/settings`、`/diagnostics`、`/analytics` 首屏新增/复用 `CustomerAssetFocusStrip`，默认先展示经营资产、当前压力、待判断和下一步路径；说明性摘要、字段说明、就绪度和设置建议下沉到 `引用 / Reference` 折叠层。新增 source guard 与 targeted E2E，继续不改变 schema/API、权限、official write、自动审批、自动执行或外发能力
- **`/health` 公开健康面收敛为 public-safe 姿态**：页面不再公开探测或展示 DB / LLM / provider / connector 采用情况，也不展示租户数据、workspace ID、内部错误、action type 或审计失败明细；新增 `lib/production-health/public-health.ts` 安全投影与测试，self-check 增加 runtime-detail 泄露防回归。`/health` 仍不是 uptime SLA，工作区级健康状态必须登录后查看
- **README 集成表与代码现实对齐**：CRM 表中 Salesforce 标记 Alpha（默认 `authMode=MOCK`，需配置真实 OAuth）；LLM 行明确 OpenAI 是当前唯一注册 provider，OpenAI-compatible / 本地 Gemma 仍在 Roadmap；会议行从「现场录制 · Production」改述为「智能转写 Stable，无原生录制层，用户在第三方会议软件录制后导入」；微信支付标记 Alpha（适配器已落，生产前需运维确认密钥与回调）
- **`/approvals` "Future auto-handling rule" 精修**：disclosure 标题加「(within threshold) / （阈值内）」；body 明示 `AUTO_WITHIN_THRESHOLD` 模式仅作用于内部、可回滚动作，客户可见草稿仍永远等用户点击；CTA 按钮加「内部 · 可回滚」边界标签
- **`/dashboard` 与 `/approvals` / `/settings` 顶层 description copy 精修**：approvals 描述加「每一次都会落一条可回放的审计 trace」；settings 描述加「每次改动都写一条带 trace ID 的审计」
- README 重写：原 244K 内部 freeze 参考迁出至 `docs/HELM_INTERNAL_FREEZE_REFERENCE.md`；新 README 控制在 ≤300 行，面向外部读者
- 公开试用数据保留期对齐为 30 天 active + 7 天 grace + 物理删除（保守可发布路径，与 `lib/billing/foundation.ts` 一致，不做 schema 扩张）
- 共享层租户脱敏完成（Week 2 §三 #11，`check:public-release` 601 → 0 violations）：
  - `app/(workspace)/{imports,reports}/page.tsx` 与 `features/approvals/approvals-client.tsx` 改为只通过 `lib/extensions/registry.tsx` 访问租户扩展
  - `app/api/runtime/bi-report/daily-push/route.ts` 移到 `app/api/extensions/guangpu/bi-report/daily-push/route.ts`
  - `lib/guangpu-seat-profile-extension-key-backfill.{ts,test.ts}` 与 `scripts/backfill-guangpu-seat-profile-extension-key.ts` 移到 `extensions/guangpu/seat-profile/` 私有根；`backfill:guangpu-seat-profile:*` npm script 路径同步更新
  - `lib/bi-report-skill/{metric-engine,run-persistence,run-service,skill-loader,sql-template,schema-validator,odps-knowledge,query-adapters/odps}.test.ts` 8 个 fixture-loading 测试搬到 `extensions/guangpu/bi-report/tests/`
  - LLM `LLMTaskType` 联合 `MIDUN_CASE_ASSIGNMENT*` → `EXTERNAL_CASE_ASSIGNMENT*`；env var `LLM_HTTP_TIMEOUT_MS_MIDUN_CASE_ASSIGNMENT` → `LLM_HTTP_TIMEOUT_MS_EXTERNAL_CASE_ASSIGNMENT`
  - 同一惯例续推：`MIDUN_CASE_ASSIGNMENT_WRITEBACK_ENABLED` / `MIDUN_CASE_ASSIGNMENT_WRITEBACK_CUTOFF_TIME` env var → `EXTERNAL_CASE_ASSIGNMENT_WRITEBACK_*`（2026-05-21 补，原 commit `feba37099` 引入时绕过了 EXTERNAL_* 命名惯例）。改动只触及 `process.env.*` 读取与 `.env.example`，TS 内部常量 / 米盾 endpoint 路径常量名保留 `MIDUN_*`
  - `lib/tenant-resources/*.test.ts` fixture：`provider: "MIDUN"` / `guangpu-seat-profile` / `Guangpu seat profile` → `CASE_SYSTEM` / `acme-seat-profile` / `Acme seat profile`
  - `lib/notifications/system-mail.ts` fallback sender：`helm@zhaojiling.com` → `system@example.com` placeholder（生产由 `ALIYUN_MAIL_SYSTEM_EMAIL` env var 注入）
  - `features/dashboard/home-work-entry*.{ts,tsx,test.ts}` 中 `Midun`/`米盾`/`midun-assignment-action-` → `external case-assignment` / `case-assignment-action-`
  - `features/imports/imports-client.tsx` `midunAccountBinding` prop → `accountBindingSlot: ReactNode` (server-rendered slot)

### Removed

- 公开仓库不再包含 `extensions/guangpu/`、`app/api/extensions/guangpu/` 与租户专属脚本（按 tenant-private 双仓库剥离路径执行；internal-only 维护计划不随 OSS 仓库分发）

### Deprecated

- 旧 `apps/helm-app` / `packages/helm-control` 目录形态：当前主干已确认根目录 `app/` 为 route owner，`data/queries.ts` 为 query aggregation seam

### Security

- 公开试用环境默认关闭 OpenAI API；启用前显式 banner 与二次同意
- 公开试用环境默认关闭支付能力
- `.codex/hooks.json` repo-local guardrails 新增 `console.log/console.error/debugger/TODO: remove before merge` 检查与 `git push --no-verify` 阻断
- **凭据 redaction（P0）**：两份 `docs/reviews/HELM_TENANT_RESOURCE_PHASE_*` review 文档曾在示例命令中包含 `rm-shuyao-dev-pub` MySQL root 真实密码（值不在此处复述）；当前工作树已统一替换为 `:***@`。注意：原值在 git 历史中仍可检索；**该凭据需运维通过阿里云控制台轮换并更新所有内部 secret store**
- public-release-guard 输出对所有匹配行经过 `maskSecrets()` 处理（URL-embedded credentials + 形如 `PASSWORD/SECRET/TOKEN/API_KEY/PRIVATE_KEY` 的赋值），即使是 tenant-slug 等其他规则触发也不会回显原始密码
- guard 跳过 `.env*` 本地文件（gitignored，永不进入公开 mirror）以避免开发者 `.env.local` 在 CI 输出中暴露

### Notes

- Phase 3 runtime adoption 在五月「受限解禁」：仅 TPQR-001 / TPQR-003 / TPQR-004 三条 thin read-model adapter；TPQR-002 / TPQR-005 与 schema 扩张、自动写入、跨 workspace 聚合、SkillSuggestion 自动晋升、Ask Helm 多轮聊天历史持久化继续禁止
- 解禁触发需满足 6 项硬前置 + 5 角色 Required Reviewer approval，详见对应评审文档

---

## 历史

`v0.1.0-trial` 之前的变更未单独发布，主要里程碑通过 git history 与 `docs/HELM_INTERNAL_FREEZE_REFERENCE.md` 追溯。

---

## 维护说明

每次面向外部读者的可观察变更（行为、API、配置、license、治理）应在合并前同步更新本文件 `Unreleased` 段。

变更类别使用以下标准小节：

- `Added`：新增能力
- `Changed`：行为或接口变更
- `Deprecated`：将在未来版本移除的能力
- `Removed`：已移除的能力
- `Fixed`：bug 修复
- `Security`：安全相关
- `Notes`：边界、依赖、未承诺事项的诚实披露

发布 release 时，将 `Unreleased` 段的内容移到对应版本号下，并新建空的 `Unreleased` 段。
