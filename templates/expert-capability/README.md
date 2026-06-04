# Expert Capability Feedback Loop v0.1 — public-safe reference pack

> 中文主文本 + English reference. Requirements: [`docs/product/HELM_EXPERT_CAPABILITY_FEEDBACK_LOOP.md`](../../docs/product/HELM_EXPERT_CAPABILITY_FEEDBACK_LOOP.md).

这是 v0.1 专家能力反馈闭环的 **public-safe、离线、review-first** 参考实现脚手架。
它只证明一个窄而可证伪的命题:一次来自 A 组的人工纠正,能在 **gold 已提前锁定、
未被复用烧穿** 的 B 留出集上让新版专家超过上一版,且 boundary 零回归。

This is the public-safe scaffold for the v0.1 expert-capability feedback loop. It does
not use customer data, automatic learning, writeback, external send, approval, or memory
promotion. Passing it proves only a bounded existence case — not generalization,
production readiness, statistical significance, or a completed moat.

## 边界 / Boundaries

- 所有 packet 的 `commitmentClass` 恒为 `advice`,且不可触发执行 / 外发 / 写回 / 审批 / memory 晋升。
- 所有样本均为 **synthetic、public-safe**;不含真实客户、真实人员或凭据。
- 实现工件全部属于 **public Core(helm-public)**;control-plane / overlays / packs 不在本闭环内,互不越界。

## 目录 / Layout

```
templates/expert-capability/
  schema/                 # 6 个契约的 public-safe 示例实例 + correctionReasonCode 枚举
  packs/                  # A 纠正集 / B 留出集(含 synthetic non-self + boundary-trap)
  evaluator.js            # 无依赖离线 evaluator(loop_compounding / expert_justified 双裁决)
lib/expert-capability/    # TS validators + vitest 测试(§15 / §16.4)
```

## 跑法 / Run

```bash
npm run eval:expert-capability-feedback-loop
```

evaluator 读 `packs/pre-registration.json` + A/B 样本 + 两个 baseline,输出:

- `loop_compounding`: `success | inconclusive | fail`(对照上一版专家)— **v0.1 成功门**。
- `expert_justified`: `pass | inconclusive(expert_vs_rules) | fail`(对照强规则 baseline)— 单独报告。
- 任一 boundary / commitment 硬门失败 → 整体 `fail`,不得用加权分抵消。

## 防泄漏不变量 / Anti-leakage invariants

evaluator 与 validators 强制:`A ∩ B = ∅`;`goldLockedAt < candidateRevision.createdAt < evaluationRun.ranAt`;
attempt budget;consumed-B 不得跨候选复用;`evidenceCompleteness` 独立计算、禁 ref 灌水。
