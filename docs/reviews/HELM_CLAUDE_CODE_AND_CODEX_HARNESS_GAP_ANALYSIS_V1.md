---
status: active
owner: helm-core
created: 2026-04-22
review_after: 2026-07-21
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Claude Code And Codex Harness Gap Analysis V1

更新时间：2026-04-22  
状态：Delivered

## 1. 本轮目标

本轮只做三件事：

- 把从 `Claude Code` 和 `OpenAI Codex` 官方公开 harness 里最值得学习的部分，收成一份正式 gap 文档
- 明确这些经验相对于 Helm 当前真值，到底哪些是高价值基础设施升级，哪些不能直接照搬
- 给出一条清晰、克制、按价值排序的改进顺序

本轮不做：

- 不做代码实现
- 不做 schema 设计
- 不做自动执行权限扩张
- 不把 Helm 写成通用 coding harness、marketplace 或完整 orchestration 平台

## 2. 执行摘要

当前从 `Claude Code` 和 `OpenAI Codex` 最值得 Helm 学的，不是更多 agent surface，也不是更多“看起来很强”的多代理表演，而是它们把 harness 核心层做成了更正式的工程产品：

- `Claude Code` 最值得学的是：把 `plugins / agents / hooks / permissions / subagents / monitors / memory` 做成显式协议，而不是散落配置
- `OpenAI Codex` 最值得学的是：把 harness 核心层从单一 surface 中抽出来，变成可被 CLI、App、automation、remote execution 复用的 runtime substrate

对照 Helm 当前真值，Helm 已经有自己的强项：

- `judgement-first`
- `review-gated official action`
- 分层 memory 与 retrieval policy
- `run / thread / checkpoint / resume` typed runtime substrate
- `worker / skill / resource` contract
- tenant extension directory / manifest protocol
- benchmark matrix

但 Helm 当前仍有几个比表层功能更值得优先收敛的硬 gap：

1. 还没有统一的 `runtime extension bundle`
2. 还没有更正式的 `capability / policy resolution engine`
3. 还没有把主动汇报做成 `monitor substrate`
4. 还没有把 memory 做成完整的 `index + budget + load trace`
5. 未来 swarm 所需的 `isolation + task ledger + plan gate` 还未正式成立
6. 还没有一个更稳定的 `runtime server / app server seam`
7. `plugin runtime` 仍没有真正 sandbox

因此，Helm 下一阶段最应该做的不是继续加 agent surface，而是进一步工程化：

- runtime substrate
- extension / worker / skill / hook / monitor protocol
- capability / permission / review / fallback resolution
- memory explainability
- swarm isolation
- operator/runtime server seam

## 3. 外部 Harness 里最值得学的部分

### 3.1 从 Claude Code 学到的高价值经验

#### 3.1.1 扩展能力必须是一等协议

`Claude Code` 最值得学的一点，是它没有把扩展能力停留在 prompt 片段或 repo-local 约定，而是把：

- plugin
- agent
- hook
- permission
- monitor
- MCP
- memory

这些能力放进同一套更正式的扩展体系里。

对 Helm 的启发不是去做 marketplace，而是：

- extension identity 要稳定
- capability requirements 要显式
- hook / monitor / worker / skill 不应继续散落在不同局部协议里

#### 3.1.2 权限应该是求值流水线，不是零散守卫

`Claude Code` 的另一个关键经验，是权限不是“一个开关”，而是一条更清楚的求值链：

- rule
- hook
- approval
- fallback

这比“路由里到处塞 if 判断”更容易解释，也更容易审计。

对 Helm 的价值在于：

- 能把 `review-first`
- `ask / deny / route-to-review / allow`
- 为什么被允许、为什么被拦、为什么被降级

统一成一条更可解释的 authority trace。

#### 3.1.3 并行 agent 的前提必须是隔离

`Claude Code` 的 subagent / agent teams 最值得学的，不是“可以多开几个 agent”，而是：

- 有更明确的角色分工
- 有更清楚的任务边界
- 强调隔离与冲突避免

这对 Helm 的直接启发是：

- 未来 swarm 不能先做 UI 编排
- 要先做 `isolated execution state`
- `task ledger`
- `mailbox / handoff`
- `plan gate`

#### 3.1.4 monitor 是主动机制的基础设施

