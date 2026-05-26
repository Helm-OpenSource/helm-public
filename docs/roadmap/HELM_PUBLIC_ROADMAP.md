---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Public Roadmap

更新时间：2026-05-02
当前版本目标：`v0.1.0-trial`（受控试点 / Controlled Trial）
适用读者：外部贡献者、潜在试用用户、关注 Helm 演进路径的同行

---

## 我们是什么

Helm 是一套面向受控试点的**经营推进控制台**。它把会议、邮箱、CRM 与企业内部信号收敛成统一推进链，给团队和 AI 员工提供必须推进项、证据链与正式复核入口。

> Helm 当前**不是**完整企业平台，**不是**自动执行系统，**不**自动对外发送或承诺。

详细产品边界见 [README.md](../../README.md) 与 [AGENTS.md](../../AGENTS.md)。

---

## 路线图原则

我们刻意维持 4 条边界：

1. **判断 ≠ 承诺**：Helm 给出推荐与证据，正式行动必须由人复核
2. **受控试点 ≠ 平台**：不演进为完整企业 multi-org / multi-tenant 平台
3. **Read-first / Review-first**：默认无 broad auto-write、auto-send、auto-execution
4. **诚实降级**：任何能力没在四个层面（代码、页面、测试、文档）同时成立，一律标记为「已成形但仍需下一层」

**任何超出上述边界的方向，路线图上一律列在「Out of scope」。**

---

## Now（截至 2026-04-27 已落地或正在落地）

下列条目**已在 main 分支**，但仍在 `v0.1.0-trial` 之前的整合期：

### 产品层

- **Mobile Command Surface（`/mobile`）**：当前 workspace 的窄手机端经营推进入口，第一屏整合 Ask Helm 移动答案 / Must Push / Review / Memory / Operating
- **Operating console（`/operating`）**：判断 / 决策 / 边界三层组织的经营推进主表面
- **Approvals（`/approvals`）**：审批承接面，明确建议与承诺边界
- **Memory（`/memory`）**：经营记忆，事实 / 行动二级提升，review-first 写入
- **Ask Helm（`/search?mode=ask`）**：行动意图入口，可回答、计划分解、准备草稿、生成内部 handoff（不发送、不承诺）
- **Setup / Onboarding（`/setup`）**：受控试点 onboarding，含数据政策同意
- **审计 trace 基础层**：`AuditLog` 关键写路径强制带 `traceId / requestId / parentEventId` 三列；统一用户可见 trace timeline 仍是 release hard gate，未落地前不宣传“0 秒可回放”；DingTalk Directory 邀请等 connector 默认 dryRun，必须显式确认才能 live send

### 工程与发布

- License = Apache-2.0（`LICENSE` / `NOTICE` / `package.json` 已落地）
- 治理文档套：CONTRIBUTING / SECURITY / CODE_OF_CONDUCT / CHANGELOG
- README 重写控制在 ≤300 行
- `Dockerfile` + `docker-compose.yml`：`git clone && docker compose up` → `:3000/mobile`
- `.env.example` 三档分层（MUST / OPTIONAL_AI / OPTIONAL_CONNECTORS）+ `validate-env` 分级校验
- 公开发布守卫 `npm run check:public-release`：tenant slug / 私有路径 / 内部 host / URL-embedded credential 四类规则，excerpt 输出经过 secret masking
- 共享层租户脱敏完成（`extensions/<tenant>/*` 私有根 + `lib/extensions/registry.tsx` 单一 seam）

### 治理与合规

- 公开试用数据政策草案：30 天 active + 7 天 grace 仅是待法务最终确认的目标口径；正式口径以工作区契约和生效数据政策为准（草案见 [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)）
- Phase 3 runtime adoption 受限解禁评审框架（仅 TPQR-001 / TPQR-003 / TPQR-004 thin read-model adapter）
- 5 角色 Required Reviewer 候选名单框架（[HELM_PHASE3_REQUIRED_REVIEWER_CANDIDATE_FRAMEWORK_V1.md](../reviews/HELM_PHASE3_REQUIRED_REVIEWER_CANDIDATE_FRAMEWORK_V1.md)）

---

## Next 30 days（2026-04-28 → 2026-05-31，五月 launch 窗口）

按 [HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md](../product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md) 五周分解的可对外披露条目：

### 即将上线

- **`/mobile` 第一屏 Must Push 切换数据源**：从 read-first 压缩 → thin read-model adapter，feature flag 控制
- **Ask Helm asset capture 落地**：写入 `MemoryCandidate` / `SkillSuggestion`，review-first，**无**多轮聊天历史持久化
- **数据保留状态卡片**：`settings/billing` 加「数据保留状态」+ 自助导出按钮（不新增 retention sweep cron / API；阶段转换由请求路径派生）
- **删除证明邮件**：阶段转换前 7 天 / 1 天通过阿里云 DirectMail 通知 workspace owner
- **公开试用注册流**：`/setup?onboarding=trial` 加数据政策同意 checkbox；`OPENAI_API_KEY` 留空时 Ask Helm 给 deterministic placeholder + banner

### 即将开始

