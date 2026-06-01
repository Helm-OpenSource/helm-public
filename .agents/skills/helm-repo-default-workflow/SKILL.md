# helm-repo-default-workflow

## 适用场景

用于 Helm 仓库内绝大多数非一次性微改任务，尤其是：

- `app/`、`components/`、`features/`、`lib/`、`prisma/`、`scripts/`、`tests/`、`docs/`
- route / query ownership、contract、页面、运营控制面、handoff、reporting、billing、trial、imports、memory、worker 相关改动
- 当前 main truth 对齐、readiness 推进、baseline freeze 前的标准开发任务

不用于：

- 单纯 1-2 行 typo / 文案修正
- 纯静态文件重命名且无行为变化

## 默认 skill 栈

后续在 Helm 仓库里，默认优先套这组已安装通用 skills：

- `spec-driven-development`
- `planning-and-task-breakdown`
- `incremental-implementation`
- `test-driven-development`
- `code-review-and-quality`
- `documentation-and-adrs`
- `git-workflow-and-versioning`

按触发追加：

- `frontend-ui-engineering`
  - 适用于 `app/`、`components/`、`features/*/*.tsx`、`globals.css`、shell、detail / handoff / role pages
- `api-and-interface-design`
  - 适用于 `data/queries.ts`、`features/*/actions.ts`、`lib/*contract*`、`prisma/schema.prisma`、跨模块类型与边界
- `security-and-hardening`
  - 适用于 login、membership、billing、invite、partner / contributor、imports、callback、customer-facing 承诺边界
- `debugging-and-error-recovery`
  - 适用于 test / build / e2e / eval / runtime regression、code-doc drift、self-check failure
- `ci-cd-and-automation`
  - 适用于 `scripts/`、Vitest / Playwright harness、retry wrapper、验证链、CI entrypoint 变更
- `deprecation-and-migration`
  - 适用于 legacy shim 收缩、canonical path 替换、route/query ownership 迁移、旧表达下线

与仓库内本地 skills 的推荐叠加：

- `readiness-sprint`
- `baseline-freeze`
- `decision-first-page-refactor`
- `worker-skill-resource-binding`

按主线优先切到：

- `billing-access-and-participant-ops`
  - 适用于 billing、trial、membership、seat、entitlement、participant portal、payment rail
- `imports-connectors-and-capture`
  - 适用于 imports、connectors、capture、ingest、warmup、callback、conflict handling
- `memory-recommendation-and-briefing`
  - 适用于 memory、briefing、recommendation、today focus、feedback、eval
- `handoff-reporting-and-operating-surfaces`
  - 适用于 reporting、dashboard、operating workspace、detail / handoff / role surfaces

## 默认工作流

1. 先读当前 truth
   - [AGENTS.md](../../../AGENTS.md)
   - [README.md](../../../README.md)
   - [docs/README.md](../../../docs/README.md)
   - 相关产品 / review / baseline 文档
2. 写清：
   - 当前状态
   - 本轮目标
   - 不要做的事
   - 风险与验证方案
3. 默认按 `plan -> implementation -> validation -> report` 推进
4. 先做最小可验证 slice，不顺手扩平台层
5. 代码、页面/行为、测试/守卫、文档/报告一起收口
6. 最终报告必须明确：
   - 已经完整成立
   - 已成形但仍需下一层
   - 刻意未做
   - 风险项

## 仓库内特殊规则

- 根目录 `app/` 仍是当前真实 route owner
- `data/queries.ts` 仍是当前真实查询聚合 seam
- 不把旧本地 `helm/` 子目录的实验目录形状当作 current-main truth
- recommendation / explanation / proposal 不得被写成 commitment
- 任何 customer-facing wording 只要可能被误读成外部承诺，必须补上 boundary / prerequisite / dependency / non-commitment

## 交付物

- 代码与文档改动
- README / docs / 索引同步
- 必要的 self-check / boundary / test 更新
- sprint / freeze / alignment / review 报告之一（若任务规模已达到仓库既有口径）
- 明确的验证结果

## 验证清单

`npm run check:boundaries` 是提交级硬门禁：

- 功能提交前必须通过
- `.husky/pre-commit` 在 `lint-staged` 后强制执行
- `.husky/pre-push` 在推送前再次执行
- 除非 owner 明确豁免并记录风险，不得使用 `--no-verify` 绕过

默认完整验证链：

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

如果本轮没有跑全，必须在结果里明确说明：

- 哪条没跑
- 为什么没跑
- 风险是什么

## 常见风险

- 把当前 Helm 产品仓库误当成 Kubernetes Helm Chart 仓库
- 把 readiness 写成 freeze，或把局部成立写成平台已完整成立
- 只改页面，不同步 self-check / boundary / regression / docs
- recommendation / commitment 边界变模糊
- 破坏根目录 `app/` route owner 和 `data/queries.ts` seam 的 current-main truth

## 模板引用

- [README.md](../../../docs/codex/README.md)
- [batch_task_master_template.md](../../../docs/codex/batch_task_master_template.md)
- [definition_of_done.md](../../../docs/codex/definition_of_done.md)
- [release_checklist.md](../../../docs/codex/release_checklist.md)
- [report_template_sprint.md](../../../docs/codex/report_template_sprint.md)
- [report_template_freeze.md](../../../docs/codex/report_template_freeze.md)
