---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-10-27
archive_trigger:
  - 项目级文档治理重构（如全面 RFC 系统替代）
  - 本契约本身被超越
---

# 文档生命周期契约 V1

适用范围：自 2026-04-28 起新建的 `docs/_planning/`、`docs/reviews/`、`docs/product/HELM_*_PLAN_V*.md`、`docs/launch/`、`docs/roadmap/` 等任何 plan / review / closeout / freeze / baseline / requirements / contract 文件。

不适用：
- `README.md` / `AGENTS.md` / `DESIGN.md` / `WORKING-CONTEXT.md` / `CHANGELOG.md` / `CONTRIBUTING.md` / `SECURITY.md` / `CODE_OF_CONDUCT.md` 等仓库根 truth 文件
- `docs/architecture/` 工程结构文档
- `docs/_archive/` 归档目录
- `docs/_doc-lifecycle/CONTRACT.md` 本契约自身（自指例外）
- 2026-04-27 之前已存在的文档（不强制回填，由 owner 按需补齐）

---

## 一、强制 frontmatter

每份新文档**第一行必须**是 YAML frontmatter，字段如下：

```yaml
---
status: planning | active | deprecated | archived
owner: <真名或团队 role，例 "alice@helm.run" 或 "helm-core" 或 "ops-lead">
created: 2026-04-27
review_after: 2026-07-27
archive_trigger:
  - <具体可验证的条件 1>
  - <具体可验证的条件 2>
  - 90 天内（自 review_after 起）无任何 PR / 文档引用本文件
---
```

### 字段约束

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `status` | enum | `planning` / `active` / `deprecated` / `archived` 之一 |
| `owner` | string | 不允许 `TBD`、`unknown`、空 |
| `created` | YYYY-MM-DD | 创建当日 UTC |
| `review_after` | YYYY-MM-DD | 必须 ≥ created；建议 ≤ created + 90 天 |
| `archive_trigger` | string[] | 至少 1 条；每条必须可被外部观察验证（不接受「项目方向变了」这种主观条件） |

### 死亡条件示例（archive_trigger）

**好**（具体可验证）：

- `commit <hash> 落地后，本文件可归档至 docs/_archive/`
- `Phase 3 thin read-model adapter 进入 active 档（docs/STATUS.md 对应行升档）后`
- `自 review_after 起 90 天，无任何 PR / 文档引用本文件`
- `2026-09-01 之后，无论是否被引用，强制归档`
- `Required Reviewer approval 完成（HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md §六 checklist 全部勾选）后`

**坏**（主观、无法外部验证）：

- ~~「当我们觉得不需要时」~~
- ~~「当方向调整后」~~
- ~~「当团队认为它过时」~~

---

## 二、`status` 状态机

```
planning ──── 落地为可用接口 / 文档对外开放 ───► active
   │                                              │
   │                                              ▼
   │                              下一档已稳定 / 替代品就位 ──► deprecated
   │                                              │
   ▼                                              ▼
archived  ◄────────── archive_trigger 命中 ─────  archived
```

- **planning**：起草中 / 等批准 / 等实施。**不**面向外部读者。
- **active**：已落地、当前可被引用、由 owner 维护
- **deprecated**:已被新版本 / 替代方案取代，但仍被代码引用，等清理
- **archived**:不再维护，移到 `docs/_archive/<归档日期>/`，从 `docs/README.md` 索引剔除

每次状态升降都必须**同时**更新 [`docs/STATUS.md`](../STATUS.md) 对应行。

---

## 三、文件命名规则

- 文件名**不**带 `_V<N>` / `_V<N>_<M>` 后缀
- 版本演进通过文件**内**的 `## 变更记录` 段落表达
- 例外：已存在带版本后缀的文件名保留至下一次主修订；不强制立即重命名

---

## 四、强制方式

`scripts/decision-first-boundary-check.ts` 增加规则：

- 扫描 `docs/_planning/`、`docs/reviews/`、`docs/product/HELM_*_PLAN_V*.md`、`docs/launch/`、`docs/roadmap/` 下的新文件
- 检查 frontmatter 5 字段 + `archive_trigger` 至少 1 条
- **检查反 gaming 模式**（见下文 §四.1）
- 缺字段或命中反 gaming 模式 → boundary check fail
- 已存在的文件（在 `scripts/doc-lifecycle-grandfather.json` 里）→ 不检查

### 四.1 反 gaming 模式（boundary check 主动拒绝）

下列填法即使满足"5 字段都在"也会让 boundary check FAIL：

#### `owner` 字段

```
owner: TBD            ← FAIL
owner: unknown        ← FAIL
owner: ""             ← FAIL
owner: N/A            ← FAIL
owner: tbd            ← FAIL
owner: team           ← FAIL  （太泛；写具体 role 名）
owner: everyone       ← FAIL
owner: helm-core      ← OK
owner: tommy          ← OK
owner: ops-lead       ← OK
owner: dpo            ← OK
owner: alice@helm.run ← OK
```

#### `review_after` 字段

```
review_after >= created + 365 天       ← FAIL  （超过 1 年 = 永不复审）
review_after <  created                ← FAIL  （回到过去）
review_after = created                 ← FAIL  （当天复审 = 没设）
created     - review_after = 30~180 天 ← OK
```

#### `archive_trigger` 字段

```yaml
# FAIL：每条 < 30 字符，太短 = 太模糊
archive_trigger:
  - 完成时归档
  - 项目结束

# FAIL：命中禁用关键词（主观 / 不可外部验证）
archive_trigger:
  - 当我们觉得不需要时归档
  - 当方向调整后归档
  - 永不归档
  - 永久保留作为历史记录

# OK：具体 + 可验证
archive_trigger:
  - Phase 4 enablement review V1 落地（docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE4_RUNTIME_ENABLEMENT_REVIEW_V1.md 存在），本文件 30 天后归档
  - 自 review_after 起 90 天，无任何 PR / 文档引用本文件
  - 2026-09-01 之后，无论是否被引用，强制归档
```