`Claude Code` 让 monitor 成为一等能力，这一点和 Helm 的 `proactive-reporting-first` 非常契合。

Helm 当前已经强调主动汇报，但还没有把“持续观察 -> 触发报告 / 升级 / review”收成更稳定的 monitor substrate。

#### 3.1.5 memory 不是堆上下文，而是索引、预算与解释

`Claude Code` 在 memory 上最值得学的不是“记更多东西”，而是：

- concise index
- topic file
- load budget
- why loaded
- why skipped

这和 Helm 当前分层 memory 的方向一致，但 Helm 还没把这层解释能力产品化。

### 3.2 从 OpenAI Codex 学到的高价值经验

#### 3.2.1 harness 核心层必须从 surface 抽离

`OpenAI Codex` 最重要的工程价值，不在某个单独的 CLI 或 App，而在于它公开展示出来的是一套更独立的 harness 核心层：

- CLI 不是全部
- App 不是全部
- automation 不是全部
- background / server / SDK 不是全部

真正稳定的是底下那条 runtime substrate。

这对 Helm 的直接启发是：

- `/operating`
- future app shell
- automation
- operator tool
- tenant custom extension surface

不应该各自长自己的 runtime 逻辑，而应该共用同一套 runtime seam。

#### 3.2.2 配置、规则、hooks、skills、subagents 必须是正式入口

`Codex` 把：

- rules
- hooks
- AGENTS
- plugins
- skills
- subagents

都做成了明确入口，而不是“只存在实现里”。

这对 Helm 的价值在于：

- 把系统行为的来源做得更可追溯
- 把“为什么这次能做 / 不能做”解释得更清楚
- 把仓库内已有的约束提升成更正式的 runtime rule source

#### 3.2.3 多 surface 共享一套 runtime 比多做页面更重要

`Codex` 最值得 Helm 学的产品路线之一，是先让多 surface 共用 runtime，再增加 surface。

这能避免 Helm 后面出现：

- `/operating` 一套逻辑
- background automation 一套逻辑
- extension runtime 一套逻辑
- future operator tool 又一套逻辑

的重复实现问题。

#### 3.2.4 sandbox / security / approval 是一等能力

`Codex` 官方对外明确把：

- sandbox
- approvals
- security posture

作为产品级能力表达出来，而不是实现细节。

这对 Helm 的提醒非常直接：

- 现在最大的硬 gap 之一不是“少一个功能”
- 而是 `plugin runtime` 仍没有真正 sandbox

### 3.3 两者合起来给 Helm 的共同启发

把两者放在一起看，Helm 真正值得学的是：

1. 先把 runtime substrate 做稳，而不是继续做更多 agent surface
2. 先把 capability / permission / review / fallback 做成正式协议
3. 先把 extension / worker / skill / hook / monitor 收成统一 bundle
4. 先把 memory 做成预算化、可解释、可审计的加载系统
5. 先把 swarm 的隔离、任务账本、plan gate 做出来，再谈更强自治

## 4. Helm 当前真值

根据 current-main 文档与仓库规则，Helm 当前仍然是：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `decision-first`
- `proactive-reporting-first`

Helm 当前仍然不是：

- 完整 workflow / orchestration 平台
- 完整 auto-execution plane
- 完整企业级多组织 / 多权限 / 多租户平台
- 通用聊天产品
- 通用 coding harness

Helm 当前已经成立的 harness 基础包括：

- `run / thread / checkpoint / resume` typed runtime substrate
- Operator Debugger 的 bounded read spine 与 takeover / handoff seam
- `worker / skill / resource` contract
- tenant extension directory / manifest protocol
- layered memory / retrieval policy / promotion ledger
- benchmark matrix
- environment contract / execution seam / execution authority read truth

Helm 当前必须继续诚实保留的边界包括：

- `plugin runtime` 仍没有真正 sandbox
- 默认仍是 `建议 / 准备 / 升级 / review-first`
- 不默认拥有高风险自动发送、高风险自动承诺、高风险自动改状态权限
- 当前仍不是完整 orchestration 平台

## 5. Gap Matrix

### 5.1 Gap 1：还没有统一的 Runtime Extension Bundle

当前 Helm 已有：

- `extensions/<tenant-key>/<extension-slug>/`
- `extension.manifest.json`
- `worker / skill / resource` 协议

但还没有把这些收成一套更统一的 runtime bundle。

当前问题是：

