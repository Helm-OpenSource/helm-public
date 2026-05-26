---
status: active
owner: helm-core
created: 2026-04-25
review_after: 2026-07-24
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Reserved Tenant GTM Operating Layer Requirements Review Response V2.2

更新时间：2026-04-25
状态：Accepted with adjustments

## 1. 范围

本文件用于回应以下评审：

- 被评审需求：`docs/product/HELM_RESERVED_TENANT_GTM_OPERATING_LAYER_REQUIREMENTS_V2_2.md`
- Claude 评审：`docs/reviews/HELM_RESERVED_TENANT_GTM_OPERATING_LAYER_REQUIREMENTS_REVIEW_V2.2.md`

本文件不进入代码实现，不进入 schema 设计。目标是把 V2.2 评审真正收口成一版可冻结需求，而不是继续无边界扩张。

## 2. 总体结论

### Accepted with adjustments

这份评审整体质量合格，抓住了 3 个真正值得继续收紧的问题：

1. `CustomerDemandBrief` 有继续膨胀风险。
2. Phase 2 / Phase 3 的 UX 交付边界还应更清楚。
3. `minor / material` 判断最好显式落成规则表。

但其中两条不应原样接受：

1. 不能把 `CustomerContextUpdateRequest` 整体推回“客户不可见”。
2. 不能为了压缩 `CustomerDemandBrief`，顺手删掉 `trialInitializationPayload` 和 `sourceTrace` 这两条 handoff / audit 主线。

## 3. 直接接受的判断

以下判断应直接吸收进下一版需求：

1. `CustomerDemandBrief` 需要进一步区分“核心 handoff 字段”与“确认层派生 / UI 投影字段”。
2. Phase 2 / Phase 3 应补清楚 UX checkpoint，不然工程切片很容易在体验上被误做成两套流程。
3. `CustomerContextUpdateRequest` 需要明确区分：
   - `initial confirmation`
   - `in-usage update`
4. `minor / material` 的判断应有显式规则，而不是只留抽象原则。

## 4. 部分接受的判断

### 4.1 关于 `CustomerDemandBrief` 收紧

Claude 正确指出对象继续膨胀的风险。

但正确做法不是把确认层相关字段全部删掉，而是：

- 保留核心 handoff contract
- 把 UI / phase-specific / derived 字段下沉

因此下一版应：

- 保留：`trialInitializationPayload`
- 保留：`sourceTrace`
- 保留：`customerConfirmationStatus`
- 下沉或标注为 derived / phase-3 read model：
  - `customerEditableFieldSet`
  - `customerConfirmedSummary`
  - `lastCustomerConfirmedAt`

### 4.2 关于 `CustomerContextUpdateRequest`

Claude 正确指出这个对象会承载两类不同使用场景：

- 注册时确认 / 补全
- 使用中改写

但这不意味着对象本身应被客户侧完全隐藏。

正确边界应是：

- 客户可以看到并发起 update request
- 普通客户不可见内部 review queue、materiality 规则细节和内部 reviewer 决策 readout

## 5. 不直接接受的部分

### 5.1 “`CustomerContextUpdateRequest` 不应进入普通客户租户”

这条不能原样接受。

如果客户完全看不到 update request 入口，就无法实现 V2.2 已明确成立的：

- `confirm`
- `supplement`
- `request_change`

因此下一版必须写清：

- 客户侧可见的是 submission surface
- reserved-only 的是 review queue / internal judgement / audit readout

### 5.2 删除 `trialInitializationPayload` / `sourceTrace`

这条不能接受。

原因：

1. `trialInitializationPayload` 是 clean handoff into trial 的核心。
2. `sourceTrace` 是 append-first / review-first 的审计主线。

如果为了瘦对象删掉这两项，会直接损伤需求最重要的边界表达。

## 6. V2.3 修订决议

基于本次 review-of-review，V2.3 应做以下修订：

1. 把 `CustomerDemandBrief` 分成：
   - core handoff fields
   - phase-3 derived / confirmation readout fields
2. 明确 `CustomerContextUpdateRequest` 的两个使用场景：
   - initial confirmation
   - in-usage update
3. 明确客户可提交更新请求，但内部 review queue 仍是 reserved-only。
4. 为 Phase 2 / Phase 3 增加清晰的 UX checkpoint 描述。
5. 为 `minor / material` 增加明确判定表。

## 7. 当前结论

- 需求可以收口。
- 可以形成新的冻结版需求。
- 下一步应进入 implementation planning，而不是继续开放式发散。
- 仍不直接进入 schema / API / 页面实现。
