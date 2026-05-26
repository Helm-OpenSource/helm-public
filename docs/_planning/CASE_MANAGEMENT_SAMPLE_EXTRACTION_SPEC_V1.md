---
status: active
progress: worker-bi-cookbook-landed / d2-smoke-and-full-integration-pending
owner: helm-core
created: 2026-05-18
review_after: 2026-05-22
archive_trigger:
  - extensions/case-management-sample/ exists in main, passes check:public-release, introduces no new secret-history exposure, and ships with v0.1.0-trial after repo-level secret-history remediation is complete
  - Extraction is replaced by an alternative public-vertical strategy
---

# `extensions/case-management-sample/` Extraction Spec V1

更新时间：2026-05-18
状态：Minimum public reference + worker / BI cookbook landed — D2 smoke / full integration pending
依赖：[`docs/_planning/HELM_POSITIONING_COLLATERAL_TRACK_V1.md`](./HELM_POSITIONING_COLLATERAL_TRACK_V1.md) D3.dep / D3.exec
目标：在 2026-05-22 前完成最小公开参考与后续抽取计划，让 v0.1 公开镜像至少有可 fork、可测试、可审计的 vertical 起点

---

## 1. 计划摘要

`extensions/guangpu/` 是当前唯一 tenant-private vertical pack，但它是 `public-release-guard` 黑名单（`guangpu / midun / zhaojiling / aicaitest`），**不能直接进公开镜像**。

本 spec 把它的**架构骨架**（信号建模 / worker driver pattern / 闸口 contract / BI report skill 形式 / fixture / 测试）脱敏抽出，建立 `extensions/case-management-sample/` 作为：

