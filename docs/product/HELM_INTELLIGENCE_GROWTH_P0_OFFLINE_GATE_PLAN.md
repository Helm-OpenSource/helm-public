---
status: active
owner: helm-core
created: 2026-05-02
review_after: 2026-07-31
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm 智能成长系统 P0 离线质量门禁实施计划

> **状态**：P0 offline gate 已落地（Slice A–D 已完成）；runtime / self-learning 继续 No-Go
>
> **本计划明确不做**：不做 DB schema，不做 API，不做 UI，不改生产 prompt，不做 runtime 接入，不做规则自动更新，不做记忆自动晋升，不做模型训练，不做生产数据库读写

---

## 一、目的

本计划将 [HELM_INTELLIGENCE_GROWTH_SYSTEM_PRD.md](HELM_INTELLIGENCE_GROWTH_SYSTEM_PRD.md) §四 P0 路线图转换为可实施的四个切片（Slice A–D），并为每个切片定义：

- 精确交付物
- 验收标准
- 验证命令
- 明确不做项

切片之间有依赖关系：A → B → C → D 顺序实施。

---

## 二、总体约束（所有切片共用）

以下约束适用于所有切片，不得以任何理由绕过：

| 约束 | 说明 |
|------|------|
| 不做 DB schema | 不新建、不修改任何 Prisma schema 或 SQL 迁移文件 |
| 不做 API | 不新建、不修改任何 `app/api/*` 路由或 server actions |
| 不做 UI | 不新建、不修改任何 React 组件或页面 |
| 不改生产 prompt | 不修改任何 `lib/llm/` 下的 prompt 模板或注入逻辑 |
| review-first | 任何可能影响生产行为的变更都必须经过人工复核 |
| offline-only | 所有 eval 只读取本地 fixture 文件，不读写生产数据库 |
| deterministic | evaluator 逻辑必须确定性；不调用外部 LLM API |

---

## 三、Slice A：类型契约（Contracts Only）

### 3.1 目标

为十条智能维度（见 PRD §三）建立 TypeScript 纯类型定义，作为后续 fixture 和 evaluator 的基础。

### 3.2 交付物

```
lib/intelligence-growth/
  types.ts            # 十条维度的 TypeScript 类型
  contracts.ts        # 每条维度的 evaluator input / output contract
  index.ts            # 统一导出
```

类型覆盖范围：

| 维度 | 核心类型 |
|------|----------|
| Context Intelligence | `ContextQualityInput`, `ContextQualityResult` |
| Object/Signal Intelligence | `ObjectSignalGrowthInput`, `ObjectSignalGrowthResult` |
| Company Memory Intelligence | `MemoryGrowthInput`, `MemoryGrowthResult` |
| Routing Intelligence | `RoutingGrowthInput`, `RoutingGrowthResult` |
| Action/Outcome Intelligence | `ActionOutcomeInput`, `ActionOutcomeResult` |
| Worker/Skill Intelligence | `WorkerSkillGrowthInput`, `WorkerSkillGrowthResult` |
| Prompt/Policy Intelligence | `PromptPolicyGrowthInput`, `PromptPolicyGrowthResult` |
| Eval/Replay Intelligence | `EvalReplayGrowthInput`, `EvalReplayGrowthResult` |
| Tenant Personalization Intelligence | `TenantPersonalizationInput`, `TenantPersonalizationResult` |
| Cost/Model/Tool Intelligence | `CostModelToolInput`, `CostModelToolResult` |

所有 `Result` 类型必须包含：

```typescript
type GrowthDecision = 'learning_candidate' | 'watch_only' | 'review_required' | 'rejected';
```

并明确：`'approved'` / `'auto_promote'` / `'production_ready'` 不在此类型集合中。

### 3.3 验收标准

- `npm run typecheck` 通过，零新增 error
- `lib/intelligence-growth/types.ts` 中存在全部 10 对 Input / Result 类型
- 没有引用 `@prisma/client`、`app/api/`、任何 UI 组件或生产 LLM 调用

