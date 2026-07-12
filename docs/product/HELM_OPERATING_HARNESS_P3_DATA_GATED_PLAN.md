---
status: draft
interface_status: planning contract; P3 implementation is not authorized
owner: Product / Delivery Engineering / Engineering
created: 2026-07-12
review_after: 2026-08-12
public_safety: Public-safe aggregate readiness evidence and deferred architecture only. No customer data, production connector, model training, online learning, automatic adoption, writeback, external send, approval, commitment, or memory promotion.
---

# Helm Operating Harness P3 Data-Gated Plan / P3 数据门控升级计划

> **语言 / Language**: **中文主文本** + **English reference**

## 1. 当前裁决

当前裁决是 **`not_ready`**。P0、P1、P2 已形成 public-safe implementation 与堆叠 PR，
但尚未形成足够的多版本、多对象、多独立 held-out、去人名 self-dogfood、反馈转 eval、校准和
rollback drill 证据。时间经过、模型参数升级或增加 synthetic case 都不能替代这些证据。

P3 readiness evaluator 只允许两个结果：

- `not_ready`
- `ready_for_p3_design_review`

后者也不等于批准实现、发布或获得生产权限。固定边界是：

```text
ownerReviewRequired = true
ownerApprovalRecorded = false
implementationTriggered = false
productionAuthorityGranted = false
```

运行当前门：

```bash
npm run eval:operating-harness-p3-readiness
```

也可以传入一份 public-safe aggregate evidence JSON：

```bash
npm run eval:operating-harness-p3-readiness -- /path/to/evidence.json
```

消费者必须使用 report-binding validator 将报告重新从 evidence 计算；单独验证一份自洽 report
不足以证明 readiness。

## 2. P3 要解决的问题

P0-P2 已经证明 canonical signal spine、派生状态、manifest composition、shadow eval 和一次受治理
改进闭环。P3 的目标不是增加一个更大的 prompt，也不是宣布“企业世界模型已经成立”，而是验证：

1. Helm 能否从跨时间、跨业务对象的 canonical records 派生一个可重放的 operating-context read
   model；
2. 在不引入第二真相源的前提下，能否表达对象关系、时间变化、证据路径、冲突和不确定性；
3. 模型辅助的 hypothesis/ranking 是否在多个未见 held-out 集上持续超过强规则 baseline；
4. 所有输出是否仍然停在 advice、human review 和 owner gate 之前。

因此 P3 的准确名称是 **Enterprise Operating Context Model**，不是权威 Enterprise World Model。
现有 Prisma `WorldModelSnapshot` 在 P3a 不迁移、不成为写路径；后续只能通过 adapter 被解释为
legacy derived snapshot。

## 3. 进入门槛

阈值由 `policy:operating-harness-p3-readiness-v1` 固定，并从 evidence arrays 派生，调用方不能直接
填“readiness score”。

| Gate | Required evidence |
| --- | --- |
| Prerequisites | P0、P1、P2 均已 merge 到 main，带 gate ref/hash |
| Owner attestation | owner-review receipt + registry snapshot hash + trusted ordering timestamp |
| Qualifying runs | 至少 5 个；均为 fresh-heldout、weakness replayed、owner-reviewed candidate |
| Independent B | 至少 5 个不同 set ref，且至少 5 个不同 content hash |
| Revisions | 至少 3 个 candidate revision |
| Business objects | 至少 3 个 object kind |
| Source families | 至少 2 个；客户 fleet 与 OSS 为 0 |
| Operational de-identified | 至少 3 个去人名 self-dogfood / promoted operational run |
| Recent stability | 最近 3 个 run 全部通过，且每个 held-out lift `>= 0.05` |
| Calibration | qualifying sample 总数 `>= 100`，每个 run `>= 10`，weighted ECE `<= 0.10` |
| Evidence | 所有窗口 run 的最低 evidence coverage `>= 0.90` |
| Human review | 所有窗口 run 的 reviewer completeness `= 1.0` |
| Boundaries | boundary incident 总数 `= 0`，protected mutation `= 0`，production authority `= 0` |
| Feedback | eligible edit/reject `>= 30`，promoted eval cases `>= 10`，conversion `>= 0.30` |
| De-identification | 至少 3 个 scanner clean + human signoff + performance wall promotion receipt |
| Recovery | 至少 2 个不同 candidate 的 kill-switch + exact fallback restore + owner-reviewed drill |

Rejected/inconclusive run 不能用大样本稀释 calibration；重复 receipt、重复 signoff、同一 owner review
跨 run/rollback/attestation 复用均失败。窗口必须完整，run 时间必须在窗口内，窗口不能晚于 `asOf`。

