---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Market Positioning And Advancement Upgrade V1

更新时间：2026-04-26
状态：Phase A documentation freeze（仅文档与上下文层）
适用范围：market positioning conclusion、competitive boundary、current repo truth、Helm status buckets、next phase queue
实现状态：未实现（本轮不批准任何 runtime / schema / API / write 改造）

本文件是 Helm 在 `origin/main@208ed1b5c fix: restore continuity runtime review surfaces` 之上的市场定位收口与经营推进下一阶段开工依据。它把 [HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md](./HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md) 的最终结论、[HELM_V2_1_MARKET_POSITIONING_BRIEF.md](./HELM_V2_1_MARKET_POSITIONING_BRIEF.md) 的市场判断、Phase 1A / 1B / 2 / 2B / 2C / 3 各 review 报告的当前姿态，以及 `Mobile Command Surface`、`Business Advancement Phase 3O–3P`、`continuity runtime review surfaces` 的最近验证现实合并成一份对外可引用、对内可执行的定位与下一阶段队列。

本文件不批准：

1. 数据库 schema 改动
2. runtime extractor / event queue / production query adoption
3. official write、自动执行、自动发送、自动审批、自动结算
4. 完整 workflow / orchestration / agent platform
5. 完整 CRM / ERP / 项目管理 / BI / chat 平台
6. 跨 workspace / 跨 tenant 聚合
7. `SkillSuggestion -> formal skill` 自动晋升

---

## 一、定位结论

### 1.1 一句话定位（对外）

```text
Helm is a business advancement command surface for operating teams in controlled trials.
It identifies must-push business matters, shows evidence, boundaries and review entry points,
and turns meeting / CRM / resource / Ask Helm input into Must Push,
Review Action and organizational memory.
```

### 1.2 中文表达（对内 / 对客户）

首选：

```text
Helm 是面向受控试点经营团队的经营推进控制台。
它持续识别必须推进的事项，给出证据、边界和复核承接入口，
把会议、CRM、资源状态与 Ask Helm 等经营输入转化为
Must Push、Review Action 与组织级经营记忆。
```

可替换的中文长表达：

```text
Helm（经营推进操作系统 / 受控试点）：
为经营团队压缩必须推进的事项，
让证据、风险边界和承接入口默认在线，
让经营输入沉淀为可复核的行动与可复用记忆。
```

### 1.3 不再使用的旧表达

以下表达来自更早阶段的对外文案，不应再作为 Helm 的市场定位主表达：

1. 「面向中国市场的 AI 经营协同操作系统」（过宽）
2. 「全员 AI 操作系统」「企业 AI 操作系统」（与 enterprise agent platform、Microsoft Copilot Studio、Salesforce Agentforce 正面冲突）
3. 「自动执行的 AI 员工平台」（违反 review-first 边界）
4. 「企业级 AI workflow / orchestration 平台」（违反 AGENTS.md §13）

如果旧文档仍包含上述表达，应在本轮或后续切片把它们降级为 boundary note、historical note 或在显式市场场景下重写，不再作为产品主表达。

### 1.4 Helm 不是什么

继续诚实保留的边界（与 [AGENTS.md](../../AGENTS.md) §3 / §6 / §13 一致）：

1. 不是完整 enterprise multi-org / multi-role / multi-tenant 平台
2. 不是完整 workflow / orchestration / agent platform
3. 不是完整自动执行平面或自动发送平面
4. 不是通用 chat 产品
5. 不是 CRM / ERP / 项目管理 / BI 替代品
6. 不是 marketplace / app store / public partner discovery 平台
7. 不是完整 finance console / payout execution

---

## 二、竞争差异化

### 2.1 对比矩阵

