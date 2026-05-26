---
status: archived
owner: helm-core
created: 2026-04-08
review_after: 2026-10-05
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Business-first Surface Reduction Report V1

更新时间：2026-04-08
状态：Implemented

## 1. 本轮完成

本轮把四张高频经营页面的第一屏收成更直接的 business-first 结构：

- `dashboard`
- `internal operating`
- `customer success queue`
- `opportunities`

共同变化：

- 先显示经营对象焦点 / 第一推进动作
- 再显示当前阻塞 / 待拍板事项 / 关键边界
- guidance、preferences、secondary summary、why-it-matters 等解释性内容下移

## 2. 当前已经完整成立

- `dashboard` 第一屏已经优先显示经营主战场、第一推进动作、当前阻塞与待拍板事项
- `internal operating` 第一屏已经优先显示经营节奏、当前第一动作、决策点与拖慢点
- `customer success queue` 第一屏已经优先显示当前局面摘要与边界，行动 rail / queue / inbox 更快可见
- `opportunities` 第一屏已经先显示当前最值得推进的机会对象与主工作区，下一步、边界与上下文在主要经营动作之后立即可见

## 3. 已成形但仍需下一层

- 这轮只覆盖了四张页面，其它 surface 仍有继续减法空间
- `PageHeader` 里的 briefing 仍偏解释型，后续需要统一收紧
- `opportunities` 的 guidance / protocol / proactive explanation 仍在页面中，但已经整体下移到主工作区之后

## 4. 刻意未做

- 没有新增新的模型层或 query contract
- 没有引入 auto-send / broad auto-write
- 没有改 execution authority
- 没有把 business-first 减法扩成新一轮全站 redesign 项目

## 5. 风险项

- 这轮的“首屏预算”还没有抽成 shared contract，只是先对四张关键页面收口
- 未来新页面如果继续沿用旧 guidance-first 模板，仍可能重新长胖
- 如果后续继续做全站减法，需要建立更强的 hierarchy guard，直接限制第一屏的组件顺序和数量
