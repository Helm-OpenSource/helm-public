---
status: active
owner: helm-core
created: 2026-03-27
review_after: 2026-06-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Codex 工作入口

`/docs/codex/` 是 Helm 仓库里专门给 Codex 与人类协作者共用的执行基础设施目录。

这里不放具体业务功能说明，而是放：

- 可直接发给 Codex 的母模板
- 统一完成定义
- 统一发布与验证清单
- freeze / sprint 报告模板
- 本轮基础设施包的对齐报告与总报告

## 当前目录

- [batch_task_master_template.md](batch_task_master_template.md)
  - 用途：后续所有“可直接发给 Codex”的正式任务母模板
- [execution_receipt_template.md](execution_receipt_template.md)
  - 用途：当某个 PR 已完成并进入当前主干，但还需要补“当前主干执行回执”时，统一使用这份模板收口 established truth / unresolved truth / 验证链 / 直接支撑点
- [definition_of_done.md](definition_of_done.md)
  - 用途：统一完成定义与降级规则
- [release_checklist.md](release_checklist.md)
  - 用途：统一验证闭环与收口清单
- [CODEX_CLAUDE_COLLABORATION_PROTOCOL.md](CODEX_CLAUDE_COLLABORATION_PROTOCOL.md)
  - 用途：固定 Codex 指挥 Claude 的角色边界、handoff packet、accept / rewrite / reject / defer 吸收规则、验证责任和失败率控制
- [report_template_freeze.md](report_template_freeze.md)
  - 用途：Baseline Freeze 类报告模板
- [report_template_sprint.md](report_template_sprint.md)
  - 用途：Sprint / Readiness 类报告模板
- [CODEX_INFRA_PACK_ALIGNMENT_REPORT.md](CODEX_INFRA_PACK_ALIGNMENT_REPORT.md)
  - 用途：说明本轮基础设施如何接进 README / 自检 / 守卫 / 测试
- [CODEX_INFRA_PACK_SPRINT_1_REPORT.md](CODEX_INFRA_PACK_SPRINT_1_REPORT.md)
  - 用途：本轮总报告

## 仓库级执行上下文

- [WORKING-CONTEXT.md](../../WORKING-CONTEXT.md)
  - 用途：只记录当前 active queue、短周期约束、repo-local Codex 使用注意事项
- [.codex/config.toml](../../.codex/config.toml)
  - 用途：提供 repo-local `standard` / `strict` profiles、`codex_hooks` feature，以及 `explorer` / `reviewer` / `docs_researcher` 三个 scoped agent roles
- [.codex/hooks.json](../../.codex/hooks.json)
  - 用途：提供 repo-local hook routing，当前最小覆盖 `no-verify`、`git push` 目标/dirty/upstream 提醒、配置保护、设计质量检查、`console.log/console.error/debugger/TODO: remove before merge` 检查、窄 `SessionStart` bootstrap、Stop 阶段 validation 提醒
- `scripts/codex-hooks/`
  - 用途：存放 repo-local guardrail scripts，当前只做最小提醒与阻断

## 默认工作方式

后续所有 Codex 任务默认遵循：

1. 先读 [AGENTS.md](../../AGENTS.md)
2. 再读 [README.md](../../README.md) 和 [docs/README.md](../README.md)
3. 如果任务依赖当前 active queue、当前 blocker 或 repo-local Codex 用法，再读 [WORKING-CONTEXT.md](../../WORKING-CONTEXT.md)
4. 需要更保守的执行姿态时，优先使用 [.codex/config.toml](../../.codex/config.toml) 里的 `standard` / `strict` profiles、`codex_hooks` feature 与 scoped roles
5. 从本目录选择合适模板
6. 按 `plan -> implementation -> validation -> report` 推进
7. 没有验证结果，不算完成
8. 如果任务需要 Claude 参与，按 [CODEX_CLAUDE_COLLABORATION_PROTOCOL.md](CODEX_CLAUDE_COLLABORATION_PROTOCOL.md) 分配 explorer / reviewer / worker / docs-synthesizer 角色，并由 Codex 负责最终吸收和验证

当前注意：

- `.codex/config.toml` 的目标是 repo-local project layer
- `.codex/hooks.json` 的目标是 repo-local guardrail layer
- 当前本机的部分 standalone CLI utility subcommand 不一定像 interactive / app-backed project session 一样明显透出 project profile
- 当前 guardrail 只先覆盖 7 件事：`no-verify`、`git push` 目标/dirty/upstream 提醒、配置保护、设计质量检查、`console.log/console.error/debugger/TODO: remove before merge` 检查、窄 `SessionStart` bootstrap、Stop 阶段 validation 提醒
- 所以这层配置优先服务真实仓库工作流，不把 one-off CLI parse behavior 当唯一判断依据

## 与 skills 的关系

这里负责模板和规则。

`/.agents/skills/` 负责高频工作流。

推荐搭配：

- 默认仓库开发任务：`helm-repo-default-workflow`
- 商业化 / trial / portal / payment rail：`billing-access-and-participant-ops`
- imports / connectors / capture：`imports-connectors-and-capture`
- memory / recommendation / briefing：`memory-recommendation-and-briefing`
- reporting / handoff / operating surfaces：`handoff-reporting-and-operating-surfaces`
- baseline freeze 任务：模板 + `baseline-freeze`
- readiness sprint：模板 + `readiness-sprint`
- IA / 页面重构：模板 + `decision-first-page-refactor`
- worker / skill / resource：模板 + `worker-skill-resource-binding`

其中：

- [helm-repo-default-workflow](../../.agents/skills/helm-repo-default-workflow/SKILL.md)
  - 用途：把 Helm 仓库的默认通用 skill 栈、触发路由、验证链和交付格式收成单一入口
- [billing-access-and-participant-ops](../../.agents/skills/billing-access-and-participant-ops/SKILL.md)
  - 用途：把 billing、trial、membership、participant portal、payment rail 和商业边界收成同一条工作流
- [imports-connectors-and-capture](../../.agents/skills/imports-connectors-and-capture/SKILL.md)
  - 用途：把 imports、connectors、capture、ingest trust / promotion / fallback 收成同一条工作流
- [memory-recommendation-and-briefing](../../.agents/skills/memory-recommendation-and-briefing/SKILL.md)
  - 用途：把 memory、briefing、recommendation、feedback、eval 和 LLM fallback 边界收成同一条工作流
- [handoff-reporting-and-operating-surfaces](../../.agents/skills/handoff-reporting-and-operating-surfaces/SKILL.md)
  - 用途：把 reporting、dashboard、operating workspace、detail / handoff surface 的 judgement-first 规则收成同一条工作流

## 当前边界

这套基础设施是第一版，不是完整内部开发平台。当前目标只是把 Helm 的研发执行规则固化成：

- 可复用
- 可验证
- 可批处理
- 可被 Codex 直接继承

而不是新开一个平台层。