### 3.4 验证命令

```bash
npm run typecheck
rg "auto_promote\|production_ready\|prisma\|app/api" lib/intelligence-growth/
# 期望：零匹配
```

### 3.5 明确不做

- 不做 DB schema
- 不做 API
- 不做 UI
- 不改生产 prompt
- 不实现 evaluator 逻辑（Slice C 做）
- 不写 fixture（Slice B 做）

---

## 四、Slice B：Fixture 与 Failure Taxonomy

### 4.1 目标

为十条智能维度分别提供：
1. 正向 fixture（expected good case）
2. 边界 fixture（boundary / edge case）
3. failure taxonomy 文档（每条维度）

### 4.2 交付物

```
evals/intelligence-growth/
  context/
    context-growth-cases.json          # ≥5 正向 + ≥3 边界
    context-failure-taxonomy.md
  object-signal/
    object-signal-growth-cases.json    # ≥5 正向 + ≥3 边界
    object-signal-failure-taxonomy.md
  memory/
    memory-growth-cases.json           # ≥5 正向 + ≥3 边界
    memory-failure-taxonomy.md
  routing/
    routing-growth-cases.json          # ≥5 正向 + ≥3 边界
    routing-failure-taxonomy.md
  action-outcome/
    action-outcome-cases.json          # ≥5 正向 + ≥3 边界
    action-outcome-failure-taxonomy.md
  worker-skill/
    worker-skill-growth-cases.json     # ≥5 正向 + ≥3 边界
    worker-skill-failure-taxonomy.md
  prompt-policy/
    prompt-policy-growth-cases.json    # ≥5 正向 + ≥3 边界
    prompt-policy-failure-taxonomy.md
  eval-replay/
    eval-replay-growth-cases.json      # ≥5 正向 + ≥3 边界
    eval-replay-failure-taxonomy.md
  tenant-personalization/
    tenant-personalization-cases.json  # ≥5 正向 + ≥3 边界
    tenant-personalization-failure-taxonomy.md
  cost-model-tool/
    cost-model-tool-cases.json         # ≥5 正向 + ≥3 边界
    cost-model-tool-failure-taxonomy.md
```

### 4.3 Fixture 格式规范

每条 fixture 必须包含：

```json
{
  "id": "ctx-001",
  "dimension": "context",
  "description": "...",
  "input": { ... },
  "expected": {
    "decision": "learning_candidate",
    "reason": "...",
    "boundaryViolations": []
  },
  "isNegativeBoundary": false
}
```

负向边界 fixture 必须设置 `"isNegativeBoundary": true`，且 `expected.decision` 必须为 `"rejected"` 或 `"review_required"`。

**Fixture 禁止内容**：

- 不包含真实 PII（姓名、电话、邮件、公司名）
- 不包含真实 API key 或 credential
- 不包含生产数据库查询结果
- 所有租户引用使用 alias（如 `tenant-alpha`、`tenant-beta`）

### 4.4 Failure Taxonomy 格式规范

每份 failure taxonomy 文档必须包含：

```markdown
# <维度名> Failure Taxonomy

## 一、Failure 分类

| Failure Type | 描述 | 期望处理 | 不做 |
|--------------|------|----------|------|
| ...          | ...  | ...      | ...  |

## 二、边界保持

- 不改生产 prompt
- 不做 DB schema
- 不做 API
- 不做 UI
- review-first
```

### 4.5 验收标准

- 全部 10 条维度各有 ≥5 正向 + ≥3 边界 fixture JSON
- 全部 10 条维度各有 failure taxonomy 文档
- `rg "真实|real_pii|prod_db|api_key"` 在 `evals/intelligence-growth/` 零匹配
- 所有 JSON 语法合法（`node -e "JSON.parse(require('fs').readFileSync(...))"` 通过）

### 4.6 验证命令