被禁用的关键词（任意一条命中 → FAIL）：

- `觉得` / `认为` / `应该` / `可能` / `也许` / `大概`（主观判断）
- `永不` / `不归档` / `永久保留` / `forever` / `never`
- `项目结束` / `产品退役`（兜底无意义；仓库整体退役那天再说）
- `历史记录` / `历史参考` / `留存` / `for history`（这些是 git history 的活，不是文档的活）
- `不需要时` / `when no longer needed` / `when applicable`（同义反复）

---

## 四.2 写作指南（按文档类型）

不同类型文档对三个字段有不同的"经验值"。直接复制粘贴 [`docs/_doc-lifecycle/TEMPLATE.md`](TEMPLATE.md) 里对应类型的范本，填入即可，不要从空白开始猜。

### 类型 A — Sprint / Phase closeout report

| 字段 | 经验值 |
| --- | --- |
| status | active |
| owner | sprint 主导者真名或负责 role |
| review_after | created + 30 天 |
| archive_trigger | 至少 (1) 绑定到下一个 sprint/phase 收口报告存在 + (2) 90 天未引用兜底 |

### 类型 B — Planning / PLAN 文档

| 字段 | 经验值 |
| --- | --- |
| status | **planning**（不是 active） |
| owner | planning 主导者 |
| review_after | created + 30 天（planning 易过时，短周期复审） |
| archive_trigger | 至少 (1) 绑定到对应 enablement review / implementation 报告落地 + (2) Phase 取消条件 + (3) 90 天兜底 |

### 类型 C — Baseline 长寿命

| 字段 | 经验值 |
| --- | --- |
| status | active |
| owner | 长期负责团队 role |
| review_after | created + 180 天（半年实质过一遍） |
| archive_trigger | 至少 (1) V2 / 替代品落地 30 天 + (2) STATUS.md 升档至「刻意未做」 |

### 类型 D — Freeze / 一次性证据

| 字段 | 经验值 |
| --- | --- |
| status | active |
| owner | 冻结那一刻的负责 role |
| review_after | created + 30 天 |
| archive_trigger | 至少 (1) 对应 gate 通过 + 30 天后归档 + (2) V2 出现立即归档 + (3) 绝对日期上限 |

### 类型 E — Requirements

| 字段 | 经验值 |
| --- | --- |
| status | active |
| owner | product owner |
| review_after | created + 90 天 |
| archive_trigger | 至少 (1) V<下一版> 落地 30 天 + (2) 整体被废弃 STATUS.md 记录 + (3) 90 天未引用兜底 |

### 类型 F — Launch post / 营销 / 一次性

| 字段 | 经验值 |
| --- | --- |
| status | planning（直到发布日） / active（发布日起 30 天）/ 之后归档 |
| owner | product owner |
| review_after | created + 14 天 |
| archive_trigger | 至少 (1) 对应 release tag 落地 30 天 + (2) 发布取消或推迟 30 天 |

---

## 四.3 三个字段的"质问"测试

写完 frontmatter 之后，把这三个问题对自己问一遍：

1. **`owner` —— 谁来决定它什么时候死？**
   - 如果回答是「我也不知道」「让别人决定」「写完就没人管了」 → owner 字段没填对
   - 必须能在 review_after 那天给这个 owner 发 ping，并能拿到「保留 / 归档」的明确决定

2. **`archive_trigger` —— 它什么时候死？**
   - 如果回答只能用主观判断（"觉得没用"）回答 → 触发条件没填对
   - 至少有一条能由**外部观察者**单凭仓库 / git / docs/STATUS.md 状态独立判断「触发了 / 没触发」

3. **`review_after` —— 在死之前，谁周期性确认它还活着？**
   - 如果回答「设个 1 年后吧反正不会有人看」 → 等于没设
   - review_after 那天来了，owner 必须真的看一眼，然后做 4 选 1：保持 active / 切 deprecated / 调整 archive_trigger / 立即归档

如果三个问题任一答不上来 → **这份文档可能不应该独立存在，应该写进现有文档的某一节**。这是契约最重要的副作用：让作者在新建文档前真正想清楚。

---

## 五、自检 sweep（由 owner 周期性执行，不强制）

```
$ tsx scripts/doc-lifecycle-sweep.ts  # 待实现，可选
```

输出：

- `review_after < today` 的文档列表 → owner 必须在 7 天内审视并决定 status
- `archive_trigger` 命中的文档列表 → owner 必须在 30 天内移到 `docs/_archive/`
- 新建文档但缺 frontmatter → 已被 boundary check 拦截，不会到这一步

---

## 六、不在本契约范围内的事

- 强制回填老文档：64 份现役 `docs/reviews/*` 不需要立即加 frontmatter；下次有 owner 触碰它时再加
- 自动化归档执行：`docs/_archive/` 移动需要 PR 走代码评审
- 删除文档：本契约从不删除，只归档。`git history` 永远保留

---

## 七、变更记录

| 日期 | 变化 |
| --- | --- |
| 2026-04-27 | V1 首发；与 AGENTS.md §8.1-8.2 同期落地 |

---

## 八、本文件的死亡条件

见本文件顶部 frontmatter `archive_trigger`。

如果未来 Helm 采用全面的 RFC 系统（如 docs/rfcs/ + 自动 lifecycle），本文件应归档；其约束并入新系统。
