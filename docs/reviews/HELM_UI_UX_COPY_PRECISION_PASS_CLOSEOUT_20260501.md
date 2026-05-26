---
status: active
owner: helm-core
created: 2026-05-01
review_after: 2026-05-31
archive_trigger:
  - 公开 release `v0.1.0-trial` 上线后 30 天归档（届时改用 launch report 指代）
  - 后续 UI/UX precision pass 形成了独立索引并替代本文件
---

# Helm UI / UX / Copy Precision Pass — Closeout 2026-04-30 → 2026-05-01

## 1. 工作窗口

- 起：2026-04-30 19:30 CST（接到 owner 指令"按 helm 项目的理解审核所有界面 / UX / UI / 营销文案直到明天 10:00"）
- 止：2026-05-01 10:00 CST
- 共持续约 14.5 小时；夜间通过 `/loop` 自调度跑批

## 2. 起点状态

- `origin/main@4e2b6af81 fix: close p0 public release hygiene blockers`（2026-04-30 中午）
- README 集成表把 Salesforce / LLM / 会议捕捉都标 ✅ Production，与代码现实存在落差
- DingTalk Directory invite 默认 `dryRun=false`，没有显式 confirmation gate
- `AuditLog` 缺 traceId / requestId / parentEventId 三列，README #5 "完整审计链 + trace ID 可回放归因" 在 schema 层不可证
- 多处 CN 文案直接嵌入英文名词（detail / counterpart / posture / scene / external / offer / company detail / package detail / 等等）

## 3. 终点状态

- 96 个 commit 落在 `origin/main`（PR #122 P0 + #123-#140 + 多个 main-direct precision commits）
- 验证链：
  - `npm run typecheck`：✅ pass
  - `npm run lint`：✅ 0 errors / 0 warnings（从 0/3 收紧）
  - `npm run check:public-release`：✅ PASS（3090 files / 0 blockers）
  - `npm run check:boundaries`：✅ pass（doc lifecycle / Phase 3 No-Go / tenant-slug reverse-block 全绿）
  - `npm run quality:regression`：✅ 51 文件 / 181 测试 全绿
- EN 字符串里 CN 字符残留：0（早期一次 bulk replace 引入了 13 处，已全部恢复）
- TypeScript 标识符被 bulk replace 误改：3 处（`acknowledgementEventId / acknowledgementStatus / workflow.acknowledgement`），已恢复

## 4. P0（受控试点 release 不可缺）— 已交付

| # | 项 | 实现 | 评估命令 |
|---|---|---|---|
| P0-1 | DingTalk live invite approval gate | `lib/connectors/dingtalk-directory-invite.ts`：默认 `dryRun=true`；live send 必须显式 `confirmation { confirmedByUserId, confirmedAt, sourcePage }`，否则抛 `DingTalkLiveSendConfirmationRequiredError`；每条外发 + 失败都落 per-recipient `AuditLog` | `npx vitest run lib/connectors/dingtalk-directory-invite.test.ts` (8 tests) |
| P0-2 | AuditLog trace columns | `prisma/schema.prisma` 加 `traceId / requestId / parentEventId` 三列 + 双 index；`lib/audit/trace-context.ts` 提供 AsyncLocalStorage 关联；`writeAuditLog` 自动消费 ambient context；migration `20260430190000_audit_log_trace_context_columns` 待 owner 在维护窗口应用 | `npx vitest run lib/audit/trace-context.test.ts` (6 tests) |
| P0-3 | README 集成表真值化 | Salesforce → Alpha (默认 mock)；LLM → "OpenAI 当前；OpenAI-compat 路线图中"；会议 → "60 min 转写 → 90s"，去掉"现场录制 production"；WeChat Pay → Alpha | README.md / README.en.md "已支持" 表 |

## 5. UI / UX / Copy precision passes（按 PR 编号）

