# Cross-System Accountability Gap MVP — public-safe reference pack

> Spec: [`docs/product/HELM_CROSS_SYSTEM_ACCOUNTABILITY_GAP_MVP.md`](../../docs/product/HELM_CROSS_SYSTEM_ACCOUNTABILITY_GAP_MVP.md)

确定性、只读、review-first 的跨系统问责真空检测参考实现。检测"本应存在、却无人可问责"的
跨系统经营缺口(如 won deal → N 天内应有 delivery/handoff 记录),并交回人工复核。

Deterministic, read-only, review-first detection of cross-system accountability gaps. No AI
synthesis, no connectors, no auto-create/dispatch/chase/write/send/approve. All data synthetic.

## 核心不变量 / Core invariants
- **coverage 是整数核心**:所需源系统无法证明完整 → verdict `unknown`,**绝不** `missing`。
- **owner 确定性**:无 accountable user → 走 escalation 角色,**绝不猜人**;group/admin/bot/departed 不算。
- **append-only ledger**:`prevEntryHash` 哈希链,tamper-evident。
- **advice-only / read-only**:每条命中只进 review-first decision request。

## 跑法 / Run
```bash
npm run eval:cross-system-accountability-gap
```
读 `templates/cross-system-accountability/scenario.sample.json`(synthetic),逐 scenario 打印 decision requests。

## 布局 / Layout
```
lib/cross-system-accountability/
  contracts.ts   # 5 契约 + enums
  coverage.ts    # coverage 门(unknown vs missing)
  owner.ts       # EffectiveOwner 确定性判定 + escalation
  engine.ts      # 确定性检测引擎
  ledger.ts      # append-only 哈希链(复用 expert-capability/hashing)
  validators.ts  # §13 fail-closed 校验
  metrics.ts     # §10 度量(cross-system share / FP rate / new-gap rate)
templates/cross-system-accountability/scenario.sample.json  # synthetic 全路径样本
scripts/cross-system-accountability-gap-eval.ts             # 离线 CLI
```