| 类别 | 代表玩家 | Helm 不做 | Helm 占据的位置 |
| --- | --- | --- | --- |
| Enterprise agent platform | Salesforce Agentforce、ServiceNow AI Platform、Microsoft Copilot Studio | 通用 agent 编排 / 企业 IT 控制塔 | 跨系统识别经营推进信号，把推进项压缩给经营团队复核 |
| Agent infra / SDK | OpenAI Agents SDK、LangGraph、CrewAI | 不竞争 runtime / lifecycle / orchestration | 产品对象是经营推进控制台，不是 agent 搭建平台 |
| Revenue intelligence | Gong、Clari | 不只锁在销售收入主题 | 用 AdvancementSignal / MustPushItem 横跨销售、CS、交付、审批、资源 |
| Meeting AI | Granola、Otter、Fireflies | 不把会议总结当终点 | 把会议作为高价值 signal / evidence 来源，最终归到 Must Push 与 Review Action |
| 通用 AI 助手 / 聊天 | ChatGPT、Claude、Gemini 通用界面 | 不持久化多轮聊天历史 | Ask Helm 必须收口到对象、页面、Review Action 或 Must Push |
| 国内 AI 助手 / 通用 copilot | 各类通用 copilot 与 AI 员工 | 不替企业自动决策、自动发送、自动结算 | 在受控试点下保持 recommendation / explanation / proposal / proactive 的判断层口径 |

### 2.2 差异化要点

1. **判断层而非执行层**：Helm 默认提供 recommendation、explanation、proposal、proactive，不默认提供 commitment、send、payment、settlement。
2. **经营对象优先**：Must Push、Review Action、Memory 都挂回经营对象（Lead / Customer / Candidate / Partner / Workstream / 资源），不停留在自由消息列。
3. **受控试点姿态**：workspace-first、membership-backed、controlled-trial、judgement-first、decision-first 是长期姿态，不是临时口径。
4. **可复核证据链**：每个 Must Push 都必须挂 evidence、reason、boundary、primary action、review entry point。
5. **deterministic 排序**：LLM 只承担解释 / 文案 / 压缩原因，不承担最终排序。
6. **中国市场友好**：保留 Stripe（全球）+ Alipay / WeChat Pay（中国）双轨、中文判断面表达，不做新的对外承诺面。

---

## 三、当前仓库现实（repo truth）

本节用于阻止文档把已经成立的能力误读为「未做」，把仍未成立的能力误读为「已做」。基线提交：`origin/main@208ed1b5c fix: restore continuity runtime review surfaces`。

### 3.1 已经成立的现实

1. 路由所有权：根目录 `app/` 是 current-main route owner（不是 `apps/helm-app`）。
2. 查询面：`data/queries.ts` 仍是当前真实查询聚合 façade。
3. 数据库：MySQL 已成为生产基线，SQLite 仅作为 archive / 兼容生成入口。
4. 商业基线：Workspace == Organization、Membership、BillingAccount / TrialState / WorkerEntitlement / UsageLedger 已成立；Stripe、Alipay / WeChat Pay 仅作为 narrow payment rail。
5. Internal Operating Workspace：`/operating`、6 类 role handoff、operating loop acceleration 已第一轮冻结。
6. Memory 系统：MEM-WRITE-005H/005I/005J + Phase 0–3 freeze 已落地为 review-first / read-only operator 基线。
7. **Mobile Command Surface 已实现**：`/mobile` 第一屏已经把 Ask Helm mobile answer、Must Push 必须推进项以及 Review / Memory / Operating 承接入口收在同一张窄手机端经营推进入口；本地完整验证已通过（见 §3.2）。
8. **Business Advancement planning chain 已推进到 Phase 3 系列 review-only artifact**：Phase 1A contract+fixtures+offline eval、Phase 1B feasibility matrix、Phase 2 Signal -> Must Push Adapter、Phase 2B / 2C read-model proof、Phase 3 entry gate / 3A guard resolution / 3B planning artifact / 3C–3N runtime entry / disabled prototype review、Phase 3O real-data calibration 合同与 Phase 3P redacted snapshot collector 均已落为 planning-only 文档与测试，runtime adoption 仍维持 No-Go。
9. Continuity runtime review surfaces：`208ed1b5c fix: restore continuity runtime review surfaces` 已恢复 continuity runtime review 的承接面，本轮上下文按此为基线。

### 3.2 最近一次有意义的本地完整验证（2026-04-26）

以下结果来自 Mobile Command Surface 实现切片之后的 isolated full-validation 跑批：

1. `npm run db:reset`：通过（隔离环境）
2. targeted continuity E2E：6 用例通过
3. `npm run check:boundaries`：通过
4. `npm run typecheck`：通过
5. `npm run test`：2667 测试通过
6. `npm run build`：通过
7. `npm run quality:regression`：181 测试通过
8. `npm run e2e`：34 用例全部通过

