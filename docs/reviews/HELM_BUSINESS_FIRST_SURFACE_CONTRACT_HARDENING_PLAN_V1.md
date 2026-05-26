---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business-first Surface Contract Hardening Plan V1

更新时间：2026-04-08
状态：Implemented

## 1. 当前问题

PR91 已把四张关键经营页面拉回 business-first，但当前仍有两个缺口：

1. `customer success queue / inbox / reports / diagnostics` 首屏仍残留较重解释负担
2. 还没有共享 contract 去限制“首屏只能先讲四类经营信息”

这会让页面在后续迭代里继续反弹回 explanation-first。

## 2. 本轮目标

只做两类事情：

1. 继续压 `customer success queue / inbox / reports / diagnostics` 的第一屏解释性内容
2. 建一个更硬的 business-first surface contract，统一首屏只保留：
   - 对象状态
   - 阻塞
   - 待决策
   - 下一步动作

## 3. 实施顺序

1. 为四类首屏信息建立共享 label contract
2. 重排四张页面，把 summary 放到 guidance / preferences / boundary explanation 之前
3. 下线 `inbox` 和 `customer success queue` 的 header briefing 压力
4. 增强 hierarchy guard
5. 同步 docs、README、self-check、boundary-check、pilot-readiness
6. 运行完整验证链

## 4. 明确不做

- 不做新设计系统
- 不做 workflow automation UI
- 不扩 execution authority
- 不引入新模型层或新权限系统
- 不把本轮写成“全站界面已经完全简化”

## 5. 验收标准

- 四张页面第一屏都先显示 business-first summary
- summary 只保留 `对象状态 / 阻塞 / 待决策 / 下一步动作`
- guidance、preferences、boundary explanation 不再压在 summary 之前
- hierarchy guard 能直接防止顺序回弹
- `db:reset -> self-check -> check:boundaries -> typecheck -> lint -> test -> build -> e2e -> quality:regression -> pilot:check` 全绿