```bash
# 语法检查（对 evals/intelligence-growth 下所有 JSON）
find evals/intelligence-growth -name "*.json" | xargs -I{} node -e "require('{}')" 2>&1 | grep -c "Error" || echo "0 JSON errors"

# PII / credential 扫描
rg -l "真实姓名|真实邮件|真实手机|api_key|prod_db|password" evals/intelligence-growth/
# 期望：零匹配
```

### 4.7 明确不做

- 不做 DB schema
- 不做 API
- 不做 UI
- 不改生产 prompt
- 不实现 evaluator 逻辑（Slice C 做）
- 不用真实生产数据

---

## 五、Slice C：Offline Evaluator CLI / Report

### 5.1 目标

为十条智能维度（或首批覆盖优先级最高的 3–5 条）实现 offline evaluator，输出 machine-readable JSON + human summary。

### 5.2 交付物

```
scripts/
  intelligence-growth-eval.ts         # 主 CLI 入口
  intelligence-growth-eval.test.ts    # 单元测试

lib/intelligence-growth/
  evaluators/
    context-evaluator.ts
    object-signal-evaluator.ts
    memory-evaluator.ts
    routing-evaluator.ts
    # (其余维度按 P0 roadmap 扩充)
```

`package.json` 新增：

```json
"eval:intelligence-growth": "tsx scripts/intelligence-growth-eval.ts",
"eval:intelligence-growth:context": "tsx scripts/intelligence-growth-eval.ts --dimension context",
"eval:intelligence-growth:routing": "tsx scripts/intelligence-growth-eval.ts --dimension routing"
```

### 5.3 CLI 接口

```bash
# 运行全部维度
npm run eval:intelligence-growth

# 运行单条维度
npm run eval:intelligence-growth -- --dimension context

# 指定 fixture 文件
npm run eval:intelligence-growth -- --input-file evals/intelligence-growth/context/context-growth-cases.json

# 输出 JSON report
npm run eval:intelligence-growth -- --output-json evals/intelligence-growth/reports/latest.json
```

### 5.4 Report 格式

```json
{
  "runAt": "2026-05-02T00:00:00.000Z",
  "dimensions": [
    {
      "dimension": "context",
      "total": 8,
      "passed": 8,
      "failed": 0,
      "boundaryViolations": 0,
      "autoPromoteCount": 0,
      "productionWriteCount": 0
    }
  ],
  "summary": {
    "totalPassed": 80,
    "totalFailed": 0,
    "autoPromoteCount": 0,
    "productionWriteCount": 0,
    "runtimeAdoptionAllowed": false,
    "reviewFirstStatus": "enforced"
  }
}
```

report 中 `autoPromoteCount` 和 `productionWriteCount` 必须始终为 0，否则 eval 失败。

### 5.5 单元测试要求

每个 evaluator 文件必须有对应测试：

- ≥3 正向 case 通过
- ≥2 负向 boundary case 正确拒绝
- `autoPromoteCount === 0` 断言
- `productionWriteCount === 0` 断言

### 5.6 验收标准

- `npm run eval:intelligence-growth` 全绿（0 failures）
- `npm run test -- lib/intelligence-growth/` 全绿
- `npm run typecheck` 通过
- `npm run lint` 通过，0 errors
- report 中 `autoPromoteCount === 0`，`productionWriteCount === 0`，`runtimeAdoptionAllowed === false`
- evaluator 不引用 `@prisma/client`、不调用生产 LLM API、不读写文件系统外的数据

### 5.7 验证命令

```bash
npm run eval:intelligence-growth
npm run test -- lib/intelligence-growth/
npm run typecheck
npm run lint
rg "prisma\|fetch.*llm\|OPENAI_API_KEY\|anthropic" lib/intelligence-growth/evaluators/
# 期望：零匹配（不直接调用外部 API）
```

### 5.8 明确不做

- 不做 DB schema
- 不做 API
- 不做 UI
- 不改生产 prompt
- evaluator 不读写生产数据库
- evaluator 不调用外部 LLM API（纯离线 deterministic）

