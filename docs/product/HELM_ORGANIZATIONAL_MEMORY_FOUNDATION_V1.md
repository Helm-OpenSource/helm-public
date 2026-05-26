---
status: active
owner: helm-core
created: 2026-03-31
review_after: 2026-06-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Organizational Memory Foundation v1

## 状态

这是 Helm 当前第一轮正式的 Organizational Memory Foundation。
它不是“把所有历史堆在一起”，而是要解释 Helm 为什么现在这样判断、这样交接、这样守边界。

## 组织记忆包含什么

当前 Memory Layer 包含 7 类核心结构：

| 结构 | 当前定义 | 主要服务 |
| --- | --- | --- |
| replay | 当前经营链、detail chain、meeting follow-through 的回放线索 | 解释当前判断来自哪条链 |
| audit | 对关键判断、批准、修正、执行的可读审计 | 解释谁改了什么、为什么 |
| memory linkage | meeting / opportunity / contact / company / thread / approval 之间的记忆链接 | 解释对象为什么被一起看见 |
| decision trace | 当前 judgement、decision request、next step 的由来 | 解释为什么现在要拍这一步 |
| boundary trace | review-before-send、non-commitment、discussion-only、boundary-only 的痕迹 | 解释为什么现在还不能越界 |
| source-use ledger | 当前 worker / skill / resource / provider / internal usage 的使用轨迹 | 解释系统用了什么来源和执行供给 |
| operating memory | leads / customers / candidates / partners / workstreams 与 meetings / decisions / tasks / retros 的经营链记忆 | 解释 internal operating workspace 为什么现在这样排序和交接 |

## 这些结构分别服务什么判断

### replay

replay 不是历史播放，而是帮助当前页面回答：

1. 这件事为什么会浮到前台
2. 上一段 handoff 来自哪里
3. 这次 judgement 是否已经偏离原链路

### audit

audit 当前服务：

1. 谁批准了什么
2. 谁拒绝了什么
3. 谁修正了 memory
4. 哪些对象状态被改动过

### memory linkage

memory linkage 当前服务：

1. 把 meeting、opportunity、contact、company、approval、thread 接成真实业务链
2. 避免“当前 judgement 只看单页局部状态”

### decision trace

decision trace 当前服务：

1. 当前为什么会出现这条 recommendation
2. 当前为什么轮到这个角色拍板
3. 当前为什么进入这一段 handoff

### boundary trace

boundary trace 当前服务：

1. 为什么这里只能 discussion-only
2. 为什么这里只能 boundary-only
3. 为什么这里必须 review-before-send
4. 为什么 recommendation 还不能被说成 commitment

### source-use ledger

source-use ledger 当前服务：

1. worker / skill / resource 使用是否可追溯
2. billing / lifecycle / payment truth 是否有来源说明
3. internal usage 是否仍停留在 internal-only accounting，而不是对外计费说明

### operating memory

operating memory 当前服务：

1. 当前 lead / customer / candidate / partner / workstream 为什么重要
2. 最近会议、关键决策、下一步任务、复盘如何影响现在的 judgement
3. 为什么某条 handoff 要优先交给 founder / sales / delivery / customer success / recruiting / partner

## Memory Layer 如何服务 judgement

当前 Memory Layer 必须帮助页面回答：

1. 现在为什么这样判断
2. 当前判断是否有 evidence / replay / source 支撑
3. 当前判断是否还在 boundary 内
4. 当前 handoff 为什么合理

换句话说，Memory Layer 的作用不是单纯保存过去，而是直接解释当前 judgement。

## Memory Layer 如何服务 handoff

当前 handoff 不只是换页，而是带着以下 trace：

1. 来自哪里
2. 边界是什么
3. 证据是什么
4. 下一步动作是什么
5. 谁接手

## Memory Layer 如何服务 recommendation / commitment boundary

当前固定 truth：

1. recommendation 仍然只是 judgement rail 里的候选动作
2. commitment 必须有更明确的 boundary / approval / sendability 语义
3. Memory Layer 要负责把这个差异留在前台，而不是只保留在代码里

## Memory Layer 如何服务 customer-facing / internal-only 区分

当前区分依赖：

1. audience mode
2. boundary trace
3. review-before-send
4. non-commitment note
5. source-use ledger

## Memory Layer 如何服务 billing / lifecycle / payment truth

当前已经接入的 trace 包括：

1. trial / active / grace / read_only / canceled 的 lifecycle evidence
2. payment rail 的 status sync 痕迹
3. seat / entitlement / usage 的 internal operator truth

## Memory Layer 如何服务 internal operating workspace

当前 internal operating workspace 已经把这层记忆挂到：

1. leads / customers / candidates / partners / workstreams
2. meetings / decisions / tasks / retros
3. role handoff surface
4. operating home judgement

## 哪些东西当前还不是 Memory Layer

以下内容当前不是 Memory Layer：

1. 泛知识库堆叠
2. 没有当前 judgement 作用的历史归档
3. 完整知识图谱平台
4. 完整 memory engine 重写

这层当前是 Organizational Memory Foundation，不是完整 knowledge platform。
