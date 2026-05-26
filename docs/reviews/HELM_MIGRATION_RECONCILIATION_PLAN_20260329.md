---
status: active
owner: helm-core
created: 2026-03-29
review_after: 2026-06-27
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Migration Reconciliation Plan (2026-03-29)

## 1. 为什么这是 reconciliation，不是 replay

这轮工作处理的是另一台机器遗留的 12 个本地提交。

它们代表的是一轮架构收口意图，而不是必须原样落地的代码。

因此本计划遵守 4 条硬规则：

1. 不机械 cherry-pick 旧提交
2. 不做 mass rebase
3. 不恢复旧本地 `apps/helm-app` / `packages/helm-control` 目录形状
4. 只迁移对当前主干仍然成立的 ownership / guard / query descent intent

一句话规则：

**迁移意图，不迁移目录形状。**

## 2. 当前主干 reality

当前主干不是旧本地 `helm/` 子目录结构，现实是：

1. 根目录 `app/` 仍是当前真实 route owner
2. `data/queries.ts` 仍是当前真实兼容 façade / aggregation seam
3. 当前主干没有可执行目录叫 `apps/helm-app`
4. 当前主干没有可执行目录叫 `packages/helm-control`
5. shell thinning 是 late-stage only，不能早做

## 3. 已经在当前主干满足的部分

- 旧本地 12 提交的 archive/reference 已保留在
  - [LOCAL_HELM_MIGRATION_CHECKLIST_20260329.md](LOCAL_HELM_MIGRATION_CHECKLIST_20260329.md)
- 主链 / 演示链 / query hot path / render handoff 的守卫已先期迁入当前主干
- 当前仓库已经有：
  - `npm run self-check`
  - `npm run check:boundaries`
- 当前主干已经明确保留：
  - `app/` 是 owner
  - `data/queries.ts` 是真实 seam

## 4. salvage matrix

| old commit | architectural intent | still relevant on current main? | action | affected files or seams | risk level |
|---|---|---|---|---|---|
| `1df6a9f` | 把主链 route-level server 装配从厚 page 里抽出来 | partial | manual forward-port | `app/(workspace)/dashboard/page.tsx`、`approvals/page.tsx`、`opportunities/page.tsx`、`memory/page.tsx`、`meetings/*` | medium-high |
| `cfe4985` | dashboard read-model 从中心查询面下沉 | yes | manual forward-port | `data/queries.ts`、`app/(workspace)/dashboard/page.tsx`、新 query seam | medium |
| `3afa6c1` | owner seam 站稳后再折叠中间 route-owner 层 | partial | archive only | 这是 late-stage 结构折叠，不应早做 | high |
| `6eb7373` | opportunities / memory route-level 装配抽薄 | partial | manual forward-port | `app/(workspace)/opportunities/page.tsx`、`memory/page.tsx` | medium-high |
| `862b048` | meetings list/detail route-level 装配抽薄 | partial | manual forward-port | `app/(workspace)/meetings/page.tsx`、`meetings/[id]/page.tsx` | medium-high |
| `dbae6b6` | object detail routes 的 route-level 装配抽薄 | partial | manual forward-port | `contacts/[id]`、`companies/[id]`、对象 detail seams | medium-high |
| `eadd64c` | 把剩余页面整体推入新 app tree | partial | archive only | 过宽，且当前主干没有第二 app tree | high |
| `cd74a6d` | 对象详情查询从 `data/queries.ts` 下沉 | yes | manual forward-port | `data/queries.ts`、`contacts/[id]`、`companies/[id]`、`inbox/[id]` 等 detail query seams | medium |
| `f9a9815` | auxiliary routes 的 route-level 装配整体迁移 | partial | archive only | 可以后做，但不应作为早期 reconciliation 动作 | medium-high |
| `0e07bf8` | supporting queries 从 `data/queries.ts` 下沉 | yes | manual forward-port | `layout`、`settings`、`search`、`inbox`、`features/imports/queries.ts` pattern | medium |
| `42ead26` | ownership / query seam 站稳后再做 query bridge 删除和 layout 内联 | partial | archive only | shell thinning late-stage only | high |
| `09c638b` | loading / error / not-found 壳层收薄 | partial | archive only | shell thinning late-stage only | high |

## 5. approved landing order

### Phase A

- docs
- reconciliation plan
- guards
- self-check
- boundary audit
- 当前状态：已完成并验证通过
- 验证：
  - `npm run self-check`
  - `npm run check:boundaries`
  - `npm run typecheck`
  - `npm run lint`

### Phase B

- read-model descent
- 但保留 `data/queries.ts` 作为 compatibility façade
- 当前状态：已完成并验证通过
- 计划切片：
  - B1：dashboard / approvals（已完成并验证通过）
  - B2：opportunities / memory / meetings / meetings/[id]（已完成并验证通过）
  - B3：contacts / companies / inbox / settings / search / layout supporting queries（已完成并验证通过）