---

## 六、Slice D：docs / STATUS.md / self-check 集成

### 6.1 目标

将 P0 交付物接入 Helm 仓库的文档治理、状态注册表和自检脚本。

### 6.2 交付物

**6.2.1 docs/STATUS.md 新增行**

在"七、Intelligence Quality / Self-Improvement"章节新增一行：

```
| Intelligence Growth System (IGS) P0 | 已成形但仍需下一层 | 2026-05-02 | PRD + P0 offline gate plan 已落地；Slice A–D 已完成；runtime / self-learning 继续 No-Go |
```

**6.2.2 docs/README.md 新增索引**

在 product/ 章节新增两条：

```markdown
- [HELM_INTELLIGENCE_GROWTH_SYSTEM_PRD.md](product/HELM_INTELLIGENCE_GROWTH_SYSTEM_PRD.md)
  - **【智能成长系统 PRD】** 十条智能维度（Context / Object-Signal / Memory / Routing / Action-Outcome / Worker-Skill / Prompt-Policy / Eval-Replay / Tenant / Cost）的 P0–P3 路线图、硬边界、成功度量与 Go/No-Go；P0 offline gate 已落地，P1+ runtime / self-learning 继续 No-Go
- [HELM_INTELLIGENCE_GROWTH_P0_OFFLINE_GATE_PLAN.md](product/HELM_INTELLIGENCE_GROWTH_P0_OFFLINE_GATE_PLAN.md)
  - **【智能成长 P0 离线质量门禁实施计划】** 把 IGS P0 拆成 Slice A（合同）→ B（fixture + failure taxonomy）→ C（offline evaluator CLI）→ D（docs/status/self-check 集成）；明确不做 DB schema、API、UI、生产 prompt 变更；包含验收标准与验证命令
```

**6.2.3 self-check 集成**

在 `scripts/helm-self-check.ts` 中新增一项检查：

```typescript
// IGS P0 offline gate check
// 验证 docs/product/HELM_INTELLIGENCE_GROWTH_SYSTEM_PRD.md 存在
// 验证 docs/product/HELM_INTELLIGENCE_GROWTH_P0_OFFLINE_GATE_PLAN.md 存在
// 验证 docs/STATUS.md 包含 "Intelligence Growth System" 行
```

**6.2.4 WORKING-CONTEXT.md 更新**

在当前优先级列表中，在第 8 项（Phase 3 thin read-model adapter）之前新增：

```
8a. **Intelligence Growth P0 Offline Gate（实施准备就绪）**：PRD + P0 计划已落地；Slice A（合同）→ B（fixture + failure taxonomy）→ C（offline evaluator CLI）→ D（docs/status/self-check 集成）；明确不做 DB schema，不做 API，不做 UI，不改生产 prompt；runtime / self-learning 继续 No-Go
```

### 6.3 验收标准

- `docs/STATUS.md` 包含 "Intelligence Growth System" 行
- `docs/README.md` 包含对两份新文档的链接和说明
- `scripts/helm-self-check.ts` 包含 IGS P0 文档存在性检查
- `npm run self-check` 包含新增检查项（通过或 pre-existing 说明）
- `git diff --check` 通过

### 6.4 验证命令

```bash
git diff --check

rg "Intelligence Growth System" docs/STATUS.md
# 期望：有匹配

rg "HELM_INTELLIGENCE_GROWTH_SYSTEM_PRD\|HELM_INTELLIGENCE_GROWTH_P0_OFFLINE_GATE_PLAN" docs/README.md
# 期望：有匹配

rg "不做 DB schema" docs/product/HELM_INTELLIGENCE_GROWTH_P0_OFFLINE_GATE_PLAN.md
rg "不做 API" docs/product/HELM_INTELLIGENCE_GROWTH_P0_OFFLINE_GATE_PLAN.md
rg "不做 UI" docs/product/HELM_INTELLIGENCE_GROWTH_P0_OFFLINE_GATE_PLAN.md
rg "不改生产 prompt" docs/product/HELM_INTELLIGENCE_GROWTH_P0_OFFLINE_GATE_PLAN.md
rg "review-first" docs/product/HELM_INTELLIGENCE_GROWTH_P0_OFFLINE_GATE_PLAN.md
# 期望：每条都有匹配

rg "不做 DB schema" docs/product/HELM_INTELLIGENCE_GROWTH_SYSTEM_PRD.md
rg "review-first" docs/product/HELM_INTELLIGENCE_GROWTH_SYSTEM_PRD.md
# 期望：有匹配
```