## 4. 不可改变的架构约束

```text
Canonical facts
SignalEvent -> EvidenceRef -> BusinessObjectAlias
                               |
                               v
                     JudgementPacket -> FeedbackRecord
                               |              |
                               v              v
                     EvalCasePromotion -> held-out registry
                               |
                               v
                  derived temporal operating context
                               |
                               v
                shadow hypothesis / ranking proposal
                               |
                               v
                         human + owner review
```

约束：

- canonical objects 仍是唯一事实入口；context snapshot 是可丢弃、可重建的 read model；
- lifecycle state 继续由 canonical chain 派生；P3 不允许 snapshot 反写 canonical state；
- 每个 relation、trend、hypothesis 和 score 都必须有 evidence path、time window、source policy 和
  uncertainty；
- privacy、source governance、permission、evaluator、held-out registry、owner-promotion gate、kill
  switch 和 memory governance 永远在 evolution loop 之外；
- customer fleet 仍只允许 operator triage，不能进入 model improvement；
- self-dogfood 在进入 registry 前必须去除 person-level attribution，并通过现有 promotion gate；
- OSS governance 仍是 non-goal，不进入 Helm tenant 或 operating context。

## 5. P3 合同草案

P3 设计评审通过后，优先定义下列 additive public contracts；名称仍可在评审中调整：

### 5.1 `TemporalOperatingContextSnapshot`

- `workspaceAlias` / tenant scope；
- content-bound canonical record refs；
- `windowStart` / `windowEnd` / `asOf`；
- object summaries、evidence paths、conflicts、staleness；
- projector version、manifest revision、source-policy refs；
- `derivedOnly=true`、`writebackAllowed=false`、`actionAuthority=none`；
- replay root hash。

### 5.2 `OperatingRelationEdge`

- from/to `BusinessObjectAlias`；
- closed relation kind；
- supporting / contradicting evidence refs；
- temporal validity；
- deterministic or model-assisted provenance；
- calibrated confidence，不允许模型自报 confidence 直接进入路由。

### 5.3 `OperatingHypothesisPacket`

- observation、interpretation、counter-evidence 分离；
- hypothesis 不是 fact，不进入 canonical memory；
- advice-only、human-review-required；
- forbidden action refs 为空；
- model/policy/manifest version pinned；
- owner-review packet 之前不能被采用。

### 5.4 `ScenarioProjection`

- 只做 bounded counterfactual，例如“若 reviewer backlog 持续两个窗口，哪些对象可能受影响”；
- 显式 assumptions、horizon、uncertainty 和 invalidation conditions；
- 不生成承诺、预算批准、人员绩效判断或自动动作。

## 6. 实施切片

### P3a - Public Context Contract

仓库：`helm-public`。

- additive contracts、strict validators、synthetic temporal fixtures；
- deterministic projector：canonical records -> context snapshot；
- content-addressed replay；
- legacy `WorldModelSnapshot` read adapter，仅用于迁移审计；
- rule baseline 与 held-out eval；
- 不接 DB、不调用模型。

退出标准：相同 canonical input + manifest 必须生成同一 snapshot hash；任何 cross-tenant、raw/private、
state-authority、writeback 或 unsupported relation 输入 fail closed。

### P3b - Operational Evidence Registry

仓库：`helm-control-plane`，须另开需求与 owner review。

- 从真实 registry 生成 readiness evidence，而不是人工填写 scalar；
- owner attestation、trusted timestamp、window completeness、receipt resolution；
- 复用现有 usage/cost/rate-limit 与 consent；
- 只存 aggregate refs/hashes 到 public-facing proof；原始 self-dogfood 数据留在本地边界。

退出标准：readiness report 可以从 registry snapshot 重放；删除或篡改任一 run/feedback/promotion/drill
都会改变 hash 并降级为 `not_ready`。

### P3c - Cross-Object Deterministic Baseline

仓库：`helm-public`，行业 object kind 扩展属于 `helm-packs`。

- 先用 temporal rules / graph traversal 建强基线；
- 输出 relation edge、conflict 和 evidence path；
- 对比单对象 fusion 与跨对象 baseline；
- Pack 只能通过 Core SDK 增加 public-safe relation vocabulary，不能反向改变 Core gate。

退出标准：跨对象 read model 在未见 B 集上有可计算 lift，且 boundary / evidence / reviewer 不回归。

### P3d - Model-Assisted Shadow Adapter

运行时仓库：`helm-control-plane`；public 只保留 provider-neutral contract 和 synthetic eval。

