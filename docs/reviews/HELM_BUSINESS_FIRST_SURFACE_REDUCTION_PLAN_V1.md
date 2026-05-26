---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Business-first Surface Reduction Plan V1

更新时间：2026-04-08
状态：Implemented

## 1. 当前问题

当前关键经营页面第一屏同时承载：

- judgement explanation
- guidance panel
- preferences panel
- summary / why-it-matters / Helm-did
- secondary summary / evidence / worker readout

结果是最重要的经营动作没有第一时间可见，用户必须先读解释，才能开始处理业务。

## 2. 本轮目标

只把四张页面第一屏收成 business-first：

1. `dashboard`
2. `internal operating`
3. `customer success queue`
4. `opportunities`

## 3. 实施顺序

1. 先复核四张页面当前第一屏的层级和噪音来源
2. 在不改模型层的前提下重排首屏层级
3. 把 guidance / preferences / secondary summary 等内容下移
4. 同步文档、README、docs 索引、自检和边界守卫
5. 运行完整验证链

## 4. 明确不做

- 不重写模型层
- 不新增 workflow automation
- 不扩 execution authority
- 不把本轮写成“全站已再次完整 redesign”
- 不引入新的服务端偏好同步能力

## 5. 验收标准

- 四张页面第一屏都先出现关键经营动作或对象焦点
- guidance / preferences / explanation 不再压住第一屏主动作
- 文档明确区分“已成立 / 未成立 / 刻意未做 / 风险项”
- `db:reset -> self-check -> check:boundaries -> typecheck -> lint -> test -> build -> e2e -> quality:regression` 全绿
