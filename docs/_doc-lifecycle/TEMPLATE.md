---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-10-27
archive_trigger:
  - 项目级文档治理重构（如全面 RFC 系统替代）
  - 本模板被超越
---

# 文档生命周期 frontmatter 模板（按类型）

按你的文档类型，**复制粘贴**对应的 frontmatter，把 `<...>` 占位符替换成具体内容。

不要从空白开始猜。空白起点是 gaming 出现最多的地方。

---

## 类型 A — Sprint / Phase closeout report

适用：`docs/reviews/HELM_*_SPRINT_*_REPORT_V1.md`、`HELM_*_PHASE_*_REPORT_V1.md`、`HELM_*_CLOSEOUT_*.md`

```yaml
---
status: active
owner: <真名或 role，例 "tommy" / "helm-core" / "ops-lead">
created: <YYYY-MM-DD，sprint/phase 收口当天>
review_after: <created + 30 天>
archive_trigger:
  - <下一个 sprint/phase 收口报告路径或标识> 存在后，本文件 30 天后归档
  - 本 sprint/phase 涉及的 surface 全部在 docs/STATUS.md 升档至「已完整成立」后归档
  - 自 review_after 起 90 天，无任何 PR / 文档引用本文件
---
```

---

## 类型 B — Planning / PLAN 文档

适用：`docs/product/HELM_*_PLAN_V1.md`、`docs/_planning/*.md`

```yaml
---
status: planning
owner: <planning 主导者 role 或真名>
created: <YYYY-MM-DD>
review_after: <created + 30 天>
archive_trigger:
  - 对应 enablement review / implementation 报告落地（路径：<docs/reviews/HELM_*_ENABLEMENT_REVIEW_V1.md>），本文件状态切到 deprecated 并 30 天后归档
  - <Phase 名称> 被取消或无限期推迟（在 docs/STATUS.md 「刻意未做」段落记录）
  - 自 review_after 起 90 天，本文件未在任何 PR description 或其他 doc 引用
---
```

---

## 类型 C — Baseline 长寿命

适用：`docs/product/HELM_*_BASELINE_V1.md`

```yaml
---
status: active
owner: <长期负责团队 role，例 "helm-core-runtime">
created: <YYYY-MM-DD>
review_after: <created + 180 天>
archive_trigger:
  - <baseline 名称> V2 落地（路径：<docs/product/HELM_*_BASELINE_V2.md>），且新版本 status=active 至少 30 天，本 V1 归档
  - <baseline 涉及的能力> 在 docs/STATUS.md 升档至「刻意未做」（即 Helm 弃用此方向）
---
```

---

## 类型 D — Freeze / 一次性证据

适用：`docs/reviews/HELM_*_FREEZE_REPORT_V1.md`、`HELM_*_CALIBRATION_REPORT_V1.md`

```yaml
---
status: active
owner: <冻结那一刻的负责 role>
created: <YYYY-MM-DD>
review_after: <created + 30 天>
archive_trigger:
  - <对应 gate 名称> 通过（具体证据：<approval record id 或 commit hash>），本文件作为冻结证据保留 30 天后归档
  - <freeze 涉及的数据/状态> 再次跑批或重新冻结（即出现 V2 版本），本 V1 立即归档
  - <created + 90 天的绝对日期，例 2026-09-01>，无论是否被引用，强制归档
---
```

---

## 类型 E — Requirements / 产品需求

适用：`docs/product/HELM_*_REQUIREMENTS_V1.md`

```yaml
---
status: active
owner: <product-owner 或具体 role>
created: <YYYY-MM-DD>
review_after: <created + 90 天>
archive_trigger:
  - <下一版本号> 落地（路径：<docs/product/HELM_*_REQUIREMENTS_V<N+1>.md>，且 status=active），本 V<N> 归档
  - <需求涉及的产品方向> 整体被废弃（在 docs/STATUS.md 「刻意未做」记录）
  - 自 review_after 起 90 天，本文件未被任何 commit 或 PR 引用
---
```

---

## 类型 F — Launch post / 营销 / 一次性事件

适用：`docs/launch/*.md`

```yaml
---
status: planning
owner: product-owner
created: <YYYY-MM-DD>
review_after: <created + 14 天>
archive_trigger:
  - <release tag，例 v0.1.0-trial> 落地后 30 天，本文件归档至 docs/_archive/launch-<YYYY-MM>/
  - <release> 被取消或推迟超过 30 天
---
```

---

## 类型 G — Roadmap / 路线图

适用：`docs/roadmap/*.md`

Roadmap 是**少数允许长期 active 的文档之一**，但也必须有死亡条件。

```yaml
---
status: active
owner: helm-core
created: <YYYY-MM-DD>
review_after: <created + 90 天>  # 季度复审
archive_trigger:
  - 替代版本（HELM_PUBLIC_ROADMAP_V<N+1>.md）落地且 status=active 至少 30 天后归档
  - 项目从 controlled-trial 迁出（产品阶段大变更，在 docs/STATUS.md 记录）
---
```

---

## 不允许的填法（boundary check 会拦截）

下列填法即使每个字段都"非空"，boundary check 也会 FAIL：

```yaml
# 反 owner 模式
owner: TBD                  # 没人 = 没人维护
owner: unknown              # 同上
owner: team                 # 太泛
owner: everyone             # 等于没人

# 反 review_after 模式
review_after: 2030-12-31    # > created + 365 天
review_after: <created>     # 当天 = 没设

# 反 archive_trigger 模式
archive_trigger:
  - 完成时归档                                  # 太短，太模糊
  - 当我们觉得不需要时                            # 主观，无法外部验证
  - 永不归档 / 永久保留作为历史记录                # 历史是 git 的活
  - 项目结束时归档                              # 等价于「永不」
  - 当方向调整后                                # 主观
  - when applicable                            # 同义反复
```

完整禁用关键词列表见 [`CONTRACT.md`](CONTRACT.md) §四.1。

---

## 死亡条件三类句式

把所有 archive_trigger 收敛成 3 类可复用句式：

### 句式 A — 绑定到下游产物存在性（最强）

```
- <下游文档/能力路径> 落地后，本文件 30 天后归档
```

### 句式 B — 绑定到 STATUS.md 升档

```
- <能力名称> 在 docs/STATUS.md 升档至「<新档位>」后
```

### 句式 C — 兜底超时（每份文档至少有一条）

```
- 自 review_after 起 90 天，无任何 PR / 文档引用本文件
- <绝对日期>，无论是否被引用，强制归档
```

**最佳实践**：A + C 组合（最稳） / B + C 组合（次之）。只有 C 也行（最差但合规）。

---

## 写完之后的自检

把三个问题对自己问一遍（见 [CONTRACT.md §四.3](CONTRACT.md)）：

1. **owner**：谁来决定它什么时候死？真的会接住 review_after 提醒吗？
2. **archive_trigger**：它什么时候死？外部观察者能不能独立判断「触发了 / 没触发」？
3. **review_after**：在死之前谁周期性确认它还活着？真的会复审吗？

任一答不上来 → 这份文档可能不应该独立存在，应该写进现有文档的某一节。

---

## 本模板的死亡条件

见本文件顶部 frontmatter `archive_trigger`。
