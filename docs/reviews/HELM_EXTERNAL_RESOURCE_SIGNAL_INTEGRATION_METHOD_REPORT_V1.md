---
status: archived
owner: helm-core
created: 2026-04-27
review_after: 2026-10-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm External Resource Signal Integration Method Report V1

状态：Docs-only planning closeout
Owner：Helm Core
日期：2026-04-27

## 1. 目标

本轮把“外部资源接入 Helm 并转化为企业经营信号”的用户想法收成一份可执行的方法文档。

本轮只做：

- 四类外部资源分类
- 统一接入方法
- 实施步骤
- file-based implementation kit 形态
- POC 建议
- Go / No-Go 与边界
- 文档索引同步

本轮不做：

- runtime extractor
- Prisma schema migration
- API route
- UI 改动
- provider 接线
- official write
- 自动发送、自动审批、自动承诺、自动执行

## 2. 交付物

新增：

- [`docs/product/HELM_EXTERNAL_RESOURCE_SIGNAL_INTEGRATION_METHOD_V1.md`](../product/HELM_EXTERNAL_RESOURCE_SIGNAL_INTEGRATION_METHOD_V1.md)

同步：

- [`README.md`](../../README.md)
- [`docs/README.md`](../README.md)

## 3. 方案摘要

本轮固定的核心链路是：

```text
source signal
  -> source contract
  -> normalization / projection
  -> judgement
  -> review packet
  -> Must Push / report / briefing / action intent
  -> receipt / follow-through
  -> memory write-back
```

四类外部资源分别承担不同信号职责：

| 资源类型 | Helm 中的职责 |
| --- | --- |
| 业务系统 | 对象状态、阶段、负责人、SLA、履约与风险 |
| 管理报表系统 | 指标、趋势、异常、阈值、经营缺口 |
| 沟通协作系统 | 承诺、等待、阻塞、决策、会议结论 |
| 文档知识系统 | 策略依据、制度约束、合同证据、历史复盘 |

方法文档把后续实施工具收成：

- `resource-intake.json`
- `source-contract.json`
- `mapping.json`
- `signal-rules.json`
- `review-packet.json`
- dry-run evaluator
- review packet generator

## 4. 受影响组件

本轮没有改 runtime 组件。

后续若进入实现，优先复用：

- `lib/connectors/*`
- `lib/imports/*`
- `app/api/connectors/*`
- `app/api/imports/*`
- `report-skills/`
- `/imports`
- `/reports`
- `/operating`
- `/approvals`

后续第一轮仍不新增：

- `integrations/`
- `features/intelligence/`
- vendor-specific canonical tables
- generic `BusinessObject` table
- workflow builder
- broad notification center

## 5. 状态短表

| 分类 | 当前结论 |
| --- | --- |
| 已经完整成立 | 外部资源信号化接入的分类、方法、边界、阶段计划与评审后 P1/P2 收口已经落成 planning contract |
| 已成形但仍需下一层 | implementation kit 模板、dry-run evaluator、review packet generator、release-readiness correction 命名对齐、Phase 3 gated Must Push runtime gate 尚未实现 |
| 刻意未做 | 不做 runtime、schema、API、UI、provider 接线、official write 和自动执行 |
| 风险项 | 若第一条 POC 没有真实业务 owner、脱敏样例、watch-only sample 和 rejection fixtures，容易退回泛 connector / BI 展示 |

## 6. 评审后修正

针对 2026-04-27 的 review verdict，本文档已补 6 类收口：

1. 增加 review gate banner，明确进入 Phase 1 前必须重新对齐 launch plan §2.2 / §2.4、private tenant separation plan 与 Phase 3 runtime enablement review；release-readiness correction 文档若后续落库，命名决策优先。
2. 增加“概念合约与已落库模型映射”，把 `memory candidate`、`SkillSuggestion`、`ActionIntent`、`ReviewBundle`、`OfficialWriteIntent`、`ExecutionReceipt` 区分为 conceptual contract、已落库 model 或需 ADR 的名称。
3. 明确当前五月窗口只有 TPQR-001 / TPQR-003 / TPQR-004 可在满足 Phase 3 runtime enablement 前置后进入 `/mobile` Must Push；`metric_anomaly / missing_evidence / risk_escalation / knowledge_conflict` 只能进入 review packet、operating brief、weekly report 或 evidence readout。
4. 增加租户专属接入边界：通用方法留在 `external-resource-kit/`，租户专属 connector、route、SQL、字段映射和凭据说明留在 `extensions/<tenant-key>/` 或私有租户仓库，并继承 launch plan §2.2 的公开仓库剥离要求。
5. 写死 `external-resource-kit/` 与 `report-skills/` 分工：前者只放 intake / source contract / mapping / signal rules / review packet，后者继续拥有 BI report skill 的 SQL / schema / metrics / criteria / prompt / message template truth。
6. 把 business owner sign-off、sample provenance、positive / rejected / watch-only fixtures、rejection coverage 和 AGENTS.md §10 验证链继承写进 Phase 0 / Phase 1 / validation gates。

### 6.1 第二轮评审后补强

针对 cd530ad40 后的第二轮 review verdict，本文档继续补 5 个不阻塞 Go 的 V1.1 级细节：

1. 头部 review gate 写入预期 release-readiness correction / verification 文件名；当前仓库尚未落库对应文件时不建立失效 Markdown 链接。
2. `ActionIntent` 行按本地 schema-grep 结果标注为“当前 schema-grep 未发现同名 model”，继续要求进入实现前映射到既有 governed action / `HumanActionExecution` / `ApprovalRequest` / `OfficialWriteIntent` 或先补 ADR。
3. `signal-rules.json` 为 `rejectionRules[]` 增加 `rejectionCategory` taxonomy：`workspace_boundary | sensitivity | missing_evidence | stale_source | write_authority | other`，并要求 `other` 补 rationale。
4. Current-main gap 扩展到 `lib/imports/`、`app/api/connectors/` 与 `app/api/imports/`，避免 Phase 0 inventory 把 CRM / OAuth / DingTalk seams 误写成通用 provider coverage。
5. POC 完成标准 #4 升级为 review packet 必须由 business owner 人工签字接收，补足 review-first 闭环。

## 7. 验证结果

已运行：

```bash
git diff --check
npm run self-check
npm run check:boundaries
```

结果：

- `git diff --check`：通过
- `npm run self-check`：通过，21/21 checks passed
- `npm run check:boundaries`：通过

未运行：

- `npm run db:reset`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

原因：

- 本轮仅新增 planning 文档、收口报告和索引链接，没有 runtime、schema、API、UI、provider 或测试代码变更。

剩余风险：

- implementation kit、dry-run evaluator 与 review packet generator 尚未落地；后续一旦进入代码实现，需要按影响面补齐 targeted tests、typecheck、lint、build 和必要的 e2e / quality regression。

## 8. 下一步建议

1. 新增 `external-resource-kit/` 最小模板资产。
2. 选择第一条 POC：`management-report-metric-anomaly`。
3. 准备 positive / rejected / watch-only fixtures。
4. 实现 dry-run evaluator，只生成 signal candidate 和 review packet。
5. 单独评审是否进入 read-only pilot。