- 只有当 deterministic baseline 无法达到预注册目标时才引入模型；
- 模型只生成 hypothesis/ranking candidate；
- 固定 model/version/decode/context policy；
- 输出必须经过 deterministic validator、citation/evidence gate、calibration 和 shadow comparison；
- 不能改 evaluator、threshold、gold、permission、privacy 或 owner gate。

退出标准：至少三个全新 B 集上持续超过上一版专家与强规则 baseline；ECE、evidence、reviewer、boundary
同时达标。tie 或一次性 lift 不能证明模型复杂度合理。

### P3e - Owner-Gated Dogfood Pilot

仓库：`helm-control-plane`；customer overlay 不在首轮。

- 仅 Helm self-dogfood、明确 consent、去 person attribution；
- read-only monthly diagnosis；
- owner 手工 accept/edit/reject/defer；
- correction -> de-id promotion -> new held-out；
- kill switch、fallback、cost guard 和完整 audit。

退出标准：连续窗口满足 readiness policy；任何事故立即回到 deterministic baseline。客户 pilot 必须另行
设计，不由 self-dogfood 自动外推。

## 7. 算法与模型选择原则

弱信号不等于必须使用神经网络。P3 的顺序固定：

1. deterministic temporal aggregation；
2. calibrated rule / graph baseline；
3. 只有出现可量化 residual error，才评估 statistical 或 neural model；
4. 模型必须在全新 held-out 上同时超过上一版与强规则 baseline；
5. 模型复杂度若没有带来严格 lift，结论是 `inconclusive`，不是继续堆模型。

Helm 的护城河指标仍是：signal recall、precision、evidence coverage、reviewer completeness、boundary
incident count、held-out lift、feedback-to-eval conversion rate。P3 增加 calibration 和 temporal/cross-object
coverage，但不把“参数更多”或“模型更强”当指标。

## 8. 发布与回滚

P3 每一代都必须满足：

- 新 candidate 使用新 B；旧 B 一经看见即转 development；
- gold 在 candidate 创建前锁定；
- manifest、model、context policy、skill/tool binding 全部 pinned；
- shadow 通过只进入 owner review；
- owner decision 与 production promotion 分离；
- kill-switch 后显式显示 degraded/disabled，不静默删除 health view；
- rollback 恢复 exact manifest hash，并留下 owner-reviewed receipt。

立即停止 / rollback 条件：

- 任一 boundary incident；
- raw/private/person-level 数据进入 public/eval；
- customer fleet 或 OSS source 进入 improvement；
- evidence coverage 或 reviewer completeness 低于门槛；
- ECE、held-out lift 或 feedback conversion 连续回退；
- protected component 被 candidate 修改；
- owner gate、write/send/approve/memory promotion 权限出现非预期 true；
- readiness window 不完整或 receipt 无法重放。

## 9. 明确不做

- 不把状态表或 snapshot 变成 canonical truth；
- 不训练客户数据，不做跨租户学习；
- 不把 GitHub contributor/community data 产品化；
- 不建立自动执行平面、完整 workflow engine 或通用 agent orchestration；
- 不自动对客发送、承诺、批准、写回、付款或 memory promotion；
- 不以 self-tenant 通过宣称可泛化到客户；
- 不以 synthetic ready-shape unit test 宣称真实 readiness；
- 不在 P3 readiness gate 自动创建实现任务或切 feature flag。

## 10. 诚实声明

readiness evidence 中的 owner receipt ref、registry hash 和 trusted time 在 public offline evaluator 中只能做
格式、内容绑定和相对时序检查，不能验证外部签名或真实 wall clock。真实 P3 启动必须由 control-plane
registry resolver 与 owner 手工核验承担这最后一层真实性。通过 public evaluator 只表示输入在声明前提下
满足门，不表示声明本身来自真实生产系统。

## English Reference

P3 is deferred until a data-based readiness policy passes. Its first target is a replayable,
derived enterprise operating-context read model, not an authoritative world-state store. The gate
requires merged P0-P2 prerequisites, five independent qualifying held-out runs, stable recent lift,
calibration, evidence and reviewer completeness, zero boundary incidents, sufficient feedback-to-eval
conversion, de-identified operational receipts, and successful rollback drills. Passing means only
`ready_for_p3_design_review`; owner approval, implementation, adoption, and production authority remain
false. Any later model-assisted reasoning stays shadow-only and must beat both the previous expert and a
strong deterministic baseline on unseen data.

## 变更记录 / Change Log

| Date | Change |
| --- | --- |
| 2026-07-12 | Created the data-gated P3 readiness policy, deferred architecture, implementation slices, and abort conditions |
