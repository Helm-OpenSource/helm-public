---
status: archived
owner: helm-core
created: 2026-04-10
review_after: 2026-10-07
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# HELM_ROLE_PRESET_FOUNDATION_AND_STARTER_SKILL_REPORT_V1

## 1. 当前状态与本轮目标

- 当前 repo 已经有 `Definition Assist v1` 与 `Skill Suggestion` 两条稳定主线
- 但“角色是什么”和“角色先该学会什么”之间还缺一层明确对齐
- 本轮只做一条窄闭环：
  - 把 9 个 `Role Preset` 整理成一份 `Role Foundation` 读法，并给每个角色补一组 suggestion-only 的 starter skill pack
  - 再让 `/dashboard` 也能诚实区分 accepted definition、draft 与 preset-led start

## 2. 本轮实现

### 2.1 已完成能力

- 新增 `lib/definitions/role-foundations.ts`
  - 把 `Role Preset`、`Soul-lite` 骨架与 `starter skill pack` 收口到同一份 canonical mapping
- 新增 `features/settings/role-foundation-preview.tsx`
  - 把这份 canonical mapping 以 suggestion-only 方式接到 `/settings`、`/setup` 与后续共享 surface
  - starter skill preview 现在会轻量读取 `workspace profileType + focusAreas`，并显示当前 workspace fit
- 新增 `features/dashboard/current-role-foundation-card.tsx`
  - 把当前成员的 accepted definition / draft / preset-led start 接到 `/dashboard`
  - dashboard 现在会复用同一份 role foundation / starter skill preview，而不是另外发明一套角色解释
- 新增 `features/settings/role-foundation-preview.test.ts`
  - 验证 starter skill preview 会稳定渲染角色标题、技能建议与 candidate-only boundary copy
- 新增 `features/dashboard/current-role-foundation-card.test.ts`
  - 验证 dashboard 会稳定区分 accepted / draft / preset-led 三种角色上下文姿态
- 新增 `lib/definitions/role-foundations.test.ts`
  - 验证 9 个角色都有稳定 foundation
  - 验证 starter pack 规模保持在 1-3 个 skill
  - 验证 boundary wording 继续保留 `candidate capability` / `formal skill` 区分
- 新增 product baseline：
  - `docs/product/HELM_ROLE_PRESET_FOUNDATION_AND_STARTER_SKILL_BASELINE_V1.md`
- 新增本 report

### 2.2 代表性对象

- 9 个 `Role Preset` 继续是角色入口，不新增新的 soul object
- 8 个正式 `OperatingSkillId` 继续是 starter pack 的唯一正式 skill 语汇来源
- starter pack 现在已经进入 `/settings` 的当前成员定义卡片、`/setup` / `/settings` 的成员邀请表单，以及 `/dashboard` 的当前成员 role foundation card
- starter pack 现在会参考当前 workspace posture / focus areas，对 readout 提示和 skill 排序做轻量 overlay
- starter pack 明确保持 suggestion-only posture，不自动获得 authority

### 2.3 文档 / 守卫 / 测试同步

- `docs/README.md` 已补索引
- README 已同步当前 product surface
- 新增单测覆盖 `role foundations` 与 `role foundation preview`
- self-check / boundary-check / pilot-readiness 当前未扩白名单，只保持现有 guard 不被误写

## 3. 刻意未做

- 不做完整 soul platform
- 不把 starter pack 自动写入 `SkillSuggestion`
- 不把 starter pack 自动 accept 成 `candidate capability`
- 不做 formal skill auto-promotion
- 不做 routing / execution authority 扩张

## 4. 验证结果

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run test -- lib/definitions/member-definition.test.ts lib/definitions/role-foundations.test.ts features/settings/role-foundation-preview.test.ts features/dashboard/current-role-foundation-card.test.ts
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

- `npm run db:reset`
  - 通过
- `npm run self-check`
  - 通过
- `npm run check:boundaries`
  - 通过
- `npm run test -- lib/definitions/member-definition.test.ts lib/definitions/role-foundations.test.ts features/settings/role-foundation-preview.test.ts features/dashboard/current-role-foundation-card.test.ts`
  - 通过
  - `4` 个 test files，`11` 个 tests 全部通过
- `npm run typecheck`
  - 通过
- `npm run lint`
  - 通过
  - 这是 repo-wide lint
- `npm run test`
  - 通过
  - `157` 个 test files，`664` 个 tests 全部通过
- `npm run build`
  - 通过
- `npm run e2e`
  - 通过
  - `23` 个 e2e tests 全部通过
- `npm run quality:regression`
  - 通过
  - `51` 个 test files，`180` 个 tests 全部通过
- 剩余风险：
  - 当前最大的风险已经从“有没有 surface”转成“后续是否会把 suggestion-only 误写成默认能力或 execution authority”

## 5. 总结回答

1. 本轮目标已经清楚：整理 role preset -> Soul-lite -> starter skill 的 repo truth
2. 代表性实现已经成立：canonical mapping 已有落点，而且 setup/settings/dashboard 现在已经能读到同一份 suggestion-only starter skill preview
3. recommendation / commitment 两条 `A-minus` 主线继续保持稳定
4. 本轮刻意未做自动赋权、自动执行和 formal-skill 晋级，避免把整理任务扩成平台工程
5. 下一阶段最该做的 5 件事：
   - 把 setup/settings 里的 starter pack readout 再收成更稳的层级与文案
   - 叠加 tenant evidence / adoption history
   - 再评估是否接到 `SkillSuggestion`
   - 给 role handoff / operating summary 读到 accepted definition
   - 如果真的进入 product surface，再补 guardrails / self-check coverage

## 6. 短表

| 分类项 | 四类归属 | 说明 |
| --- | --- | --- |
| `Role Preset` 的 `Soul-lite` 读法 | 已经完整成立 | 角色预设字段本身已足以支撑 working definition skeleton。 |
| role -> starter skill canonical mapping | 已成形但仍需下一层 | 代码、测试、文档和 setup/settings/dashboard surface 已落地，且已会参考 workspace posture / focusAreas，但还没有接到 role handoff 或 `SkillSuggestion` 主链。 |
| starter skill auto-adoption | 刻意未做 | 当前仍保持 suggestion-only，避免越权或误导成默认能力。 |
| role/skill 误读成 authority | 风险项 | 需要继续保留 `candidate capability != execution authority` 的边界表达。 |