- identity、capability、resources、hook、monitor、versioning 还分散
- 很难一眼看清某个 extension 到底声明了什么执行面
- 很难把 extension 真正当成统一 runtime unit 来加载、校验、对齐

应该补成：

- extension identity
- worker / skill declarations
- connector / resource requirements
- hook declarations
- monitor declarations
- capability requirements
- eval contract
- compatibility / migration contract

### 5.2 Gap 2：还没有正式的 Capability / Policy Resolution Engine

当前 Helm 已有不少 boundary、guard、review gate、self-check，但它们更多仍是：

- 脚本级守卫
- route/action 层判断
- read-model truth

还不是一条更正式的 capability resolution flow。

这会带来两个问题：

- 为什么被允许 / 被拦 / 被降级，不够统一
- 后续扩到 extension / automation / swarm 时，authority 解释成本会快速升高

应该补成统一求值顺序：

1. capability declaration
2. policy source resolution
3. hook / monitor injected context
4. allow / ask / deny / route-to-review
5. authority trace export

### 5.3 Gap 3：还没有把主动机制做成 Monitor Substrate

Helm 的主动汇报方向是对的，但当前更像：

- runtime summary
- periodic read model
- operator-facing cues

还不是更完整的持续观察层。

高价值 monitor 场景包括：

- connector lag
- webhook failure / stale receipt
- meeting ingest backlog
- memory sync anomaly
- settlement exception
- review queue drift

如果没有 monitor substrate，Helm 的“主动”仍然会过度依赖已有 surface summary，而不是持续观察驱动。

### 5.4 Gap 4：还没有完整的 Memory Index / Budget / Load Trace

Helm 当前 memory 已经有分层、promotion、retrieval policy，但还没有完整产品化：

- 简明 memory index
- topic summary
- startup load budget
- 为什么加载这些 memory
- 为什么跳过那些 memory
- scope explanation
- operator-facing memory trace

这条线的价值非常大，因为 Helm 的核心优势之一就是 business/memory continuity。如果这层不可解释，后续只会越来越重。

### 5.5 Gap 5：未来 Swarm 所需的 Isolation / Task Ledger / Plan Gate 还未正式成立

Helm 已经有不少 runtime contract，但未来如果真的继续做 swarm，下一层缺的不是 agent 名称，而是：

- per-agent isolated execution state
- task ledger
- mailbox / handoff bus
- before-write plan gate
- conflict avoidance
- cleanup / resume policy

如果没有这些基础设施，swarm 很容易沦为：

- 多个 agent 同时在同一上下文里说话
- 角色不清
- 写入边界不清
- 审计困难

### 5.6 Gap 6：还没有更正式的 Runtime Server / App Server Seam

Helm 未来很可能同时需要：

- `/operating`
- operator panel
- automation
- extension runtime
- possible future app shell

这些 surface 如果继续直接调各自局部实现，会让 runtime seam 继续分裂。

因此 Helm 更需要的是一条更窄但更正式的 runtime server seam，用来统一：

- run/thread lifecycle
- review requests
- official-action acknowledgement
- recommendation / memory trace
- monitor events
- handoff / closeout / follow-through

### 5.7 Gap 7：Sandbox 仍是硬缺口

这是当前最需要继续诚实保留的 gap。

在没有真正 sandbox 前：

- extension authority 不能扩张太快
- automation authority 不能扩张太快
- swarm autonomy 不能扩张太快

这意味着 sandbox 不是“以后再说”的小项，而是决定 Helm harness 上限的硬约束。

## 6. 清晰改进顺序

下面这条顺序不是“看起来最酷”的顺序，而是相对于 Helm 当前价值最高、风险最低、对后续扩展帮助最大的顺序。

### 6.1 第一步：Extension Bundle + Capability Manifest

先把 extension、worker、skill、resource、hook、monitor、connector requirements 收成一套统一 bundle contract。

原因：

- 这是 Helm 后续所有 runtime 扩展能力的基础
- 风险低于直接做 swarm 或 server
- 能先把“扩展到底声明了什么”说清楚

### 6.2 第二步：Capability Resolution Engine

把现有 boundary / authority / review-first truth 收成更正式的求值流水线。

原因：

- Helm 的强项本来就不是随便执行，而是 judgement / review / bounded action
- 这一步能直接增强可解释性与可审计性
- 是后续 extension、monitor、swarm 的共同前提