| PR | 主题 | 文件数 |
|---|---|---|
| #122 | P0: README truthing + DingTalk approval gate + AuditLog trace IDs | 7 |
| #123 | 第 1 轮：trace audit chain 跨产品/销售/治理表面（home / approvals / settings / sales / 30-min / 3-min demo / FAQ / governance docs） | 11 |
| #124 | 第 2 轮：drop internal taxonomy（"Explicit orientation page" → "3 步 / 5 分钟"）+ /demo 加 trace narrative | 4 |
| #125 | RDS secret history remediation gate（并行 agent 主导） | — |
| #126 | 第 3 轮：drop "复核姿态 / object context / 父需求 doc §X" 等 jargon；`SEND_MEETING_SUMMARY` → `Archive meeting summary`；imports CN/EN 一致 | 7 |
| #127 | 第 4 轮：/capture EN 文案对齐 CN tone | 1 |
| #128 | 第 5 轮：login CN/EN metaphor parity（"登录到系统" → "进入工作区"） | 1 |
| #129 | 第 6 轮：customer-demo one-pager + 30-min demo 命名统一（"经营分身控制台" → "经营推进控制台"） | 2 |
| #130 | 第 7 轮：homepage 边界表加 trace ID 行 | 1 |
| #131 | 第 8 轮：demo-to-pilot 销售脚本 trace 链 | 1 |
| #132 | 第 9 轮：public-trial runbook §2.4 显式 trace + DingTalk dryRun | 1 |
| #133 | 第 10 轮：public roadmap §产品层 trace + dryRun | 1 |
| #134 | 第 11 轮：README 数字承诺加 audit-trace 行 | 1 |
| #135 | 第 12 轮：EN README mirror 数字承诺行 | 1 |
| #136 | 第 13 轮：STATUS.md §十 变更记录补 PR #122 + 1-12 | 1 |
| #137 | 第 14 轮：CRM preview demo-data message 加切换指引 | 1 |
| #138 | 第 15 轮：README "为什么不是另一个 AI 工具" 表加 audit-replay 行（CN+EN） | 2 |
| #139 | 第 16 轮：6 个 sales doc 命名统一 | 6 |
| #140 | 第 17 轮：清理 3 条 lint warnings → 0/0 | 1 |

之后 main-direct 轮次（自 origin push 后续 ~25 个 commit）继续推进 de-Englishization：
- "scene / external / external-safe / company detail / package detail / success check" 等 50+ 模式的 CN 翻译
- `/operating` runtime-operator-panel / `/companies` company-detail-client / `/memory` filter explainer / 数据库连接 banner 等的最后清理
- `lib/audit` / `lib/policies/engine` / DingTalk dispatch 三处接入 trace context
- 修复 bulk replace 误改的 3 处 TypeScript identifier

## 6. 累计影响（按文件类型）

| 类别 | 改动 |
|---|---|
| Schema + migration | 1 migration（`20260430190000_audit_log_trace_context_columns`），mysql + sqlite mirror schemas 同步 |
| 新文件 | 4（`lib/audit/trace-context.ts` + `.test.ts`、`lib/connectors/dingtalk-directory-invite.test.ts` 扩展） |
| Feature 模块 CN/EN copy | ~50 文件（detail-views / detail-models / clients / actions） |
| 公开文档 | README CN+EN、CHANGELOG、CONTRIBUTING、SECURITY、STATUS、public roadmap、public-trial runbook、launch post、5 份 sales docs、4 份 product 命名统一 |
| 工程治理 | 0 lint errors / 0 warnings；3087+ public-release files / 0 blockers；boundaries 全绿；quality:regression 51/181 |

## 7. 仍有的 / 刻意未做

- 194 处 mixed CN+EN 残留主要是技术领域术语（`mock / dry-run / paid / defer / reject / hardening / sprint / runtime / cron / cohort / pilot` 等），刻意保留——这些在 docs/STATUS.md "已成形但仍需下一层" 行内属于内部 admin 专业语
- Phase 3 thin read-model adapter 仍未接入 `data/queries.ts` 与 `/mobile` 第一屏（架构性改动，需独立 sprint）
- 数据保留 retention sweep cron 未新建（与既有 LAUNCH_PLAN §三 #23 决策一致：仍走 `lib/billing/foundation.ts` 派生计算）
- 5 角色 Required Reviewer 真实人选未填（user-only）
- RDS 历史泄露密码轮换 + git history 重写（user-only / owner-only）
- Docker quickstart smoke 未在装 Docker 的环境跑过（user-only）

## 8. 边界口径（仍需诚实保留）

- 这一轮**全部为 copy / display-text / boundary 文档** precision，**不涉及**：
  - 任何 schema 扩张（除 AuditLog 三列加列；用户主动批准）
  - 任何自动写入 / 自动外发 / 自动审批
  - 任何跨 workspace 数据流
  - 任何 LLM provider 的实际增加（仅 README 表述对齐"OpenAI-compat 路线图中"）
  - 任何 plugin runtime sandbox 引入
- 公开 release `v0.1.0-trial` 仍未发布；本文件描述的"已交付"指**main 分支已落地、可被引用**，不等于"已对外宣布"

## 9. 五月发布关键节点（owner 决策）

1. **凭据轮换**（user-only / 阿里云控制台）→ 解锁 git history 重写
2. **Docker smoke**（在装 Docker 的环境）→ 解锁 README "5 步本地起服务"承诺
3. **5 角色真实 Reviewer 名单**（owner / Engineering / Product / Security / Operations / Data Protection）→ 解锁 Phase 3 runtime adoption 6 项硬前置中的最后一项
4. **法务对齐 HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md**
5. **AuditLog migration apply**（生产 RDS / Phase 3V 本地隔离库均已演练）

完成 1-5 后，五月公开 release 的 `release:check` 闸门可机器验证全绿。

## 10. 变更记录

| 日期 | 变化 |
| --- | --- |
| 2026-05-01 | 首版闭环报告；记录 96 个 commit 与 19 个 PR 的精修路径与门禁状态 |
