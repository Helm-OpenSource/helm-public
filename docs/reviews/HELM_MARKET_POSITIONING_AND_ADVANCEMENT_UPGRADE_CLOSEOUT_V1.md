---
status: archived
owner: helm-core
created: 2026-04-26
review_after: 2026-10-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Market Positioning And Business Advancement Upgrade Closeout V1

更新时间：2026-04-26
状态：Phase A documentation slice 关闭（仅文档与上下文层；未触发 runtime / scripts / schema / API / page 改造）
基线提交：`origin/main@208ed1b5c fix: restore continuity runtime review surfaces`
实施工作树 / 分支：`/Users/tommyqian/Documents/GitHub/helm2026-market-positioning-upgrade`（branch `codex/market-positioning-upgrade`）

本报告对本轮 Helm 市场定位收口与 Business Advancement 下一阶段队列固定切片做关闭说明。本切片定位为 documentation/context-only，不批准 runtime/schema/API/page 改造，关闭以本文件为准。

---

## 一、范围

本切片只修改 `docs/context/positioning` 类工件，未修改 runtime TypeScript 代码、scripts、Prisma schema、API route、page 行为或任何不相关的历史段落。

本切片不批准也未发生：

1. runtime extractor 接入。
2. Prisma schema、新表、新列、新 enum 值变更。
3. API route 行为或 service-layer 行为变更。
4. page / mobile-command-read-model / `/operating` / `/dashboard` / `/inbox` / `/approvals` / `/opportunities` / customer success queue 等 production page 行为变更。
5. 自动执行、自动发送、自动审批、自动结算、自动写回、跨 workspace 检索。
6. `SkillSuggestion -> formal skill` 自动晋升。

---

## 二、文件变更清单

本切片实际修改 / 新增的文件：

1. `README.md` — 顶部一句话定位收口为「经营推进控制台 / 经营推进操作系统（受控试点）」，并指向新的产品文档。
2. `WORKING-CONTEXT.md` — 重写为当前路径、日期、Mobile Command Surface 已实现、最近一次本地完整验证、residual risk 与下一阶段优先级。
3. `PLANS.md` — 仅在顶部新增本轮市场定位升级与 Business Advancement 下一阶段切片，未广义改写历史 sprint 段。
4. `docs/README.md` — 在 product/strategy 段加入新产品文档索引，并在 Business Advancement review/report 段加入本关闭报告索引（本变更）。
5. `docs/product/HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md` — 新建：市场定位结论、竞争边界、当前仓库现实、Helm 状态四类短表、Phase 1A / 1B / 2 / 3 队列、成功度量、No-Go 条件。
6. `docs/reviews/HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_CLOSEOUT_V1.md` — 新建：本关闭报告。

无 runtime、scripts、schema、API、page、test 文件变更。

---

## 三、产品结论

Helm 是面向受控试点经营团队的**经营推进控制台 / 经营推进操作系统（受控试点）**（business advancement command surface for controlled trials）。

它持续识别必须推进的事项，给出证据、边界与复核承接入口，把会议、CRM、资源状态与 Ask Helm 等经营输入转化为 Must Push、Review Action 与组织级经营记忆。

Helm **不是**：

1. 完整 enterprise multi-org / SSO / SCIM 平台。
2. 完整 workflow / orchestration / agent platform。
3. 完整 CRM / ERP / 项目管理 / BI 替代品。
4. 通用 chat 产品（Ask Helm 不持久化多轮聊天历史，必须收口到对象 / 页面 / Review Action / Must Push）。
5. 完整自动执行 / 自动发送 / 自动结算平面。
6. marketplace / public partner discovery / app store。

完整定位、竞争边界、四类短表与 No-Go 条件以 [HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md](../product/HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md) 为准。

---

## 四、采纳的当前仓库现实

本切片在文档层把以下事实固定为当前主干 truth，未来的切片不应再回退到与之冲突的旧表达：

