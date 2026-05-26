---
status: active
owner: helm-core
created: 2026-03-30
review_after: 2026-06-28
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Operating System Pilot 001 Runbook

## Purpose

这份 runbook 用来执行 **Helm Operating System Pilot 001**。

它服务的是当前已经落地的 operating-system closure：

- object state substrate
- skill catalog
- event signals
- recommendation bound to memory and events
- approval boundary / reason chain
- readiness diagnostics
- dashboard arbitration

它是一个 **manual pilot execution guide**，不是功能说明书，也不是效果结论。

## Current-main truth

Pilot 001 必须始终建立在当前主干 reality 上，不允许在现场或报告里写成别的形态：

1. 根目录 `app/` 仍然是 route owner
   - root `app/` 仍然是 route owner
2. `data/queries.ts` 仍然是 compatibility façade / aggregation seam
3. 当前主干没有执行目录叫 `apps/helm-app`
4. 当前主干没有执行目录叫 `packages/helm-control`
5. shell thinning 尚未启动，不能在 pilot 文档里暗示已经完成
6. 这套 pilot package 用于 **manual pilot execution / observation**
7. 这套 pilot package **不代表** workflow control、send authority 或 commitment authority

## Surfaces in scope

Pilot 001 只覆盖四个当前已经接上 operating-system cue 的页面：

- dashboard
- approvals
- memory
- diagnostics

这四页共同代表的 operating loop 是：

`dashboard arbitration → recommendation → approval boundary → follow-through / manual next step → memory update / correction → diagnostics / readiness`

## Suggested Pilot 001 size

- Duration: `45 to 60 minutes`
- Real cases: `3 to 5`
- Primary user: `1`
- Collaborator observer: optional but strongly preferred

## Recommended session roles

至少建议记录这几个角色：

- pilot lead / observer
- primary user
- collaborator observer if available

如果没有协作者旁听，也要在记录里明确写出：

- 本轮没有 collaborator observer
- 与协作者视角相关的观察仅属于 manual inference，不算真实协作者反馈

## Pre-flight gate

Before starting Pilot 001, confirm:

- `npx tsx scripts/helm-operating-system-outcome-snapshot.ts`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run typecheck`
- `npm run lint`

If any of these fail, stop the session and fix the environment first.

## Session structure

建议按下面顺序执行，不要跳：

1. pre-session snapshot run
2. dashboard arbitration walkthrough
3. approval boundary walkthrough
4. follow-through / manual next step walkthrough
5. memory update / correction walkthrough
6. diagnostics / readiness walkthrough
7. collaborator reading pass
8. governance / non-commitment pass
9. debrief

## Core pilot questions

本轮只回答这三类问题：

1. 用户能不能一眼看懂：
   - 发生了什么
   - Helm 已经准备了什么
   - 现在该我决定什么
2. 协作者能不能一眼看懂：
   - 谁在看
   - 谁在推
   - 当前 boundary posture 是什么
3. 系统会不会被误读成：
   - workflow control
   - send authority
   - commitment authority

补充交叉问题：

- dashboard arbitration 是不是真的像“今天先做哪件事”的中心，而不是信息拼盘？
- approvals 是不是真的像 AI boundary console，而不是普通审批队列？
- memory 是不是真的像 object state substrate，而不是 timeline storage？
- diagnostics 是不是真的像“能不能继续放大这套 pilot”的判断页，而不是 generic health page？

## Close-out thresholds

Use `go` only when:

- the primary user can clearly explain what changed, what Helm prepared, and what matters now
- the collaborator can clearly explain who is pushing/reviewing and what the current boundary posture is
- no accidental commitment, send-authority, or workflow-control misread is observed

Use `conditional-go` when:

- the core loop feels valuable
- but wording, hierarchy, or governance cues remain partly unclear

Use `no-go` when:

- the loop still reads like disconnected pages
- or the user cannot identify what changed / what to do now
- or boundary/governance cues are materially misread

## Non-goals

Pilot 001 这轮 **不验证**：

- measured business impact
- no telemetry-based attribution
- no send-authority validity
- no workflow-control validity
- route-owner migration completion
- shell-thinning completion
- broader platformization

## Required artifacts for each pilot run

每次 pilot run 至少要留下：

- timestamp
- participants
- snapshot output attached or copied
- surfaces actually reviewed
- real cases actually reviewed
- manual observations
- pass/fail or go/no-go note
- follow-up risks / issues

## Working files for the first real session

Use these files for the first real session:

- Raw notes: `docs/reviews/HELM_OPERATING_SYSTEM_PILOT_001_RAW_NOTES.md`
- Filled report: `docs/reviews/HELM_OPERATING_SYSTEM_PILOT_001_REPORT.md`
- Findings backlog: `docs/reviews/HELM_OPERATING_SYSTEM_PILOT_001_FINDINGS_BACKLOG.md`

## Measurement classification

所有记录都只允许落进这三类：

### grounded measurable coverage

只能写当前代码 / 页面 / cue 能直接证明的内容，例如：

- object-state layer present
- dashboard arbitration cues present
- approval boundary cues present
- readiness gate cues present

### manual observation

只能写本轮 session 中真实看到、真实听到、真实记录到的人工观察。

### not measurable yet

如果当前系统和本轮 session 无法支持判断，就必须明确写成 `not measurable yet`，不能补推断。