DB-backed E2E 在本轮已恢复为可运行；旧版 WORKING-CONTEXT.md 中关于 dev RDS 不可达的阻塞陈述不再代表当前主干现实，作为历史/已 unblocked 记录处理（详见 `docs/reviews/HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_CLOSEOUT_V1.md`）。

### 3.3 当前残留风险

1. **MySQL 1020 concurrency warning trace**：在 E2E 跑批期间出现于 `dailyUsageSnapshot`、`recommendationLog`、`membership` 周边；最终 assertion 全部通过，但仍属于 hardening 残留项，不能因为通过 assertion 就视为关闭。
2. Plugin runtime 仍没有真正 sandbox。
3. future-real auth 仍是受控试点级，不是完整生产级 enterprise SSO / SCIM。
4. broad auto-write、auto-send、auto-execution 仍未授权。
5. Business Advancement Phase 3O / 3P 的 redacted live DB snapshot 校准证据仍未提交，runtime adoption 维持 No-Go。
6. shared `helm2026` DB 旧 failed migration / view-base-table blocker 仍存在；migration-state repair 属于独立任务。

---

## 四、Helm 状态四类短表

按 [AGENTS.md](../../AGENTS.md) §8 的统一分级规则给出。

### 4.1 已经完整成立

1. workspace-first / membership-backed / controlled-trial / judgement-first / decision-first 的产品姿态。
2. recommendation / explanation / proposal / proactive 与 commitment / send / payment / settlement 的边界口径。
3. 路由所有权（根目录 `app/`）与查询面（`data/queries.ts`）。
4. MySQL 生产基线、`BillingAccount / TrialState / WorkerEntitlement / UsageLedger`、Stripe + Alipay / WeChat Pay narrow payment rail。
5. Internal Operating Workspace 第一轮 baseline、6 类 role handoff、operating loop acceleration。
6. Mobile Command Surface 第一屏 Ask Helm + Must Push + Review / Memory / Operating 跳转入口。
7. Memory 写入 retry / source rebuild / DB lock / review-first 的 005H/005I/005J + Phase 0–3 冻结。
8. Business Advancement Phase 1A / 1B / 2 / 2B / 2C planning-only 文档与测试链。
9. continuity runtime review surfaces 的恢复（基线提交 `208ed1b5c`）。

### 4.2 已成形但仍需下一层

1. Mobile Command Surface 的 Must Push 仍是已有数据与 operating readout 的 read-first 压缩，未接入 Phase 2+ 的 AdvancementSignal -> MustPushItem deterministic 排序。
2. Business Advancement Phase 3 系列：planning artifact、disabled-by-default seam prototype、redacted snapshot collector 已成立，但仍未进入 runtime extractor / production query / official write / page 行为变更。
3. Ask Helm 已具备 transcript-only 语音输入与 mobile answer adapter，但仍不直接发送、审批、付款、承诺、跨 workspace 检索或写回正式系统。
4. Reserved-only GTM capability plan readout 与 `CustomerDemandBrief` 草稿候选流仍是 reserved tenant 内部 review-first 流程，未进入 customer-facing intake / submission / 自动化 trial initialization。
5. Memory 写入 review-first 链路仍未进入 broad auto-execution；retry executor 仍只接受人工确认。
6. settlement readiness gate / proof pack / exception 视图仍只是 internal operator layer，不是 finance platform 或 payout execution。

### 4.3 刻意未做

1. 不做 enterprise multi-org / SSO / SCIM 完整体。
2. 不做完整 workflow / orchestration / agent platform。
3. 不做完整自动执行 / 自动发送 / 自动结算平面。
4. 不做 CRM / ERP / 项目管理 / BI 替代品。
5. 不做通用 chat 产品（Ask Helm 不持久化多轮聊天历史，必须回到对象 / 页面 / Review Action / Must Push）。
6. 不做 marketplace / public partner discovery / app store。
7. 不做 plugin runtime sandbox（仍保留 narrow adapter）。
8. 不做跨 workspace / 跨 tenant 聚合或对外承诺。
9. 不在没有 redacted live DB calibration 的前提下推进 Business Advancement runtime adoption。

### 4.4 风险项

