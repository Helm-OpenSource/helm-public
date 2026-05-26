---
status: archived
owner: helm-core
created: 2026-03-27
review_after: 2026-09-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# PROACTIVE_COLLABORATION_BASELINE_FREEZE_REPORT

## 当前基线定义

当前版本的 proactive collaboration mechanism 已经冻结成一版最小可复用协作层。它不是完整 workflow / orchestration 平台，而是 Helm 如何在“先准备、再请求、再升级、最后由人拍板或监督”的前提下，把事项送到正确 owner、worker 和审阅链路前。

## 冻结的核心语义

- `collaborationMode`
- `collaborationRequest`
- `collaborationSummary`
- `collaborationReason`
- `collaborationBoundary`
- `collaborationOwner`
- `collaborationWorkerAssignment`
- `collaborationEscalationHint`
- `collaborationDecisionRequest`
- `collaborationNextStep`

## 当前成立程度

### Helm 推进，人类监督

- 已成立。
- 当前代表：proposal / package shaping window。
- 适合 sales / delivery 协作场景。

### Helm 准备，人类拍板

- 已成立。
- 当前代表：worker internal draft -> review / approval request。
- 适合 approval / review 场景。

### Helm 提醒，人类主导

- 已成立。
- 当前代表：founder risk / priority decision request。
- 适合 founder 主拍板场景。

## 当前版本基线

1. `collaborationMode` 三分法已经固定。
2. `owner / worker assignment / escalation / decision request / next step` 的表达位置已经固定。
3. 协作仍默认挂在 workspace、membership、approval actor、operator decision、replay / audit / memory 上。
4. recommendation 与 commitment 边界已经固定进 collaboration boundary。

## 协作归属与入口

### 只适合 internal-only

- internal clarification
- review package preparation
- evidence bundle preparation
- boundary note generation

### 可以拉起 worker

- follow-up framing
- proposal shaping draft
- review preview preparation
- risk / dependency / boundary note generation

### 必须拉起人工

- 高风险外发
- commitment hardening
- customer-facing wording 定稿
- 关键状态变更
- 不可逆动作

### 当前已接入角色

- founder
- sales
- delivery
- operator

### 当前已清楚但仍未完全落地的角色

- customer success

## 不允许继续模糊写“支持主动协作”

当前已经能明确说清：

1. 由谁接：
   - founder / sales / delivery / operator
2. 为什么现在要接：
   - because risk, stage, trust boundary or worker output has crossed a visible threshold
3. 接完做什么：
   - review, choose next move, hold boundary, escalate, or let a safe next action continue
4. 何时升级：
   - risk rises, wording hardens, commitment becomes real, or trust-sensitive execution appears
5. 何时停止：
   - when no live candidate crosses the collaboration threshold
6. 何时需要拍板：
   - when a recommendation is about to become execution, stage hardening or customer-facing commitment

## 刻意未做

1. 完整 orchestration 平台。
2. 完整 workflow engine。
3. 全站统一 collaboration inbox。
4. 高风险自动发送或自动承诺。

## 下一层候选

1. customer success expansion review 主动协作。
2. 统一 worker assignment / handoff 视图。
3. 更完整的 contacts / companies / meetings / inbox 协作入口。

## 结论

- proactive collaboration 当前基线已经清楚。
- 责任、升级、拍板、下一步表达已经足够稳定可冻结。
- 当前仍必须明确写成 minimal collaboration layer，而不是完整 orchestration 平台。
