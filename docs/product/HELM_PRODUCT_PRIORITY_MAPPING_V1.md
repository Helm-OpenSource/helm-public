---
status: active
owner: helm-core
created: 2026-04-08
review_after: 2026-07-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm 产品优先级映射表 v1

状态：Draft  
Owner：Helm Core  
日期：2026-04-07

## 1. 目的

本表用于把《Helm 产品原则 v1》直接映射成当前阶段的任务排序标准，避免需求评审时回到“功能越多越好”的旧路径。

## 2. 评分维度

每个任务按以下五项打分，每项 0 到 2 分，总分 10 分。

### 2.1 闭环价值

- 2 分：直接推动真实业务闭环
- 1 分：间接支持闭环
- 0 分：与当前闭环无直接关系

### 2.2 角色价值

- 2 分：同时服务决策者、执行者或审计复盘角色中的关键角色
- 1 分：只服务单一辅助角色
- 0 分：角色价值不明确

### 2.3 证据链价值

- 2 分：直接增加证据、结果、复盘、审计字段
- 1 分：只增加展示
- 0 分：不形成可追溯结果

### 2.4 内部使用价值

- 2 分：公司内部下周就会用
- 1 分：内部可能会用
- 0 分：只停留在外部假设

### 2.5 复利价值

- 2 分：能沉淀为模板、规则、记忆或第二条闭环复用
- 1 分：局部复用
- 0 分：一次性功能

## 3. 优先级分档

- 9 到 10 分：P0，当前阶段必须做
- 7 到 8 分：P1，紧接 P0
- 5 到 6 分：P2，可排队
- 0 到 4 分：P3，原则上延后

## 4. 当前阶段推荐任务排序

| 任务 | 闭环价值 | 角色价值 | 证据链价值 | 内部使用价值 | 复利价值 | 总分 | 建议优先级 |
|---|---:|---:|---:|---:|---:|---:|---|
| DingTalk meetings runtime | 2 | 2 | 2 | 2 | 2 | 10 | P0 |
| Internal deployment / workspace bootstrap | 2 | 2 | 1 | 2 | 2 | 9 | P0 |
| First real business loop | 2 | 2 | 2 | 2 | 2 | 10 | P0 |
| 邮件最小真实接入 | 2 | 1 | 2 | 2 | 2 | 9 | P0 |
| CRM 最小真实接入 | 2 | 1 | 2 | 2 | 2 | 9 | P0 |
| 报表转动作链路 | 2 | 2 | 2 | 2 | 2 | 10 | P0 |
| 知识库最小接入 | 1 | 1 | 2 | 1 | 2 | 7 | P1 |
| 企业微信 foundation/runtime | 1 | 1 | 1 | 1 | 1 | 5 | P2 |
| 继续做全站 redesign 扩面 | 0 | 1 | 0 | 1 | 1 | 3 | P3 |
| 新一轮 abstract connector foundation | 0 | 0 | 0 | 0 | 1 | 1 | P3 |
| full RBAC / SCIM / org hierarchy | 0 | 1 | 1 | 0 | 1 | 3 | P3 |
| Docker / K8s / CI implementation | 0 | 1 | 0 | 0 | 1 | 2 | P3 |

## 5. 当前阶段明确 P0 主线

### P0-1 DingTalk meetings runtime

目标：让系统看见会议，并把会议推进成任务、责任人、阻塞和结果。

### P0-2 Internal deployment and workspace bootstrap

目标：让系统真正跑在公司内部日常环境里，形成可持续使用路径。

### P0-3 First real business loop

目标：从会议、报表、邮件或 CRM 输入出发，形成“输入 -> 任务 -> 责任人 -> 进度 -> 结果 -> 复盘”闭环。

## 6. 当前阶段延后项

以下任务即使重要，也不应先做：

- full RBAC
- SSO / SCIM rollout
- Docker / Kubernetes / CI implementation
- connector platformization
- foundation-only connector 扩面
- 新一轮大范围 UI 扩面

## 7. 评审规则

需求评审时，满足任一条件可直接降级：

1. 不能接到当前真实业务闭环
2. 没有证据链和结果字段
3. 内部两周内不会真实使用
4. 主要价值只是让产品“看起来更完整”
5. 会把当前路线从经营系统拉回平台工程

## 8. 当前阶段一句话优先级原则

先让 Helm 看见公司，再让 Helm 推动公司，最后让 Helm 改变公司。