1. MySQL 1020 concurrency warning（dailyUsageSnapshot / recommendationLog / membership）仍待 hardening。
2. plugin runtime sandbox 缺位。
3. future-real auth 不等于 enterprise auth。
4. broad auto-write / auto-send / auto-execution 仍未授权；任何越权写入或发送都属于硬边界违规。
5. Phase 3 系列 runtime adoption 在缺少 redacted live DB calibration 证据时维持 No-Go；任何 page 行为或 production query 接入需独立评审。
6. shared `helm2026` DB 旧 failed migration / view-base-table blocker 需要独立 migration-state repair 任务。
7. customer-facing wording drift：必须持续把 recommendation / proposal / proactive 与 commitment / send / settlement 区分清楚。

---

## 五、下一阶段队列

下一阶段队列只批准 planning + 受控 read-model + offline / synthetic / redacted snapshot 工作。所有阶段都不批准 runtime extractor、schema 扩张、official write、自动执行、自动发送、page 行为变更或 production query adoption。

### 5.1 Phase 1A：contract + fixtures + offline eval（已成立 / 仅做 documentation refresh）

允许：

1. 维持 `AdvancementSignal / AdvancementJudgement / MustPushItem / ReviewRequiredAction / MemoryCandidate / SkillSuggestion` 的 conceptual planning contract。
2. 维护 20 条 fixture pack 与 offline eval 脚本。
3. 在文档层把市场定位、不再使用的旧表达、Helm 状态四类短表、residual risk 与本文件一致同步。

不允许：

1. 把 contract 落为 Prisma schema、API contract、event queue。
2. 在 fixture / eval 脚本里引入真实 DB 读写。
3. 引入 runtime extractor 或任何 production query adoption。

### 5.2 Phase 1B：read-model adapter feasibility（已成立 / 维持只读姿态）

允许：

1. 维持 6 current / 9 thin / 5 future 的 feasibility matrix。
2. 在 documentation / planning artifact 层继续证明 thin projection 可与现有 read model 共存。
3. 把 Phase 2B / 2C 的 read-model proof matrix 与 query review artifact 作为 planning-only 输入。

不允许：

1. 实际接入 production read model。
2. 创建新的 read-model 文件或 mobile-command-read-model 分支。
3. 引入 schema 字段或 derived column。

### 5.3 Phase 2：Signal -> Must Push Adapter（仅 planning + offline + synthetic）

允许：

1. 维持 offline / pure / planning-only Signal -> Must Push Adapter，包括 deterministic ranking、boundary distinctions、review-required 深链、active / deferred 划分。
2. 用 Phase 2B / 2C 的 query review artifact 作为来源约束；继续禁止 LLM 做最终排序。
3. 完成 Phase 3 / 3A–3N 的 planning-only artifact 队列：runtime entry review、guard resolution、disabled-by-default seam prototype、internal prototype review。
4. Phase 3O real-data calibration 合同 + Phase 3P redacted snapshot collector：仅在显式 redacted live DB snapshot 提交时运行评估，默认 No-Go。

不允许：

1. 把 adapter 接入 mobile-command-read-model、`/operating`、`/dashboard`、`/inbox`、`/approvals`、`/opportunities`、customer success queue 等任何 production page 行为。
2. 在缺少 redacted live DB calibration 的情况下宣布 runtime adoption。
3. 引入新的 schema、API、Prisma 列、official write route 或自动执行权。

### 5.4 Phase 3：Ask Helm Asset Capture（仅 planning + read-first + reviewable candidate）

允许：

1. 把 Ask Helm 高频意图、被放弃高置信答案、边界触碰收成 reviewable `Interaction Asset Candidate` 的 planning artifact。
2. 让 candidate 在 Ask Helm mobile / desktop 入口以 read-first 形式出现，并落到 `MemoryCandidate / SkillSuggestion`。
3. 在 `MemoryCandidate` review-first 流程下沉淀经验。

不允许：

1. 持久化 Ask Helm 多轮聊天历史。
2. 把 `SkillSuggestion` 自动晋升为 formal skill 或自动获得 execution authority。
3. 把 Ask Helm 输出直接外发、写入正式系统、跨 workspace 检索。
4. 引入 schema 或 production query。

### 5.5 显式不批准（贯穿所有 Phase）

1. runtime extractor。
2. schema 扩张（Prisma schema、新表、新列、新 enum 值变更）。
3. 自动执行、自动发送、自动审批、自动付款、自动结算。
4. 完整 workflow / orchestration / agent platform、CRM、BI、chat platform。
5. 跨 workspace / 跨 tenant 聚合、Helm reserved tenant 信息暴露给普通租户。
6. 把 candidate capability 升级为 execution authority。