### 6.5 明确不做

- 不做 DB schema
- 不做 API
- 不做 UI
- 不改生产 prompt
- self-check 新增项只做文档存在性检查，不做业务逻辑 eval

---

## 七、切片依赖与执行顺序

```
Slice A（合同）
    ↓
Slice B（fixture + failure taxonomy）
    ↓
Slice C（offline evaluator CLI）
    ↓
Slice D（docs/status/self-check 集成）
```

Slice D 可以在 Slice A 完成后部分先行（仅文档索引部分），但 self-check 集成项必须等 Slice C 完成后才能完整落地。

---

## 八、整体验证清单

所有切片完成后必须通过：

```bash
# 1. 代码质量
npm run typecheck
npm run lint

# 2. 新增 eval
npm run eval:intelligence-growth

# 3. 单元测试
npm run test -- lib/intelligence-growth/

# 4. 文档存在性
ls docs/product/HELM_INTELLIGENCE_GROWTH_SYSTEM_PRD.md
ls docs/product/HELM_INTELLIGENCE_GROWTH_P0_OFFLINE_GATE_PLAN.md

# 5. Key No-Go 词语存在
rg "不做 DB schema" docs/product/HELM_INTELLIGENCE_GROWTH_P0_OFFLINE_GATE_PLAN.md
rg "不做 API" docs/product/HELM_INTELLIGENCE_GROWTH_P0_OFFLINE_GATE_PLAN.md
rg "不做 UI" docs/product/HELM_INTELLIGENCE_GROWTH_P0_OFFLINE_GATE_PLAN.md
rg "不改生产 prompt" docs/product/HELM_INTELLIGENCE_GROWTH_P0_OFFLINE_GATE_PLAN.md
rg "review-first" docs/product/HELM_INTELLIGENCE_GROWTH_P0_OFFLINE_GATE_PLAN.md

# 6. STATUS.md 已更新
rg "Intelligence Growth System" docs/STATUS.md

# 7. git 工作区干净
git diff --check
```

---

## 九、当前状态与下一步

当前（2026-05-02）：Slice A–D 已全部完成。

- **Slice A**（commit `a84aa5fde`）：`lib/intelligence-growth/types.ts`、`contracts.ts`、`index.ts`、`contracts.test.ts` 已落地，十条维度类型契约完整
- **Slice B**（commit `b5ded5f65`）：`evals/intelligence-growth/` 下 10 个维度、80 个 JSON fixture cases、10 个 failure taxonomy 文档已落地
- **Slice C**（commit `d8a1433b8`）：`lib/intelligence-growth/evaluator.ts`、`evaluator.test.ts`、`scripts/intelligence-growth-eval.ts`、package scripts `eval:intelligence-growth` / `eval:intelligence-growth:context` / `eval:intelligence-growth:routing` 已落地
- **Slice D**（本次）：`docs/STATUS.md` IGS 行更新、`docs/README.md` 描述更新、`scripts/helm-self-check-refactored.ts` 新增 "Intelligence Growth P0 Offline Gate" 检查、`WORKING-CONTEXT.md` 第 8 项更新、本计划顶部状态更新

Slice A–D 之后的 P0 加固 gate 也已纳入离线质量门禁，仍不改变 P1+ No-Go：

