---
status: archived
owner: helm-core
created: 2026-04-26
review_after: 2026-10-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_MOBILE_COMMAND_SURFACE_IMPLEMENTATION_CLOSEOUT_V1

更新时间：2026-04-26
状态：Implementation Closeout V1，local validation passed with DB-backed E2E blocked by database connectivity
当前切片：`/mobile` Mobile Command Surface v1

## 1. 结论

`Mobile Command Surface v1` 已收成一条窄实现线：当前 workspace 内的移动第一屏可以通过 Ask Helm、Must Push、Review、Memory 和 Operating 进入已有承接面。它是手机端经营推进入口，不是移动 CRM、聊天产品、notification center 或自动执行面。

## 2. 已经完整成立

- `/mobile` route 已存在，并通过 workspace membership session gate 进入当前 workspace。
- 第一屏包含 workspace status、Ask Helm 输入、Ask Helm mobile answer、Must Push 列表和移动底部承接导航。
- Ask Helm mobile adapter 复用现有 `AskHelmResponse`，保留 judgement、reason、primary action、secondary action、boundary note 和 grounding。
- `Must Push` read model 从现有承诺、审批、机会和 operating readout 压缩生成，不新增 schema。
- denied / out-of-scope / cross-workspace Ask Helm answer 不再展示 related-object secondary action。
- 移动 shell 入口已经进入 sidebar / topbar。
- targeted unit tests 覆盖 adapter、read model、card、workspace status、footer。

## 3. 已成形但仍需下一层

- Playwright mobile E2E 已有契约，但 DB-backed demo login 仍依赖本地 `DATABASE_URL` 或远端 MySQL 可达。
- 语音目前仍是 transcript / checked contract，没有做真实语音采集、回放或确认流。
- Must Push 当前是 read model projection；后续如果要做 worker queue 或 official write，必须另开 guarded write / proof lifecycle 分支。
- 移动端视觉已可用，但还不是独立的 native app 或 PWA command shell。

## 4. 刻意未做

- 不做自动执行、自动审批、自动发送、自动付款、自动承诺或正式写回。
- 不做 mobile CRM、BI、notification center 或聊天历史。
- 不做跨 workspace 检索或问答。
- 不新增 schema、API route、worker、sandbox、remote execution 或 swarm orchestration。
- 不把 Mobile Command 的 next step 文案表达成对外承诺。

## 5. 风险项

- 如果后续把 Ask Helm mobile answer 做成多轮聊天，产品会偏离 business operating surface。
- 如果把 Must Push action 写成“完成 / 执行 / 发送”，会破坏 recommendation / commitment 边界。
- 如果在 proof lifecycle 成立前接 official write，会过早进入高风险写回。
- 如果不维护 DB-backed E2E 前提，Playwright 只能证明契约存在，不能证明演示账号链路一直可登录。

## 6. 验证结果

```bash
npm run typecheck
# passed

npm run test -- features/mobile/lib/adapt-ask-helm-response.test.ts features/mobile/lib/mobile-command-read-model.test.ts features/mobile/components/must-push-card.test.tsx features/mobile/components/workspace-status.test.tsx features/mobile/components/mobile-command-footer.test.tsx
# passed; 5 files / 34 tests

npm run lint
# passed; 7 existing warnings, 0 errors

npm run check:boundaries
# passed

npm run eval:ask-helm-access-scope
# passed

npm run eval:ask-helm-interpreter
# passed

git diff --check
# passed

npm run build
# passed; existing Turbopack NFT trace warning remains

npm run quality:regression
# passed; 51 files / 181 tests
```

DB-backed checks：

```bash
npm run self-check
# failed only at Database Configuration: DATABASE_URL not configured

npx playwright test tests/e2e/mobile-command-surface.spec.ts
# failed before /mobile assertions at /demo login;
# Prisma cannot reach ${HELM_DB_HOST}
```

这两个失败是同一个环境前提：本地验证进程没有可用数据库连接，demo login 在 `prisma.user.findUnique()` 前置步骤失败。它不改变 `/mobile` 实现、adapter、read model、boundary、build 和 regression 的收口判断。

## 7. 下一步建议

1. 修复或标准化本地 `DATABASE_URL` / demo login E2E 前提，并复跑 `tests/e2e/mobile-command-surface.spec.ts`。
2. 在下一条独立分支补 mobile voice transcript review UI，但仍保持 no-write。
3. 等 proof lifecycle / guarded write 证据链稳定后，再评估是否在 mobile 上展示 proof-required action。
4. 如果要做 PWA / native shell，先冻结 navigation、auth persistence 和 offline boundary。
5. 不要在 Mobile Command 分支内混入 official write、worker queue 或 notification center。