---

## 六、成功度量

成功度量分两层。第一层是产品判断质量，第二层是边界与治理。两层缺一不可。

### 6.1 产品判断质量

1. Must Push 命中率：在 fixture pack 与 offline eval 上，每个 workspace 的 top 3–5 Must Push 与人工挑选的「今天必须推进」重合率不下降。
2. 解释链完整率：每个 Must Push 都包含 evidence、reason、boundary、primary action、review entry point 的比例 = 100%。
3. 排序稳定性：在反转输入顺序、调整 fixture 顺序的回归测试下，Must Push 排序仍保持 deterministic。
4. Ask Helm 收口率：Ask Helm 输出回到对象、页面、Review Action 或 Must Push 的比例不下降；不持久化的多轮聊天历史 = 0。
5. Mobile Command Surface 第一屏可达性：`/mobile` 第一屏可在 review-first 状态下打开 Ask Helm answer、Must Push、Review / Memory / Operating 跳转入口。

### 6.2 边界与治理

1. recommendation / commitment 边界 A-minus 维持稳定：customer-facing wording 漂移检查无新增违规。
2. workspace-first / membership-backed / capability-aware 校验：Must Push、Review Action、Memory writeback 均通过 capability matrix 校验。
3. Phase 3 系列 runtime adoption No-Go：在缺少 redacted live DB calibration 证据时不进入 production query / page 行为。
4. MySQL 1020 concurrency warning 收敛：dailyUsageSnapshot / recommendationLog / membership 路径在受控负载下不再产生 1020 trace。
5. 验证链全绿：`db:reset / self-check / check:boundaries / typecheck / lint / test / build / e2e / quality:regression` 一次性通过。

---

## 七、No-Go 条件

任意一条触发即立即停下当前切片并改回 review-first / read-first 姿态：

1. 任何 customer-facing wording 把 recommendation / proposal / proactive 写成 commitment / send / settlement。
2. 任何 PR 在没有专项评审的前提下引入 schema 改动、新 Prisma 列、新表、新 enum 值变更。
3. 任何 PR 引入 runtime extractor、production query adoption 或 official write route。
4. 任何 PR 让 `SkillSuggestion` 自动晋升为 formal skill 或获得 execution authority。
5. 任何 PR 在缺少 redacted live DB calibration 证据时把 Phase 3 planning artifact 接入 production page 行为。
6. 任何 PR 让 Ask Helm 持久化多轮聊天历史、跨 workspace 检索或自动外发。
7. 任何 PR 越过 capability matrix 在 high-risk surface（成员管理、billing、contributor registry、manual settlement、participant portal）做自动执行。
8. 任何 PR 让 plugin / extension 突破当前 narrow adapter 边界，进入 sandbox / marketplace / public partner discovery 形态。
9. 任何 PR 把当前文档姿态（market positioning、boundary、residual risk）改写成「已经完整成立」而代码 / 页面 / 测试 / 文档没有同时成立。

---

## 八、与既有文档的关系

本文件不替代以下文档，只统一它们在当前阶段对外的市场定位、当前仓库现实与下一阶段开工边界：

1. [AGENTS.md](../../AGENTS.md)：仓库执行规范与硬边界。
2. [README.md](../../README.md)：项目整体表达入口；本文件批准把广义「AI 经营协同操作系统」措辞收口为「经营推进控制台 / 经营推进操作系统（受控试点）」。
3. [DESIGN.md](../../DESIGN.md)：视觉与界面基线。
4. [WORKING-CONTEXT.md](../../WORKING-CONTEXT.md)：本轮已同步当前路径、日期、Mobile Command Surface 实现与 E2E 验证现实、residual risk 与下一阶段优先级。
5. [HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md](./HELM_BUSINESS_ADVANCEMENT_FINAL_REQUIREMENTS_V1.md)：Phase 1A / 1B / 2 入口结论。
6. [HELM_V2_1_MARKET_POSITIONING_BRIEF.md](./HELM_V2_1_MARKET_POSITIONING_BRIEF.md)：市场判断、竞争边界与目标客户画像。
7. Phase 1A / 1B / 2 / 2B / 2C / 3 系列 review 报告：当前 planning-only 姿态的细节证据。

如果未来出现冲突，以最新的 freeze 报告 + 本文件中「Helm 不是什么」「Helm 状态四类短表」「No-Go 条件」三节为准。
