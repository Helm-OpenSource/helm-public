---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Execution Receipt 模板

> 用途：当某个 PR 已经完成并进入当前主干，但后续还需要反复回答“它是否已完成、当前 truth 是什么、它支撑了什么”时，优先使用本模板补一份当前主干执行回执。  
> 注意：execution receipt 不替代现有 baseline / plan / report，只负责收口当前主干 truth。

# `任务名` Execution Receipt V1

状态：Recorded  
Owner：`owner`  
日期：`YYYY-MM-DD`

## 1. 目的

这份回执只收口 `PRxx - 任务名` 在当前主干里的执行结果。

它不替代现有 baseline / plan / report，只负责把当前主干 truth、未成立 truth 和后续支撑点明确写清。

## 2. 当前主干状态

- `PRxx` 已完成并进入主干
- 实现提交：`commit-sha` `commit subject`
- 当前主干包含 `PRxx` 的全部实现 truth

## 3. 变更文件列表

`PRxx` 实际改动文件：

- `path/a`
- `path/b`
- `path/c`

## 4. Established Truth

### 已经完整成立

- `写当前已经完整成立的能力`
- `写当前已经完整成立的 contract / route / state / readout`
- `写已经接入的对象、数据链路或 operator posture`

## 5. Unresolved Truth

### 已成形但仍需下一层

- `写仍需下一层的部分`
- `写仍保持 pending / unresolved 的部分`

### 刻意未做

- `写本轮明确不做的部分`
- `写必须继续诚实保留的边界`

## 6. 验证链结果

`PRxx` 报告中记录并通过的完整验证链：

- `npm run db:reset`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run e2e`
- `npm run quality:regression`

记录结果：

- `test` -> `...`
- `e2e` -> `...`
- `quality:regression` -> `...`

## 7. 对后续主线的直接支撑点

### `后续主线 A`

- `写直接支撑点`
- `写它减少了后续哪部分重复建设`

### `后续主线 B`

- `写直接支撑点`
- `写它提供了哪些前置 truth / state / audit / operator surface`

## 8. 使用规则

后续如果需要判断 `PRxx` 是否已完成，应以以下文档组合为准：

- `baseline`
- `plan`
- `report`
- 本执行回执

不应再把 `PRxx` 重新作为待实施任务重复落地。
