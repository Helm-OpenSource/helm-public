---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_MOBILE_COMMAND_SURFACE_IMPLEMENTATION_PLAN_V1

更新时间：2026-04-26
状态：Implementation Plan V1
当前切片：`/mobile` 最小经营推进入口，Ask Helm mobile adapter，Must Push read model，移动承接入口

## 1. 目标

把已冻结的 `Mobile Command Surface v1` 需求落成一条可验证的手机端第一屏：

1. `/mobile` 只服务当前 workspace 内的经营推进。
2. 第一屏由 `Ask Helm` 超级入口、`Must Push` 必须推进项和少量承接入口组成。
3. Ask Helm 在移动端复用现有 interpreter / access scope / related object seam，并输出更短的行动型 answer。
4. Must Push 只从现有 workspace 数据、承诺、审批、机会和 operating readout 压缩生成，不新增 schema。
5. 所有动作只跳转到现有承接页面，不执行审批、发送、付款、承诺、写回或跨 workspace 检索。

## 2. 影响面

- `app/(workspace)/mobile/page.tsx`
- `features/mobile/types.ts`
- `features/mobile/lib/adapt-ask-helm-response.ts`
- `features/mobile/lib/mobile-command-read-model.ts`
- `features/mobile/components/*`
- `tests/e2e/mobile-command-surface.spec.ts`
- `app/(workspace)/layout.tsx`
- `features/workspace/topbar.tsx`
- `features/workspace/sidebar.tsx`
- `README.md`
- `docs/README.md`
- `PLANS.md`

## 3. 关键假设

1. `/mobile` 是 jump surface，不是 execution surface。
2. Ask Helm mobile response 继承 desktop response 的 boundary note、retrieval plan 和 grounding，不自行扩大能力。
3. `Must Push` 是只读 judgement projection；卡片上的 action 只是导航到 existing surface。
4. `Memory / Approvals / Operating` 是当前阶段的稳定承接入口，不需要新建移动端状态机。
5. denied / out-of-scope / cross-workspace answer 不展示 related-object secondary action，避免边界被误读成可继续查看。
6. 语音入口当前只保留 transcript / checked contract，不做自动执行或多轮 voice loop。

## 4. 分刀计划

### 第一刀：稳定 Claude draft

- 保留 `/mobile` first screen 和 existing shell 入口。
- 补齐 Ask Helm mobile adapter 的 action mode、grounding、capability-sensitive helpers。
- 补齐 Must Push read model 的 empty / folded / severity / boundary contract。
- 补 targeted unit tests 和 Playwright mobile route baseline。

### 第二刀：完成移动承接面

- 增加 sticky mobile footer，明确 `Now / Review / Memory / Operate` 四个承接入口。
- 在 first screen 增加 `Memory` 工作承接入口，避免移动端只剩 approvals / operating。
- Ask Helm answer 增加 secondary action 展示，但 denied / out-of-scope 不允许从 related object 自动生成次级入口。
- Ask Helm answer 增加 mobile grounding summary，保留 evidence / memory / knowledge 来源感知。

### 第三刀：收口验证

- 更新 README / docs 索引 / PLANS。
- 跑 targeted mobile tests、typecheck、lint、boundary、Ask Helm eval。
- 对 DB-backed Playwright / self-check 的外部数据库前提单独记录，不把环境阻塞写成产品完成。

## 5. 不做事项

- 不新增 DB schema。
- 不新增 API route。
- 不做 mobile CRM。
- 不做 notification center。
- 不做多轮聊天历史。
- 不做真实语音执行。
- 不做自动审批、自动外发、自动付款、自动承诺或 official write。
- 不做 remote execution、worker、sandbox 或 swarm orchestration。

## 6. 验证方案

```bash
npm run typecheck
npm run test -- features/mobile/lib/adapt-ask-helm-response.test.ts features/mobile/lib/mobile-command-read-model.test.ts features/mobile/components/must-push-card.test.tsx features/mobile/components/workspace-status.test.tsx features/mobile/components/mobile-command-footer.test.tsx
npm run lint
npm run check:boundaries
npm run eval:ask-helm-access-scope
npm run eval:ask-helm-interpreter
npm run self-check
npx playwright test tests/e2e/mobile-command-surface.spec.ts
```

如果 `self-check` 或 Playwright 因本地 `DATABASE_URL` / 远端 MySQL 不可达失败，记录为环境前提，不扩大本轮实现范围。