1. **Mobile Command Surface 已实现**：`/mobile` 第一屏已经把 Ask Helm mobile answer、Must Push 必须推进项与 Review / Memory / Operating 承接入口收在同一张窄手机端经营推进入口。
2. **上一切片的本地完整验证已通过**：在 Mobile Command Surface 实现切片之后已完成 isolated full-validation 跑批（`db:reset`、targeted continuity E2E、`check:boundaries`、`typecheck`、`test` 2667 用例、`build`、`quality:regression` 181 用例、`e2e` 34 用例全部通过）。本关闭报告引用这一基线，但不在本切片内重跑这一全链路。
3. **DB-backed E2E blocker 历史化 / 已 unblocked**：旧版本里关于 DB-backed E2E 被 `rm-shuyao-dev-pub.mysql.rds.aliyuncs.com:3306` 不可达阻断的描述按「历史 / 已 unblocked」处理，不再代表当前主干 blocker。
4. **MySQL 1020 concurrency warning 仍是 hardening 残留**：在前一切片 E2E 跑批期间出现于 `dailyUsageSnapshot`、`recommendationLog`、`membership` 周边；最终 assertion 通过，但 hardening 未关闭，不能因为 assertion 通过就视为已解决。

---

## 五、Phase 队列（已固定）

下一阶段队列保持 planning + 受控 read-model + offline / synthetic / redacted snapshot 姿态，不批准 runtime extractor、schema 扩张、official write、自动执行、自动发送、page 行为变更或 production query adoption。

1. **Phase 1A — contract + fixtures + offline eval**：维持 `AdvancementSignal / AdvancementJudgement / MustPushItem / ReviewRequiredAction / MemoryCandidate / SkillSuggestion` 的 conceptual planning contract、20 条 fixture pack 与 offline eval 脚本；不允许落为 Prisma schema / API / event queue，不允许 fixture/eval 引入真实 DB，不允许 runtime extractor。
2. **Phase 1B — read-model adapter feasibility**：维持 6 current / 9 thin / 5 future feasibility matrix；只读姿态；不允许接入 production read model，不允许新增 read-model 文件或 mobile-command-read-model 分支，不允许 schema 字段或 derived column。
3. **Phase 2 — Signal -> Must Push Adapter**：仅 planning + offline + synthetic；维持 deterministic ranking、boundary distinctions、review-required 深链、active / deferred 划分；继续禁止 LLM 做最终排序；Phase 3O real-data calibration 合同 + Phase 3P redacted snapshot collector 仅在显式 redacted live DB snapshot 提交时运行评估，默认 No-Go；不允许接入任何 production page 行为，不允许在缺少 redacted live DB calibration 时宣布 runtime adoption，不允许引入 schema / API / Prisma 列 / official write route / 自动执行权。
4. **Phase 3 — Ask Helm Asset Capture**：仅 planning + read-first + reviewable candidate；让 candidate 在 Ask Helm 入口以 read-first 形式出现，并落到 `MemoryCandidate / SkillSuggestion`；不持久化多轮聊天历史；`SkillSuggestion` 不自动晋升为 formal skill，不获得 execution authority；不允许直接外发 / 写入正式系统 / 跨 workspace 检索；不允许引入 schema 或 production query。

显式贯穿所有 Phase 的 No-Go：

1. runtime adoption（runtime extractor、production query adoption、official write route、page 行为变更）。
2. schema 扩张（Prisma schema、新表、新列、新 enum 值变更）。
3. 自动执行 / 自动发送 / 自动审批 / 自动付款 / 自动结算。
4. 完整 workflow / orchestration / agent platform、CRM、BI、chat platform。
5. 跨 workspace / 跨 tenant 聚合、Helm reserved tenant 信息暴露给普通租户。
6. 把 candidate capability 升级为 execution authority。

---

## 六、本关闭实际跑过的验证

本切片在关闭前显式跑通的验证命令：

1. `git diff --check` — **通过**（exit 0；本切片所有文档变更均无 whitespace / conflict marker 类问题）。
2. `npm run check:boundaries` — **通过**（exit 0；所有 boundary 测试 PASS）。
3. `npm run self-check` — **通过**（Total 18 / Passed 18 / Failed 0；exit 0）。

附加事项：

- 本切片在此独立 worktree 启动时 `node_modules` 缺失，因此先跑了 `npm ci` 以恢复依赖。`npm ci` 报告 **2 moderate severity npm audit vulnerabilities**；本切片为纯文档/上下文层切片，**未升级任何依赖**，由后续 hardening 切片处理。
- 没有触动 `package.json` / `package-lock.json` / `npm` 依赖；`npm ci` 仅是恢复 `node_modules` 以便后续在本工作树跑 `check:boundaries` 与 `self-check`。

---

## 七、本关闭显式没跑的验证