| Gate | 命令 | 当前作用 |
|------|------|----------|
| Chain Integrity | `npm run eval:intelligence-growth-chain` | 原生串联 tenant signal → review packet → weekly scorecard → decision outcome → learning requeue，验证链路连续性 |
| Cycle Advance | `npm run eval:intelligence-growth-cycle-advance` | 把 learning requeue 候选物化为下一周期 intake，验证 source / scope / window / authority 不漂移 |
| Fixture Lint | `npm run eval:intelligence-growth-fixture-lint` | 验证核心 fixture、tenant signal、decision outcome、learning requeue 的引用完整性和边界字段 |
| Dimension Saturation | `npm run eval:intelligence-growth-dimension-saturation` | 验证下一周期 intake 覆盖 10 个智能维度且不偏科 |
| Remediation Roundtrip | `npm run eval:intelligence-growth-remediation-roundtrip` | 验证 continue / revise / blocked / stop 不在下一轮被错误升级 |
| Cost / Model / Tool Budget | `npm run eval:intelligence-growth-budget-gate` | 验证离线候选都有预算 envelope，模型 / token / 工具 / wallclock 不越界 |
| Determinism | `npm run eval:intelligence-growth-determinism` | 对 core eval + 18 个派生 gate 连跑 3 次，除 `runAt` 外不允许 volatile 字段 |
| Boundary Static | `npm run eval:intelligence-growth-boundary-static` | 机械拒绝 DB / Prisma、API route、Next server、production query、LLM env、network call 进入 IGS P0 |
| Eval Replay Snapshot | `npm run eval:intelligence-growth-eval-replay-snapshot` | 固定 18 个 gate 的 contract-level canonical summary，防止输出漂移 |
| Schema Drift | `npm run eval:intelligence-growth-schema-drift` | 固定 TS union、contracts registry、fixture-lint sentinel、fixture keyset、snapshot keyset 与 snapshot version，防止契约形状漂移 |
| Failure Taxonomy Coverage | `npm run eval:intelligence-growth-failure-taxonomy-coverage` | 固定 10 个 taxonomy 文档与 30 个负例 fixture 的映射，防止负例与失败归因脱钩 |
| Data Protection Pre-Review Manifest | `npm run eval:intelligence-growth-data-protection-manifest` | 固定 18 个 IGS fixture JSON 的字段级 redaction manifest；所有 DP 状态保持 pending，gate green 不代表 DPO approval |
| Required Reviewer Approval Readiness | `npm run eval:intelligence-growth-approval-readiness` | 固定 10 个 P1+ approval readiness packet；所有默认审批状态保持 pending，gate green 不代表 founder / reviewer approval |
| Redacted Live Calibration Evidence Preflight | `npm run eval:intelligence-growth-live-calibration-preflight` | 固定 10 个 redacted evidence package；gate green 不代表 live calibration approval 或 runtime adoption |

**P1+ 前置条件仍是**：真实流量 + Data Protection review + founder approval + required reviewer approval + redacted live calibration evidence，在条件未齐前 runtime / self-learning 继续 No-Go，任何智能维度不得在生产系统中自动改变行为。

---

## 十、变更记录

| 日期 | 变化 |
|------|------|
| 2026-05-02 | 追加 P0 加固 gate ledger：chain / cycle / fixture-lint / dimension / remediation / budget / determinism / boundary-static / eval-replay-snapshot / schema-drift / failure-taxonomy-coverage / data-protection-manifest / approval-readiness / live-calibration-preflight 全部仍为 offline-only、candidate-only，不授权 runtime/self-learning |
| 2026-05-02 | 初始版本；从 HELM_INTELLIGENCE_GROWTH_SYSTEM_PRD.md §四 P0 提取，拆分为四个可实施切片；明确所有切片均不做 DB schema、API、UI、生产 prompt 变更；包含验收标准与验证命令 |
| 2026-05-02 | Slice A–D 全部完成；顶部状态更新为"P0 offline gate 已落地"；九、当前状态与下一步更新为 Slice A–D 完成记录；P1+ No-Go 边界维持 |