- **云端公开试用**（阿里云 cn-hangzhou）：受控试点，**不承诺 SLA**；Pilot allowlist 选 1-2 早期用户首批解禁
- **Release hard gates**：RDS 凭据轮换 + history remediation、on-call / response policy、公开承诺降级、audit trace 公开口径安全，均必须在公开 launch 前完成
- **Design partner P0**：Week 5 前优先拿到第一个 ≥¥30k design partner 或明确 No-Go；没有真实客户信号时，Phase 3 / Pack A 只保留准备态
- **内部 Dogfooding**：Helm 团队 reserved tenant workspace 打开 flag 跑一周，监测 Must Push 命中率
- **Rollback 演练**：故意触发 invariant violation，验证 adapter 降级到 read-first
- **第三次（最终）Required Reviewer 评审**：approve `BUSINESS_ADVANCEMENT_RUNTIME_ENABLED=true` 进入 allowlist
- **`v0.1.0-trial` release**：GitHub repo public + 试用注册页 + launch post（中英双版）+ 90 秒 Mobile Command Surface 演示视频

### 关键依赖与不在我们手里的事

- 阿里云 cn-hangzhou 全栈环境就绪（RDS MySQL / ECS / OSS / SLS / DirectMail）
- 5 角色 Required Reviewer 实际人选确认（Engineering Lead / Product Owner / Security Reviewer / Operations Lead / Data Protection Officer）
- redacted live DB calibration 跑批（依赖 dev/staging RDS 访问窗口）

---

## Later（2026-Q3 起，方向性叙述，未承诺时间）

下列方向**有意推迟**到 v0.1.0-trial 之后，按真实使用反馈再决定优先级与是否做：

- **Plugin runtime sandbox**：当前缺位是已知边界。现有 `lib/extensions/registry.tsx` 只作为 first-party / private tenant extension seam；是否做真正第三方 sandbox，取决于真实租户扩展场景
- **完整生产级 SSO / SCIM**：当前数据库支持的会话足够受控试点；进入企业窗口前再评估
- **跨 workspace 聚合**：当前 No-Go。如有真实场景再走独立 Required Reviewer approval
- **多轮聊天历史持久化**（Ask Helm）：当前 No-Go，不做 chat-first 产品形态
- **BI 平台扩展**：BI report skill 是 read-first 信号读板，不演进为通用 BI 平台
- **国际市场全栈**：当前有阿里云 cn-hangzhou + Stripe 全球结算两个 rail，但不主动扩展到欧美数据驻留 / GDPR 完整审计

---

## Out of scope（明确不做）

下列方向**不在 Helm 路线图上**，不接受相关贡献：

- **完整 workflow / orchestration / agent 编排引擎**
- **完整 BI 平台 / 报表中心**
- **自动执行平面**：自动审批、自动结算、自动对外发送、自动承诺、自动跨 workspace 决策
- **Plugin marketplace / app store**
- **通用聊天产品 / 通用 CRM / 通用 ERP / 通用项目管理**
- **LLM 做最终排序的承诺路径**：Helm 内部使用 LLM 做解释、起草、briefing；但「该不该推进、谁来推进、在什么边界内推进」不交给 LLM 做最终排序
- **自动晋升 SkillSuggestionCandidate**：候选必须经人工 review 才能进入 catalog
- **schema 扩张**：当前阶段不接受为新功能扩张 Prisma schema；优先在现有列上做 review-first 写入

---

## 我们的发布节奏

| Release | 时间 | 含义 |
| --- | --- | --- |
| `v0.1.0-trial` | 2026-05-31 目标 | 公开试用首版；受控试点姿态；GitHub repo public；不承诺 SLA |
| `v0.1.x` | 试点反馈窗口 | bug 修复 + 数据保留 / 邮件提醒 / dogfooding 闭环 |
| `v0.2` | 待评估 | 取决于试用反馈与 Phase 3 thin read-model adapter 全量解禁条件 |

我们**不预承诺** v0.2 时间或内容。如果试用窗口反馈显示 v0.1 的边界仍需收紧，v0.2 可能比预期更晚。

---

## 想贡献什么

- **Bug 修复 + 测试**：尤其覆盖 `lib/presentation/` 回归与 `tests/e2e/`
- **文档修订**：术语统一、过时描述、中英双版同步
- **本地化**：现有英文 / 简体中文双语之外的语言版本
- **只读连接器**：在不破坏 read-first / review-first 边界的前提下扩展只读连接器
- **可访问性**：键盘导航、对比度、ARIA 改进

详见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

会改 schema、引入自动写入 / 自动发送、扩展 sandbox / marketplace / orchestration 平台能力的方向，请先开 issue 讨论。

---

## 安全相关

请勿在公开 issue 或 PR 中披露未公开的安全漏洞。私下渠道见 [SECURITY.md](../../SECURITY.md)。

---

## 反馈

公开试用启动后，反馈渠道见 [PUBLIC_TRIAL_RUNBOOK.md](../pilot/PUBLIC_TRIAL_RUNBOOK.md)（待发布）。

在此之前，欢迎通过 GitHub issue 提出与上述路线图相关的讨论。
