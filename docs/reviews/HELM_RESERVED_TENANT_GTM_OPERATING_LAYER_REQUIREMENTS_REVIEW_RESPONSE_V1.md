---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Reserved Tenant GTM Operating Layer Requirements Review Response V1

更新时间：2026-04-25
状态：Accepted with adjustments

## 1. 范围

本文件用于评审 Claude Opus 4.7 对以下文档的评审意见：

- 被评审需求：`docs/product/HELM_RESERVED_TENANT_GTM_OPERATING_LAYER_REQUIREMENTS_V1.md`
- Claude 评审：`docs/reviews/HELM_RESERVED_TENANT_GTM_OPERATING_LAYER_REQUIREMENTS_REVIEW_V1.md`

本文件不进入代码实现，不进入 schema 设计。目标是回答两件事：

1. Claude 的评审是否抓住了真正的问题。
2. 哪些意见应进入下一版需求，哪些只能部分吸收，哪些不应直接采纳。

## 2. 总体结论

### Conditional-Accept

Claude 的评审整体质量是合格的，方向判断大体正确，可以作为下一版需求修订输入。

但它不是可以原样照单执行的最终裁定。主要问题有三类：

1. 某些判断抓住了问题，但把建议推得过头了。
2. 某些量化验收标准是假精确，不适合在当前需求层直接写死。
3. 评审内部存在一处状态模型不一致，并且这个不一致已经传导进 V2。

## 3. 接受的判断

以下判断应直接接受：

1. `OperatingControlLineCandidate` 在 V1 中过重，MVP 阶段不应要求销售或 reviewer 一次性结构化太多执行细节。
2. `pain != evidence` 在 V1 中表达了原则，但执行机制不够明确，确实需要 evidence validation 和降级机制。
3. `DiagnosticSession` 的触发条件和与 `CustomerDemandBrief` / control line 的边界需要更清楚。
4. `reserved-only`、`contribution != payable`、`accrual candidate != settlement`、`clean handoff into trial` 这些边界被 Claude 正确识别为核心成立点。

## 4. 部分接受的判断

以下判断抓住了问题，但解决方案需要收敛：

### 4.1 关于 Phase 2 和 Phase 3

Claude 正确指出了 V1 的问题不在于“两个 phase 的名字太多”，而在于：

- 销售不能在同一次客户沟通里被迫跨两个独立产品流程重复录入
- `CustomerDemandBrief` 和 control line candidate 不能形成冗余状态

但这不自动推出“实现计划里必须把两个 phase 合并成一个 phase”。

正确结论应是：

- **产品流必须是一条单一 guided flow**
- **实现切片可以仍然拆成两个阶段**

也就是：

- Phase 2：Sales Lead Intake + Customer Demand Brief
- Phase 3：Control Line Review + Evidence Validation

这样既避免产品体验断裂，也保留工程切片的渐进性。

### 4.2 关于量化验收标准

Claude 正确指出“模板化、多选择、步步推进”不能只停留在定性描述。

但以下指标不适合在当前需求层直接写死：

- 首屏加载时间 `<= 1 秒`
- 点击任意机会 `<= 2 次点击`
- “今天最该推进的机会”固定等于 `3 个`

这些更像原型、实现或性能预算约束，不是当前产品需求的稳定 truth。

应该保留的，是能直接约束产品形态的指标：

- 首次录入目标时间
- 自由文本占比
- 结构化字段占比
- 每步展示问题数
- 首次录入必填字段数

## 5. 不应直接接受的部分

### 5.1 评审内部状态模型不一致

Claude 一方面建议把 `OperatingControlLineCandidate.status` 收敛为：

- `draft`
- `evidence_needed`
- `trial_premise`
- `rejected`

另一方面又在 evidence 降级机制里引入了：

- `ask_human`

这导致评审自身已经不一致，也使 V2 同时出现：

- 对象定义里没有 `ask_human`
- flow 和降级表里却在使用 `ask_human`

这不是小问题，因为它会直接污染后续对象契约、验收标准和实现分工。

因此，V2.1 必须先把状态模型统一，再讨论其它修订。

### 5.2 对“必须合并阶段”的要求过强

如果直接把“体验不该断裂”翻译成“phase 必须合并”，会让 roadmap 失去工程节奏控制。

Helm 当前更需要的是：

- 一条单一 operator flow
- 多个渐进的 implementation slice

而不是为了文档表面简洁，提前压扁阶段。

## 6. V2.1 修订决议

基于本次 review-of-review，V2.1 应做以下修订：

1. 保留 `OperatingControlLineCandidate` 简化后的轻量对象方向。
2. 保留 evidence validation 与 evidence downgrade 机制。
3. 恢复“单一产品流 + 两个实现阶段”的表达，不再强制把 Phase 2/3 合并成一个 phase。
4. 去掉伪精确页面性能 / 点击数指标，只保留能约束产品形态的量化要求。
5. 统一 control line 状态模型，去掉未定义状态与 flow 不一致问题。
6. 明确 GTM 资源收集只会形成 `tenant resource candidate`，真正接入、mapping、trust、capability 仍承接到 tenant resource governance 主线。

## 7. 对后续评审与实现的建议

下一轮专家评审应重点看：

1. `OperatingControlLineCandidate` 的最终最小状态集是否稳定。
2. `CustomerDemandBrief -> Control Line -> Diagnostic -> Trial Initialization` 的 handoff 是否单向、清洗后、无内部数据泄漏。
3. GTM 里的 resource inventory 是否仍然严格从属于 tenant resource governance，而不是形成另一套 connector 体系。
4. 阶段切片是否既能维持产品连续体验，又能维持工程渐进交付。

当前结论：

- 可以继续专家评审。
- 可以继续修订需求。
- 还不应进入代码实现。
