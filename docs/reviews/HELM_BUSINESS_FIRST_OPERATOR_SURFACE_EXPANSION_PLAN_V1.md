---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business-first Operator Surface Expansion Plan V1

更新时间：2026-04-08
状态：Implemented

## 1. 当前问题

PR92 已把 `customer success queue / inbox / reports / diagnostics` 收到统一四类信息，但仍有两个缺口：

1. `internal operating`、`opportunities`、`approvals`、`imports` 这些 operator-heavy surface 还没有统一复用同一条 business-first summary 组件
2. “首屏只保留四类信息” 仍主要靠页面内联实现，后续很容易重新分叉

## 2. 本轮目标

只做两类事情：

1. 把相同 contract 扩到更多 operator-heavy surface
2. 把四类首屏信息抽成共享组件，减少页面分叉

首屏统一只保留：

- 对象状态
- 阻塞
- 待决策
- 下一步动作

## 3. 实施顺序

1. 建立 `BusinessFirstSurfaceSummary` shared component，复用现有 summary shell 与四类 label contract
2. 迁移 `internal operating`、`opportunities`、`approvals`、`imports`
3. 迁移 `inbox / reports / diagnostics` 到 shared component
4. 增强 hierarchy guard 和一条 operator-heavy e2e
5. 同步 docs、README、self-check、boundary-check、pilot-readiness
6. 运行完整验证链

## 4. 明确不做

- 不做新设计系统
- 不做 workflow automation UI
- 不扩 execution authority
- 不引入新模型层或新权限系统
- 不把本轮写成“全站界面已经完全简化”

## 5. 验收标准

- `internal operating`、`opportunities`、`approvals`、`imports` 第一屏都先显示 shared business-first summary
- `inbox / reports / diagnostics` 迁到同一 shared summary 组件
- 首屏只保留 `对象状态 / 阻塞 / 待决策 / 下一步动作`
- guidance、preferences、boundary explanation 不再压在 summary 之前
- hierarchy guard 和 e2e 能直接防止顺序回弹
- `db:reset -> self-check -> check:boundaries -> typecheck -> lint -> test -> build -> e2e -> quality:regression -> pilot:check` 全绿
