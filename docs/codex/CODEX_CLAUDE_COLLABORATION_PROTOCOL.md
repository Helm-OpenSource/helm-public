---
status: active
owner: helm-core
created: 2026-05-17
review_after: 2026-08-15
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Codex / Claude Collaboration Protocol

状态：active execution protocol
更新时间：2026-05-17
适用范围：Helm 仓库内需要 Codex 指挥 Claude 或吸收 Claude review / implementation 的任务

## 1. 目标

降低多代理失败率，把“左右互搏”从口头协作变成可复用工作流。

核心原则：

1. Codex 是 branch owner / integrator / final validator。
2. Claude 是 bounded reviewer / explorer / worker，不是仓库真值源。
3. Owner 做产品、商业、外部副作用和高风险边界最终裁决。
4. Claude 的结论必须被 Codex 用 repo truth、测试或文档证据吸收、改写或拒绝。

## 2. 角色边界

| 角色 | 负责 | 不负责 |
| --- | --- | --- |
| Owner | 方向、商业裁决、外部发布、客户承诺、凭据轮换、强制豁免 | 逐行合并、替代理工验证 |
| Codex | 读 repo truth、拆任务、创建/维护分支、分派 Claude、集成改动、跑验证、更新 docs / STATUS / PLANS、最终汇报 | 把 Claude 输出原样当 truth、绕过验证、擅自扩大平台范围 |
| Claude | 只读探索、红队 review、限定文件集实现、文档草案、备选方案压力测试 | 跨文件无边界改动、直接决定架构、直接合并、直接发布、触碰外部副作用 |

## 3. 标准协作模式

### 3.1 Explorer

用于摸清调用链、现状和风险。

- Claude 输入必须包含：repo root、branch、问题、只读范围、期望证据格式。
- Claude 输出必须包含：文件路径、行号或命令证据、确定结论、不确定项。
- Codex 不得把 Explorer 输出直接落库；必须先本地核验。

### 3.2 Reviewer

用于红队、回归风险、边界漂移和遗漏测试。

- Claude 默认 findings-first。
- 每条 finding 必须有文件 / 行号 / 触发条件 / 影响 / 建议修复。
- Codex 对每条 finding 做 `accept / rewrite / reject / defer`，并记录原因。

### 3.3 Worker

用于实现一个明确、可隔离的切片。

- Claude 必须获得唯一 write set；不得和 Codex 或其他 agent 同时写同一批文件。
- 任务必须给出 non-goals、禁止事项、验证命令和交付格式。
- Claude 最终必须列出改动文件、验证结果、未跑验证原因。
- Codex 负责 review diff、跑最终验证、处理冲突。

### 3.4 Docs Synthesizer

用于把讨论、ADR、方案和 review 结果收成文档。

- Claude 可以给结构和措辞建议。
- Codex 必须核对 repo truth、docs index、STATUS 和边界语句。
- customer-facing wording、release wording、商业承诺、法律 / 商标表述必须降级为 boundary / prerequisite / non-commitment，除非 Owner 明确批准。

## 4. Claude Handoff Packet

每次分派 Claude 前，Codex 必须给出最小 handoff packet：

```text
Repo root:
Branch:
Task mode: explorer | reviewer | worker | docs-synthesizer
Goal:
Owned files / read scope:
Non-goals:
Hard boundaries:
Current known facts:
Expected output:
Validation to run:
Do not:
```

`Do not` 默认包含：

- 不要 reset / checkout / revert 非自己改动。
- 不要改未授权文件。
- 不要新增依赖、schema、API、runtime、marketplace、payment 或 external side effect。
- 不要把 recommendation 写成 commitment。
- 不要把 public mirror / release readiness 写成已完成，除非有通过记录。

## 5. 吸收规则

Claude 输出进入 Codex 后，只能走四种处理：

| 处理 | 条件 | Codex 动作 |
| --- | --- | --- |
| Accept | 与 repo truth 一致，风险清楚，验证可跑 | 落地实现或记录结论 |
| Rewrite | 方向对，但措辞、边界、实现路径或验证不足 | 改写后落地，并记录改写点 |
| Reject | 与代码、文档、边界或商业决策冲突 | 不落地；必要时写明拒绝原因 |
| Defer | 需要 Owner、法律、安全、客户或外部系统确认 | 登记为风险 / 下一步，不伪装完成 |

## 6. 多轮互搏

高风险架构、release、security、public mirror、客户承诺、tenant-private 或商业边界任务，至少做两轮：

1. Claude Explorer / Reviewer 找问题。
2. Codex 核验并修正。
3. Claude 再 review 修正后的方案或 diff。
4. Codex 做最终验证与报告。

当 Owner 明确要求“充分讨论 / 五轮以上 / 交叉验证”时，Codex 必须保留 stateful 轮次，不得把它压缩成一次性摘要。

## 7. 失败率控制

常见失败源和默认防线：

| 失败源 | 防线 |
| --- | --- |
| 两个 agent 同时改同一文件 | worker handoff 必须声明 disjoint write set |
| Claude 基于旧文档推断 | 先给 current repo files / branch / status；Claude 结论必须带证据 |
| 输出停在建议层 | 每轮结束必须有 next slice、diff、验证或明确 blocker |
| 过度扩张平台边界 | 每个 handoff 都写 non-goals 和 Helm hard boundaries |
| public release 误报完成 | 必须有 `check:public-release`、public mirror build / verify、secret-history 状态 |
| 外部副作用失控 | Owner 未批准时只允许 read-only、preview-only、suggestion-only |
| 脏工作树误伤 | Codex 集成前先看 `git status`；不得 revert 非本轮改动 |

## 8. 完成定义

一次 Codex / Claude 协作任务完成时，Codex 最终报告必须至少说明：

1. Claude 承担了什么角色。
2. 哪些 Claude 结论被 accept / rewrite / reject / defer。
3. Codex 实际落地了哪些文件。
4. 跑了哪些验证，哪些未跑以及原因。
5. 剩余风险和下一步 owner / engineering action。

没有 Codex 的最终验证，Claude 的输出只算候选材料。
