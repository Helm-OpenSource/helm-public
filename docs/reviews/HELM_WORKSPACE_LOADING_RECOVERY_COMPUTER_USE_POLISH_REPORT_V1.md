---
status: archived
owner: helm-core
created: 2026-04-22
review_after: 2026-10-19
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: filename matches closeout/freeze/report/audit/sprint/run pattern
---
# Helm Workspace Loading Recovery Computer Use Polish Report v1

日期：2026-04-21
状态：Targeted Validation Passed

## 结论

本轮用 Computer Use 在 Safari 里直接进入 `localhost:3000/reports` 与 `localhost:3000/dashboard`，确认页面会停在全局 fallback，只显示“正在载入经营分身控制台...”。这对真实用户不可恢复：不知道是在等数据、等会话、还是已经卡住，也没有下一步入口。

本轮已把全局 `app/loading.tsx` 收成“工作区与权限确认中”的恢复状态：提供 `回到登录入口` 与 `重新进入工作台` 两个明确动作，并说明该页面不会生成报告、审批动作或对外发送内容。

继续用 Computer Use 复评时，发现 no-cookie 硬导航仍会进入 workspace RSC streaming fallback。第二刀已补 `proxy.ts`：当请求没有 `helm-auth-session` cookie 且目标是工作区页面时，先导到 `/login`，避免用户先落入不可完成的 protected route loading。

## 影响面

- `app/loading.tsx`
- `proxy.ts`
- `lib/auth/session-cookies.ts`
- `lib/auth/workspace-route-guard.ts`
- `lib/auth/workspace-route-guard.test.ts`
- `lib/auth/session.ts`
- `lib/presentation/loading-recovery.ts`
- `lib/presentation/loading-recovery.test.ts`
- `scripts/decision-first-boundary-check.ts`
- `PLANS.md`
- `docs/README.md`

## Computer Use 观察

- Safari 当前 URL：`localhost:3000/dashboard`
- 可见内容：只剩一条全局 loading 文案
- 用户问题：没有恢复入口，也没有安全边界提示
- 本轮判断：先提升可恢复性；随后对缺少 auth cookie 的工作区页面硬导航，在 Next proxy 层提前进入登录入口

## 已经完整成立

- 全局 loading fallback 不再只是 generic wait state
- fallback 提供可点击恢复动作
- fallback 明确不会执行经营动作、报告生成、审批或对外发送
- recovery copy 有独立 presentation helper 与单元测试
- no-cookie 工作区页面硬导航会在 Next proxy 层导向 `/login`
- shell fallback 守卫已改为检查 recovery contract，而不是旧的等待文案

## 已成形但仍需下一层

- 过期 / 被撤销 / DB 不可用的 auth session 仍由 server session 链路处理
- `/reports` 的真实数据加载路径仍需继续用 Computer Use + server logs 复核
- 全站 `error.tsx` / `not-found.tsx` / workspace loading skeleton 还没有统一 recovery contract

## 刻意未做

- 不改 DB auth session、workspace membership 或 permission contract
- 不改 reports / dashboard server data fetching
- 不改审批、报告生成、自动执行或发送权限

## 风险项

1. 如果浏览器持有异常 session cookie，用户仍可能进入 fallback，需要下一轮继续追 DB session 链路。
2. 这轮改动不能被解释成所有 session 根因已经修复。
3. fallback 的英文 / 中文文案需要继续和后续 error boundary 统一。

## 验证清单

已执行：

```bash
npm run test -- lib/presentation/loading-recovery.test.ts lib/auth/workspace-route-guard.test.ts
npm run typecheck
npm run self-check
npm run check:boundaries
npm run lint
npm run build
npm run quality:regression
git diff --check
```

结果：

- `loading-recovery` 与 `workspace-route-guard` tests：2 files / 5 tests passed
- `typecheck`：passed
- `self-check`：passed
- `check:boundaries`：passed，shell fallback guard 已检查 `proxy.ts` 与 recovery copy
- `git diff --check`：passed
- `lint`：passed，仍有 7 个既有 warning
- `build`：passed，仍有既有 Turbopack NFT warning；`middleware.ts` 已迁到 Next 16 `proxy.ts`，不再出现 middleware deprecation warning
- `quality:regression`：51 files / 180 tests passed
- no-cookie GET：`curl -i http://localhost:3000/reports` 返回 `307 Temporary Redirect`，`location: /login`
- no-cookie HEAD：`curl -I http://localhost:3000/reports` 返回 `307 Temporary Redirect`，`location: /login`
- Computer Use：已确认修改前 `/dashboard` / `/reports` 会停在旧 fallback；已确认修改后 fallback copy 可见。迁到 `proxy.ts` 后 Safari window state 一度返回 `cgWindowNotFound`，最终 no-cookie redirect 以 HTTP GET / HEAD 复核。