1. v0.1 公开镜像核心叙事 "带电池整机" 的实物证据
2. 1-pager [§30 分钟 onboarding 锚点](../positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md#30-分钟-onboarding-锚点) 步骤 3 / 4 的引用对象
3. README [§90 秒看到 Helm](../../README.md) 后交付工程师能 fork 改造的起点
4. positioning collateral D3 cookbook 的承载体

**不**复制 tenant-private 客户数据、客户名、内部 host、商业 connector。

**2026-05-18 执行状态**：`extensions/case-management-sample/` 已落最小公开参考（tenant manifest、signals / workers / bi-report manifest、signal 类型、4 类 synthetic fixture、case mapper + Vitest），并补齐 worker / BI cookbook minimum slice（case allocation driver、case stewardship driver、daily activity readout report skill assets）。这解除 README / 1-pager 的 dead-link 风险，但不等于 production-ready vertical；Docker fresh-clone smoke、`/operating` runtime/eval wiring、以及可选 day-board / employee / qc-issue mapper 仍是 D2 / full integration 剩余项。

---

## 2. 范围

### 2.1 输入参考（要看的 tenant-private 资源）

| 路径 | 角色 | 抽取动作 |
|---|---|---|
| `extensions/guangpu/tenant.manifest.json` | tenant manifest 形式 | 模板化复制 |
| `extensions/guangpu/signals/types.ts` | signal 基础类型 | 提取通用，删 vertical 特化 |
| `extensions/guangpu/signals/{case,day-board,employee,qc-issue}/` | 4 类通用 signal | sanitize 后复制 |
| `extensions/guangpu/workers/case-allocation-driver-preview/` | driver template 范式 | sanitize 后复制 + 改名 |
| `extensions/guangpu/workers/case-stewardship-driver-preview/` | stewardship driver 范式 | sanitize 后复制 |
| `extensions/guangpu/workers/lifecycle-objectives.ts` + `worker-modes.ts` | worker 容器约束 | 检查通用度后复制 |
| `extensions/guangpu/bi-report/report-skills/bi_revenue_daily/` | 1 个 BI report skill 形式 | rename + sanitize 后复制 |
| `extensions/guangpu/bi-report/extension.manifest.json` | extension manifest 形式 | 模板化复制 |
| `extensions/guangpu/bi-report/resources/*.resource.yaml`（部分） | resource 声明形式 | 仅保留 1 个示例 |

### 2.2 当前已落地目录结构

```
extensions/case-management-sample/
├── tenant.manifest.json
├── README.md                              # 5 行摘要 + 5 步 fork 操作 + schema 改造 + worker 适配 + fixture 演示
├── signals/
│   ├── extension.manifest.json
│   ├── types.ts                            # generic signal types only
│   ├── case/                               # 案件 signal
│   │   ├── case-mapper.ts
│   │   └── case-mapper.test.ts
│   ├── README.md
│   └── types.test.ts
├── workers/
│   ├── extension.manifest.json             # cookbook assets only; runtime workers empty
│   ├── README.md                           # 通用 worker 容器规约
│   ├── lifecycle-objectives.ts
│   ├── lifecycle-objectives.test.ts
│   ├── worker-modes.ts
│   ├── worker-modes.test.ts
│   ├── manifest.test.ts
│   ├── case-allocation-driver/             # rename: 去 -preview 后缀
│   │   ├── decide.ts
│   │   ├── decide.test.ts
│   │   ├── types.ts
│   │   ├── manifest.ts
│   │   └── README.md
│   └── case-stewardship-driver/
│       ├── decide.ts
│       ├── decide.test.ts
│       ├── types.ts
│       ├── manifest.ts
│       └── README.md
├── bi-report/
│   ├── extension.manifest.json
│   ├── manifest.test.ts
│   ├── report-skills/
│   │   └── daily-activity-readout/         # rename from bi_revenue_daily
│   │       ├── query.sql                   # synthetic schema
│   │       ├── schema.json
│   │       ├── metrics.json
│   │       ├── result-criteria.json
│   │       ├── prompt.md
│   │       ├── message-template.md
│   │       ├── skill.json
│   │       └── sample-input.json
│   └── resources/
│       └── case-management-sample.daily.resource.yaml
├── fixtures/
│   ├── case.sample.json
│   ├── day-board.sample.json
│   ├── employee.sample.json
│   └── qc-issue.sample.json
```

Full integration pending（不属于当前 D3 cookbook 已落地范围）：

- `signals/signal-engine.ts` 或等价通用 signal engine（仅在能从 tenant-private 逻辑中干净分离时新增）
- `signals/day-board/`、`signals/employee/`、`signals/qc-issue/` mapper 与专项测试（当前只有 synthetic fixture）
- `/operating` runtime/eval wiring、route smoke、Docker fresh-clone smoke

### 2.3 非目标

本抽取**不做**：

1. ❌ 复制 `extensions/guangpu/midun-integrate/`（米盾是商业 connector，tenant-private）
2. ❌ 复制 `extensions/guangpu/seat-profile/`（席位画像有特化 PII 模型，需独立设计）
3. ❌ 复制 signals 中的 `ptp-deviation` / `repayment` / `strategy-card` / `execution-receipt`（行业特化）
4. ❌ 复制任何"电话催收数字员工" planning docs
5. ❌ 复制任何 `.local-analysis/` / `sql/` / 真实 fixture
6. ❌ 提供"自动派工 / 自动外发"路径（仍走 `requiresApproval: true` 默认）
7. ❌ 接入 LLM 默认路径（保持 deterministic-only，与 `OPERATING_SIGNAL_ALLOWED_NEXT_ACTION_SET` 闭集一致）
8. ❌ 把 `extensions/case-management-sample/` 描述为 production-ready 模板（明确标 `sample` / `reference implementation`）

---

## 3. Sanitization 规则

### 3.1 必须从所有文件中清掉的内容

| 类别 | 例子 | 替换为 |
|---|---|---|
| Tenant slug | `guangpu`, `Guangpu`, `光谱`, `光潽` | `case-management-sample` |
| 商业客户名 | `midun`, `Midun`, `米盾`, `米盾云` | （删除整段，或泛化为 "external case backend"）|
| 公司名 | `杭州光潽科技有限公司` | 删除 |
| 客户员工姓名 | 任何中文姓名出现在 fixture / test | 替换为 `Alice / Bob / Carol / Dave / Eve` |
| 真实手机号 / 邮箱 | `139xxxx`, `xx@guangpu.com` | `synthetic-<n>@example.com`, `+86-13800000<n>` |
| 真实 case 标识 | 真实 caseId / 真实合同号 | `CASE-SAMPLE-<n>` |
| 内部 host / IP / RDS | `rm-shuyao-*.aliyuncs.com` 等 | 删除 |
| 业务术语 vertical-specific | "DPD" (Days Past Due), "M3 客户", "停催 / 复催" | 中性 "follow-up window N", "follow-up stage" |
| 内部金额 / 真实 SOP | 真实金额数据 | synthetic, < 4 位数 |
| 真实策略卡 | 任何业务 strategy 内容 | 删除整 feature |

### 3.2 必须替换的命名

- `guangpu-*` extension key → `case-management-sample-*`
- `Guangpu BI Report` displayName → `Case Management Sample - Daily Activity Readout`
- `Guangpu Seat Profile` 不抽出
- `bi_revenue_daily` skill → `daily-activity-readout`
- `bi_repay_daily` 不抽出（vertical-specific）
- `bi_collection_operating_signal_daily` 不抽出
- worker `*-preview` 后缀去掉（公开版稳定接口）

### 3.3 必须重新写而非复制的

- 所有 `*.fixtures.ts` / `*.sample.json`：**100% 合成**，不允许从生产 fixture sed-replace（命名/结构可参考，数据值必须重写）
- 所有 README：重写为对交付工程师视角，不复制 tenant-private 历史叙事
- `bi-report/extension.manifest.json` 的 `summary` / `notes` 字段：重写
- 任何 `docs/*` 不抽出（这些都是 tenant-private 决策档）

---

## 4. 抽取步骤

### Step 1: 准备（半天）

1. 在仓库 fresh worktree 上工作（不动 `extensions/guangpu/`）
2. `git fetch origin && git checkout -b chore/case-management-sample-extraction`
3. 阅读本 spec + [`docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md`](../positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md) + [`extensions/guangpu/README.md`](../../extensions/guangpu/README.md)

### Step 2: 骨架建立（半天）

1. 创建目录树（按 §2.2 spec）
2. 写 `tenant.manifest.json`：tenantKey=`case-management-sample`，displayName=`Case Management Sample`，ownedExtensions 列入 signals / workers / bi-report
3. 写顶层 README.md（先 stub，正式内容在 Step 5）
4. 跑 `npm run check:public-release` 确保空骨架已 pass

### Step 3: 类型与契约（1 天）

1. 抽 `signals/types.ts`：保留通用 union（state / family / blocker），去 `ptp-deviation` / `repayment` / `strategy-card`
2. 抽 `signals/signal-engine.ts`：检查是否引用 guangpu 特有 mapper，若是则解耦
3. 抽 4 类 signal 子目录的 `*-mapper.ts` + types
4. 抽 `workers/lifecycle-objectives.ts` + `worker-modes.ts`：检查通用度
5. 抽 2 个 driver（`case-allocation-driver` / `case-stewardship-driver`）的 `decide.ts` + `types.ts` + `manifest.ts`
6. 抽 `bi-report/extension.manifest.json` + 1 个 report skill 的 6 个标准文件
7. 每步后 `npm run check:public-release` 应仍 pass

### Step 4: Fixture 重写（1 天）

1. `signals/<kind>/<kind>.fixtures.ts` 全部从空白起写
2. `fixtures/<kind>.sample.json` 4 个合成样本：
   - `CASE-SAMPLE-001 ~ 010`：状态分布覆盖 7 类 signal family，含 evidence_gap / boundary_attempt 至少各 1 例
   - 员工：`Alice / Bob / Carol / Dave / Eve` 五人
   - 日看板：3 天数据，含 1 个 redAlert
   - QC issue：2 条，含 1 条 stale
3. 跑 `npm run eval:operating-signal-flow` 用新 fixture 跑通 7 family / 10 blocker / 22 state 覆盖

### Step 5: README + cookbook（半天，对应 collateral D3）

写 `extensions/case-management-sample/README.md`：

```markdown
# Case Management Sample

> Helm 公开 vertical 参考实现：把通用案件管理工作流（分案 / 跟进 / 复核 / 闭环）做成可 fork 的整机。

## 这是什么

5 行说明 + 1 张架构图（ASCII）

## 5 步 fork 给你的客户

1. ...
2. ...
3. ...
4. ...
5. ...

## Signal schema 改造指引

哪些字段是 domain（你客户的业务）、哪些是 generic（保留）

## Worker driver 适配指引

如何在 case-allocation / case-stewardship 基础上加你的 driver

## 一个完整 fixture 演示

`npm run eval:operating-signal-flow -- --fixture extensions/case-management-sample/fixtures/`
```

### Step 6: 测试 + 验证（半天）

1. 跑全套：`npm run typecheck && npm run lint && npm run test`
2. 跑 boundary 检查：`npm run check:boundaries`
3. 跑公开发布检查：`npm run check:public-release`
4. 跑 secret history：`npm run check:secret-history`。当前仓库级 RDS history remediation 未完成时该命令可能仍因既有历史失败；本抽取的阻塞标准是**不引入新的明文 secret、内部 host 或新的 compromised commit**，完整 release 仍需仓库级 secret-history remediation 关闭。
5. `git grep -i "guangpu\|midun\|光谱\|米盾\|杭州光潽"` on `extensions/case-management-sample/` 应**完全空**
6. 跑 e2e：`npm run e2e`，主要看 operating-signal-flow-map.spec.ts 是否仍绿
7. `docker compose up` 后访问 `/operating` 应看到样本数据

### Step 7: PR 与 review

1. PR 标题：`feat(case-management-sample): extract public vertical reference from tenant-private pack`
2. PR 描述包含：本 spec 的链接 + 6 步验证截图 + Sanitization checklist
3. 至少 1 个独立 reviewer（不是 PR 作者）跑一遍 §3 sanitization 规则的所有 grep
4. Merge 前必须跑通本 spec §5 当前 D3 阻塞验收；D2 / full integration pending 项必须在 release wording 中降级，不得写成已完整跑通

---

## 5. 验收口径

| 项 | 验收方式 | 阻塞性 |
|---|---|---|
| 命名清洁 | `git grep -i "guangpu\|midun\|光谱\|光潽\|米盾\|杭州光潽\|aliyuncs"` 在 `extensions/case-management-sample/` 0 命中 | block |
| Public release guard pass | `npm run check:public-release` PASS | block |
| Secret history no-new-exposure | `HELM_SECRET_HISTORY_BASELINE_REF=origin/main npm run check:secret-history` 不得出现本 PR 新增路径 / 新增 commit；完整 release 仍受仓库级 RDS history remediation gate 约束 | block |
| Type check | `npm run typecheck` PASS | block |
| Lint | `npm run lint` PASS | block |
| Targeted sample tests | `npx vitest run ...case-management-sample...` PASS | block |
| Boundary check | `npm run check:boundaries` PASS（含新增 sample boundary contract） | block |
| 30 分钟 onboarding 步骤 3-4 可执行 | manual 跑 1-pager §30 分钟 onboarding 步骤 3 + 4 | D2 block / pending |
| README 长度 | 600-1200 字 | soft |
| docker-compose smoke | `docker compose up` 后 `/operating` 显示 sample 数据 | D2 block / pending |
| Eval 覆盖 | `npm run eval:operating-signal-flow` 用 sample fixture 覆盖 7 family / 10 blocker / 22 state | full integration pending |
| 独立 reviewer 签字 | 非 PR 作者跑完 sanitization 规则 | block |

**当前 minimum-reference 验收快照（2026-05-18）**：

- 命名清洁：`rg -n -i "guangpu|midun|zhaojiling|aicaitest|光谱|光潽|米盾|杭州光潽|aliyuncs" extensions/case-management-sample` 0 命中
- 新增 sample 单测：`npx vitest run extensions/case-management-sample/signals/types.test.ts extensions/case-management-sample/signals/case/case-mapper.test.ts extensions/case-management-sample/workers/manifest.test.ts extensions/case-management-sample/workers/worker-modes.test.ts extensions/case-management-sample/workers/lifecycle-objectives.test.ts extensions/case-management-sample/workers/case-allocation-driver/decide.test.ts extensions/case-management-sample/workers/case-stewardship-driver/decide.test.ts extensions/case-management-sample/bi-report/manifest.test.ts` PASS（8 files / 23 tests）
- `npm run check:public-release` PASS（3774 files / 0 blockers）
- `npm run check:boundaries` PASS
- `npm run typecheck` PASS
- `npm run lint` PASS（仅 Babel 大文件 deopt note）
- `HELM_SECRET_HISTORY_BASELINE_REF=origin/main npm run check:secret-history` PASS（123 baseline-known finding(s) suppressed；release source 仍需 full remediation）
- current-head clean public mirror candidate：`HELM_SECRET_HISTORY_REPO=/tmp/helm-public-mirror-20260518-HEJbBj npm run check:secret-history` PASS（0 compromised commits reachable in 1 ref）
- current-head public mirror clean receipt：`mirror-clean:public-mirror-2026-05-18-current-head-8a5a96e59` PASS；receipt check PASS；mirror verifier scanned 3204 files

---

## 6. 风险与开放问题

### 风险

1. **signal-engine 可能与 guangpu 特化耦合度比预期高**
   - 缓解：Step 3 第 2 步先做依赖分析；若耦合重，把通用部分拆到 `lib/signal-engine/` 作为 shared library，sample 只保留 mapper
2. **tenant-private case lifecycle 可能是 case-allocation worker 的隐式依赖**
   - 缓解：Step 3 第 5 步先跑 `tsc --noEmit` 在 sample 目录上独立编译，找出所有 cross-extension import
3. **fixture 重写时间被低估**
   - 缓解：Step 4 优先做 case + day-board，qc-issue 简化，employee 用最小 5 人样本
4. **public release guard 后续加新规则时误伤 sample 自身**
   - 缓解：只允许 policy descriptor 文档进 allow-list；sample 源码 / fixture 不得靠 allow-list 通过，必须保持 public-safe 命名与 synthetic data

### 开放问题

1. **license header**：sample 文件需要 Apache-2.0 header 吗？参考 `lib/` 现有文件的 header 风格统一
2. **i18n**：sample README 是中文还是双语？建议先中文，英文 mirror 同 D1.en 一起做
3. **fixture 规模**：4 类 signal 各 5-10 条，还是更少？建议先各 3 条，跑通 eval 后看是否需要扩
4. **worker `-preview` 后缀**：guangpu 用 `-preview` 标记 "不入产"，sample 用什么后缀？建议**去掉后缀**，明确标 `extension.manifest.json` 的 `capabilityManifest.maxEffectMode: "read_only"` + 顶层 README 写明"sample / reference / not production"
5. **是否同时抽出 `closure/` 或保留为后续**：当前 spec 不含 `extensions/guangpu/closure/`；评估后再决定

---

## 7. 时间表

| 日期 | 动作 | 人天 |
|---|---|---|
| 2026-05-19 | 本 spec review + 启动 | 0.5 |
| 2026-05-19 | Step 1 准备 | 0.5 |
| 2026-05-19 | Step 2 骨架 | 0.5 |
| 2026-05-20 | Step 3 类型与契约 | 1.0 |
| 2026-05-21 | Step 4 fixture 重写 | 1.0 |
| 2026-05-22 上午 | Step 5 README + cookbook | 0.5 |
| 2026-05-22 下午 | Step 6 测试 + 验证 | 0.5 |
| 2026-05-22 收盘 | Step 7 PR 与 review | 0.5 |
| **合计** |  | **5 人天 / 4 个工作日** |

**Stop condition**：如果 2026-05-22 收盘前未达成 §5 所有 `block` 级验收，**不强行 merge**——通知 positioning collateral track owner 决定是否触发 §5 降级路径（"v0.1 含 minimum public reference" 而非"完整带电池 vertical 已抽出"）。

---

## 8. 与上下文文档的连接

| 文档 | 角色 |
|---|---|
| [`docs/_planning/HELM_POSITIONING_COLLATERAL_TRACK_V1.md`](./HELM_POSITIONING_COLLATERAL_TRACK_V1.md) | 本 spec 是其 D3.dep / D3.exec |
| [`docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md`](../positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md) | 引用本 sample 作为"带电池整机"证据 |
| [`README.md`](../../README.md) §路线图 Now | 列入 5 月窗口工作项 |
| [`WORKING-CONTEXT.md`](../../WORKING-CONTEXT.md) §3 优先级 | 列为 2026-05-18 新增 P0 |
| [`AGENTS.md`](../../AGENTS.md) §3 | `delivery-engineer-facing` 定位的承接物 |
| [`scripts/public-release-guard.ts`](../../scripts/public-release-guard.ts) | sample 不在 slug 黑名单；需 allowlist 验证 |
| [`extensions/guangpu/README.md`](../../extensions/guangpu/README.md) | 输入参考（tenant-private 原版） |

---

## 9. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-05-18 | V1 初稿：定义从 tenant-private vertical pack 脱敏抽出公开 case-management-sample 的范围、步骤、验收与停止条件 |
| 2026-05-18 | V1 执行更新：最小公开参考已落地；public mirror clean receipt 已生成；worker / BI cookbook minimum slice 已落地；fresh-clone onboarding 与 Docker smoke 仍 pending |