本切片不修改 TS runtime / scripts / Prisma schema / API / page / test，因此以下命令在本切片内**未重新执行**：

1. `npm run typecheck`
2. `npm run lint`
3. `npm run test`
4. `npm run build`
5. `npm run e2e`
6. `npm run quality:regression`
7. `npm run db:reset`

引用基线：上一 Mobile Command Surface 实现切片之后的 isolated full-validation 已经一次性跑通这一全链路（见 [WORKING-CONTEXT.md](../../WORKING-CONTEXT.md) §6 与 [HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md](../product/HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md) §3.2）。本关闭报告**仅引用**这一基线，不**视作**本切片重跑通过。

理由：本切片只改文档与上下文层（README.md、WORKING-CONTEXT.md、PLANS.md、docs/README.md、新增 product 文档与本关闭报告），未改变任何会被 typecheck / lint / test / build / e2e / quality:regression 实际加载或执行的文件。重跑这一链路对本切片不会产生新信息，并会耗费不属于本切片范围的 isolated DB 资源。

---

## 八、剩余风险

1. **MySQL 1020 concurrency warning trace** 在 `dailyUsageSnapshot` / `recommendationLog` / `membership` 周边仍存在；属于 hardening 残留项，需要单独切片处理。
2. **plugin runtime sandbox 缺位**；narrow adapter 边界继续保持。
3. **future-real auth** 仍是受控试点级，不是完整生产级 enterprise SSO / SCIM。
4. **broad auto-write / auto-send / auto-execution 仍未授权**；任何越权写入或发送仍属硬边界违规。
5. **Business Advancement Phase 3 系列 runtime adoption 维持 No-Go**：在缺少 redacted live DB calibration 证据前，Phase 3O / 3P 链路不进入 production query / page 行为。
6. **shared `helm2026` DB 旧 failed migration / view-base-table blocker 仍存在**；属于独立 migration-state repair 任务。
7. **2 moderate npm audit vulnerabilities**：本切片未升级依赖；后续 hardening 切片应评估升级路径。
8. **customer-facing wording drift**：必须持续把 recommendation / proposal / proactive 与 commitment / send / settlement 区分清楚；任何 PR 把判断面写成承诺面应触发 No-Go。

---

## 九、下一步

下一可承接切片应在 Phase 1A / 1B / 2 / 3 队列范围内推进 documentation + planning，且优先：

1. 在 Phase 1A 现有 contract + fixtures + offline eval 之上做 documentation refresh，把 Phase 2B / 2C 的 thin projection 证据更新到 planning artifact 层。
2. 在缺少 redacted live DB snapshot 时维持 Phase 3O / 3P No-Go；只有在显式提交 redacted live DB snapshot 时才依序运行 Phase 3P collector → 3Q intake → 3R preflight → 3S packet。
3. 单独切片处理 MySQL 1020 concurrency warning hardening 与 npm audit moderate vulnerabilities，**不要**与本轮市场定位 / Phase 队列固定切片合并。
4. 对 `README.md` / 公开站文案 / 销售素材的 wording 漂移做一次例行扫描，确保不再回退到「AI 经营协同操作系统」「全员 AI 操作系统」「企业 AI 操作系统」「自动执行的 AI 员工平台」类旧表达。

---

## 十、关闭判断

本切片满足以下条件，故关闭：

1. 新增 `docs/product/HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md` 已落地，并被 `docs/README.md` product/strategy 段引用。
2. `WORKING-CONTEXT.md` 已重写为当前路径、日期、Mobile Command Surface 已实现、最近一次完整验证、residual risk 与下一阶段优先级。
3. `PLANS.md` 顶部已新增本轮切片，未广义改写历史 sprint 段；§8 验证状态已按本切片实际通过的命令（`git diff --check` / `npm run check:boundaries` / `npm run self-check`）更新；`npm run typecheck` 维持「optional / 本切片不要求」。
4. `README.md` 已做最小化 wording 调整，与新定位口径一致。
5. 本关闭报告已写入 `docs/reviews/`，并在 `docs/README.md` Business Advancement review/report 段加入索引。
6. 本切片 explicit 跑通的命令为 `git diff --check` / `npm run check:boundaries` / `npm run self-check`；未跑命令在 §七 显式列出并说明理由；上一切片完整验证基线在 §四与 WORKING-CONTEXT.md §6 引用。
