# decision-first-page-refactor（已下线 / retired）

自 2026-10-15 起，本 skill 不再使用。工作区页面改造改按「对象优先」执行：

- 规则：[CLAUDE.md](../../../CLAUDE.md)「对象优先」一节，与 [DESIGN.md](../../../DESIGN.md) §4。
- 守卫：`npm run check:object-first-workspace`（`lib/presentation/object-first-workspace-guard.test.ts`）。

旧版要求把页面重心改成 judgement / boundary / evidence、并禁止「退回对象列表」，与新规则相反，不要再按它改页面。

Retired on 2026-10-15. Rework workspace pages object-first instead: follow the "Object-first" section of CLAUDE.md and DESIGN.en.md §4, guarded by `npm run check:object-first-workspace`. The old workflow (judgement / boundary / evidence first, never "fall back to object lists") contradicts the new rule; do not apply it.