### 6.3 第三步：Monitor Substrate

把主动汇报从“已有 summary 驱动”推进到“持续观察驱动”。

原因：

- 这条线直接贴近 Helm 的 `proactive-reporting-first`
- 能为 operator 和 future runtime server 提供高价值信号
- 不需要先进入自动执行

### 6.4 第四步：Memory Observability And Budgeting

把 memory 做成：

- 可解释
- 可预算
- 可追溯

原因：

- 这是 Helm judgment continuity 的核心增益点
- 也能显著降低“为什么这次说了这个”的 operator 理解成本

### 6.5 第五步：Swarm Isolation + Task Ledger + Plan Gate

只有当前四步更稳以后，才值得继续把 swarm 基础设施补到位。

原因：

- 否则 swarm 只会放大当前 authority、memory、surface 的复杂度
- 先做硬隔离，再谈更强自治，能避免架构跑偏

### 6.6 第六步：Runtime Server / App Server Seam

在 extension、capability、monitor、memory、swarm 基础线更稳之后，再把多 surface 共用 runtime seam 收口。

原因：

- 这一步影响面更广
- 太早做容易把仍不稳定的局部逻辑抽成错误抽象
- 晚一点做，反而更能收对

### 6.7 并行长期线：Sandbox Roadmap

这条线要尽早认账，但不要求在前六步之前全部完成。

建议按三段规划：

- 短期：deny-first capability / path / resource allowlist
- 中期：worker process isolation、environment hardening
- 长期：filesystem / network sandbox

## 7. 刻意不直接照搬的部分

从 `Claude Code` 和 `OpenAI Codex` 学，并不意味着 Helm 要变成它们。

Helm 不应直接照搬：

- 通用 coding IDE shell
- plugin / worker marketplace
- default team mode
- broad auto-write
- broad auto-send
- 高风险自动承诺

原因很简单：

- 这些能力不直接提升 Helm 当前最核心的 judgement/business/control 价值
- 还会把 Helm 从 current-main 边界带偏成更泛化的平台工程

## 8. 最终判断

这轮 gap 结论可以收成一句话：

Helm 相对 `Claude Code` 和 `OpenAI Codex` 最值得补的，不是更多 agent surface，而是把当前已经成形的 `runtime substrate + memory + worker / skill / resource + extension + review gate` 进一步工程化成更正式的 harness 基础设施。

清晰改进顺序是：

1. `Extension Bundle + Capability Manifest`
2. `Capability Resolution Engine`
3. `Monitor Substrate`
4. `Memory Observability And Budgeting`
5. `Swarm Isolation + Task Ledger + Plan Gate`
6. `Runtime Server / App Server Seam`
7. `Sandbox Roadmap`

## 9. 参考基线

外部公开资料：

- [Claude Code repository](https://github.com/anthropics/claude-code)
- [Claude Code Plugins](https://code.claude.com/docs/en/plugins)
- [Claude Code Subagents](https://code.claude.com/docs/en/sub-agents)
- [Claude Code Hooks](https://code.claude.com/docs/en/hooks)
- [Claude Code Permissions](https://code.claude.com/docs/en/permissions)
- [Claude Code Memory](https://code.claude.com/docs/en/memory)
- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [Claude Code Common Workflows](https://code.claude.com/docs/en/common-workflows)
- [Claude Code Sandboxing](https://code.claude.com/docs/en/sandboxing)
- [OpenAI Codex repository](https://github.com/openai/codex)
- [OpenAI Codex overview](https://developers.openai.com/codex/overview)
- [OpenAI Codex use cases](https://developers.openai.com/codex/use-cases)
- [Introducing Codex](https://openai.com/index/introducing-codex/)
- [Codex is now generally available](https://openai.com/index/codex-now-generally-available/)
- [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/)

仓库内当前真值：

- [AGENTS.md](../../AGENTS.md)
- [README.md](../../README.md)
- [WORKING-CONTEXT.md](../../WORKING-CONTEXT.md)
- [HELM_AGENT_RUNTIME_SUBSTRATE_PHASE1_FREEZE_REPORT_V1.md](HELM_AGENT_RUNTIME_SUBSTRATE_PHASE1_FREEZE_REPORT_V1.md)
- [HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md](../product/HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md)
- [HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md](../product/HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md)
