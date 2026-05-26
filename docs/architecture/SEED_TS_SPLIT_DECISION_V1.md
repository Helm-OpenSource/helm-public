---
status: active
owner: helm-core
created: 2026-05-08
review_after: 2026-08-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# prisma/seed.ts 拆分决策 V1

状态：deferred-to-p3 / decision-recorded
日期：2026-05-08
受众：Helm 工程团队（dev / db / e2e infra owners）
继承：R5 走查 / R8 PR 清单（PR-08）

> **本文目的**：R5 标定 `prisma/seed.ts` 5622 行 monolith「扩到 6-8 行业 ≈ 1 万行不可维护」。R8 PR-08 列为 P1 5d 重构。本文落定**推 P3**决策，理由与 PR-03 InternalOperatingHome / PR-05c sendability 目录改名 won't-fix 同模式：dev-only 工具，拆分是工程整洁性收益、不是客户面价值，风险大于收益。

---

## 一、现状

`prisma/seed.ts`：5622 行单文件，由 `npm run db:seed` 触发。结构：

| 段落 | 行数（估算）| 内容 |
|---|---|---|
| imports + helpers | ~120 | Prisma enum imports / dateadd helpers / coreWorkers |
| `seedWorkspaceCommercialFoundation` | ~40 | 计费/试用/worker entitlement 注入 |
| `seedSettlementOperationsProofPack` | ~330 | 结算运营证据包 |
| `main()` | ~3500 | 主流程：deleteMany / 创建 reserved workspace / 加载 demo users / 编排 |
| `seedDefaultPolicies` | ~25 | 默认策略 |
| `seedSalesWorkspaceDemo` | ~820 | 销售 demo workspace 全套数据 |
| `seedRecruiterWorkspaceDemo` | ~770 | 招聘 demo workspace 全套数据 |
| `seedFounderWorkspaceDemo`（未直接确认）| ~1000 | 推测 founder demo workspace 同模式 |

R5 担心：扩到 6-8 行业 → 5 个 1000 行 hardcode = 1 万行。

---

## 二、PR-08 推 P3 的三条理由

### 2.1 dev-only 工具，runtime 不依赖

- `prisma/seed.ts` 仅由 `npm run db:seed` / `npm run db:reset` / e2e setup 调用
- runtime / production 不读它
- 客户面零接触
- 拆分对 ¥240k 客户体验**无任何感知**——是工程整洁性收益

### 2.2 拆分风险中等：可能 break db:reset / e2e 全链路

- seed 的 deleteMany 顺序、user/workspace/membership 关联顺序、demoUserMap 跨 function 共享 ——拆出去任一环节出错就让 db:reset 失败
- e2e 全链路依赖 db:reset 干净 — 一旦 break 阻塞所有 PR CI
- 5d 重构涉及 8+ 函数、~3500 行编排逻辑、跨 ~50 个 Prisma model 的 referential 顺序

### 2.3 R5 担心的 "1 万行" 假设不成立（PR-06 已落地证伪）

- **PR-06 实际拆法是 `lib/demo/industry-fixtures/{industry}.ts` 6 个独立文件**，每文件 ~120 行 = 总 720 行新增
- **不再往 `prisma/seed.ts` 内部塞行业数据**（PR-A1 实施时已用 private implementation-console seed 独立路径，不动 seed.ts monolith）
- 后续行业扩展继续走 `industry-fixtures/` + 独立 seed script 模式
- 即使再加 5 个新行业，`prisma/seed.ts` 行数**不会涨**

R5 的"扩到 1 万行"前提（继续往 seed.ts 内塞数据）已经被 PR-06 + PR-A1 的实施路径推翻。**5622 行 monolith 已经是稳态上限**。

---

## 三、决策

**推 P3**。当前不做。

### 3.1 触发条件（什么时候重新评估）

任一触发：
1. `prisma/seed.ts` 行数因新增功能涨到 **8000+**（当前稳态 5622）
2. `db:reset` / `db:seed` 频繁出问题（>2 次/月需要紧急修补）
3. 新工程师 onboarding 反馈"读不懂 seed.ts"（≥3 次正式反馈）

### 3.2 P3 排期建议（如触发）

- 工时：5 d 单人单线 / 3 d 三人并行
- 拆分目标：
  - `prisma/seeds/main.ts`（主编排，≤500 行）
  - `prisma/seeds/foundation.ts`（commercial foundation + settlement，~400 行）
  - `prisma/seeds/policies.ts`（~25 行）
  - `prisma/seeds/sales-demo.ts` / `prisma/seeds/recruiter-demo.ts` / `prisma/seeds/founder-demo.ts`（各独立）
- 验收：`npm run db:reset` 行为完全等同 + e2e 全绿 + seed 总耗时不增加 >10%

### 3.3 不在范围

- 不动 `seed-implementation-console.ts`（PR-A1 已独立 script，本就不在 seed.ts 内）
- 不动 `lib/demo/industry-fixtures/`（PR-06 已模块化）

---

## 四、关键人物

- 决策 owner：Helm 实施经理 / 工程基础设施 owner
- 触发条件监控：dev infra 团队（监控 db:reset 失败率、seed.ts 行数变化）
- P3 启动 owner：单独排期时分派

---

## 五、变更记录

- **2026-05-08 V1**：基于 R5 走查标定 + PR-06 / PR-A1 实施路径选择（不再往 seed.ts 塞数据），落定 PR-08 推 P3。R8 PR 清单 14 个 PR 中 PR-08 是唯一推 P3 的工程基础设施项；其他 13 个全部已完成 / won't-fix（与本文所属 architecture decision 集对齐）。
