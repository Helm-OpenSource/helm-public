# HELM_FEISHU_OAUTH_CALLBACK_FOUNDATION_PLAN_V1

日期：2026-05-20

## 计划范围

本轮只做 Feishu OAuth callback foundation，不做飞书全家桶。

包含：

- `FEISHU_OAUTH` provider seam
- `/api/auth/feishu/start`
- `/api/auth/feishu/callback`
- `/api/public-auth/feishu/start`
- `/api/public-auth/feishu/callback`
- 登录页与 settings readout
- env / docs / tests / self-check 同步

不做：

- Bitable read runtime
- message draft(review-first) send path
- send/write-back connector
- auto-send
- broad auto-write
- execution-authority expansion

## 验证计划

- targeted Vitest
- `npm run typecheck`
- `npm run self-check`
- `npm run check:boundaries`
- `npm run lint`
