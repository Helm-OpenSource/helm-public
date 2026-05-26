---
status: active
owner: helm-core
created: 2026-04-07
review_after: 2026-07-06
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Design Detail Accessibility Next Slice Plan V1

更新时间：2026-04-07
结论：Completed

## 目标

把 `DESIGN.md` 的 shared guidance / preference / form-assist 结构，从 PR77 的六个核心 surface 扩到三类 detail-heavy / operator-heavy surface：

1. contact detail
2. company detail
3. inbox

并收口：

- responsive top structure
- boundary-first wording
- assist/read-only posture
- baseline / report / README / docs / guards / pilot-readiness

## 范围

- `features/contacts/contact-detail-client.tsx`
- `features/companies/company-detail-client.tsx`
- `features/inbox/inbox-client.tsx`
- baseline / plan / report
- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/pilot-readiness-check.ts`

## 不做

- 全站 redesign
- server-side preference sync
- workflow automation UI
- execution-authority expansion

## 实施顺序

### Phase 0

- 复核 `DESIGN.md` 和 PR77 shared substrate
- 状态：Completed

### Phase 1

- 重做 contact detail / company detail / inbox 顶部结构
- 接 guidance / reminders / preferences / form-assist
- 状态：Completed

### Phase 2

- 同步 baseline / report / README / docs / guards / pilot-readiness
- 状态：Completed

### Phase 3

- 运行完整验证链
- 状态：Completed