- 说明：
  - B2 与 B3 在当前主干里共享同一个 `data/queries.ts` façade 和同一组 route/query boundary 守卫。
  - 因此实际落地时以一个连续的 query-seam batch forward-port，而不是为了追求旧切片形状去硬拆 commit。
  - 当前结果仍然遵守 Phase B 原则：`data/queries.ts` 保留为兼容 façade，route owner 与 shell 并未在这一阶段迁移。

### Phase C

- route-level assembly thinning
- 根 `app/` 仍保留 owner 身份
- 当前状态：已完成并验证通过
- 计划切片：
  - C1：dashboard / approvals（已完成并验证通过）
  - C2：opportunities / memory（已完成并验证通过）
  - C3：meetings / meetings/[id]（已完成并验证通过）
  - C4：contacts/[id] / companies/[id]（已完成并验证通过）
- 当前已落地：
  - `dashboard` 与 `approvals` 的 route-level server composition 已迁入 feature-side page loader。
  - `opportunities` 与 `memory` 的 route-level server composition 已迁入 feature-side page loader。
  - `meetings` 与 `meetings/[id]` 的 route-level server composition 已迁入 feature-side page loader，并保持 `page -> loader -> query/client` 的当前真相。
  - `contacts/[id]` 与 `companies/[id]` 的 route-level server composition 已迁入 feature-side detail loader，同时保留 page 侧 chain model / route identity marker 以降低对象详情链回归风险。
  - 根 `app/` 仍然是 route owner，页面行为未变。
  - `check:boundaries` 已从 `page -> query` 收紧为 `page -> loader -> query` 的当前真相。
  - 这一步还顺手修复了 `docs/README.md` 的 preserved-topic discoverability，使全量测试重新回到绿色。

### Phase D

- only after A + B + C 都站稳
- 才考虑：
  - `layout`
  - `loading`
  - `error`
  - `not-found`
  - bridge / shell thinning
- 当前状态：满足前置条件，但继续默认延后
- 延后原因：
  - `data/queries.ts` 仍然承担当前主干的兼容 façade 角色，尚未证明继续削薄 shell 会带来净收益。
  - 根 `app/` 依然是当前真实 route owner；在没有第二 owner 结构的 current-main 里，过早推进 shell thinning 只会放大入口壳复杂度。
  - 这轮 reconciliation 的目标是 ownership / query seam truthfulness，不是 shell 目录重排。

## 6. no-go areas

1. 不机械 cherry-pick 任何旧提交
2. 不做 mass rebase
3. 不恢复旧 `apps/` / `packages/` 结构
4. 不在早期移除 `data/queries.ts`
5. 不在早期做 shell thinning
6. 不把 docs/guards 和大目录 reshuffle 混在一个 slice
7. 不把 read-model descent 和 route-owner 迁移放进同一窄切片

## 7. archive-only references

以下内容只作为 archive/reference，不是当前主干执行目标：

- [LOCAL_HELM_MIGRATION_CHECKLIST_20260329.md](LOCAL_HELM_MIGRATION_CHECKLIST_20260329.md)
- 旧本地 `helm/` 子目录
- 旧本地 `apps/helm-app` / `packages/helm-control` / `packages/helm-protocol` / `packages/helm-runtime` 假设
- shell thinning old commits：
  - `3afa6c1`
  - `eadd64c`
  - `f9a9815`
  - `42ead26`
  - `09c638b`

## 8. direct docs / guards delta on current main

这轮可以立即落地的，不涉及产品行为：

1. README / docs index / project structure 明确 current-main truth
2. self-check 明确 reconciliation plan 存在
3. boundary-check 明确 current-main route/query/shell reality
4. archive doc 与 current-main plan 分离，不混写

## 9. manual forward-port later

后续只在 seam 证明安全后做：

1. dashboard / approvals query descent
2. opportunities / memory / meetings query descent
3. contacts / companies / inbox detail / settings / search / layout supporting queries descent
4. route-level assembly thinning

## 10. shell thinning is late-stage only

当前明确不早做：

- `app/layout.tsx`
- `app/loading.tsx`
- `app/error.tsx`
- `app/(workspace)/layout.tsx`
- `app/(workspace)/loading.tsx`
- `app/(workspace)/not-found.tsx`

只有在以下条件都满足后才允许进入：

1. Phase A 绿色
2. 已落地的 Phase B slices 绿色
3. 已落地的 Phase C slices 绿色
4. `data/queries.ts` 的 façade 身份已经稳定
5. route-level assembly seam 已被证明更薄且无行为漂移
