---
status: active
owner: Core maintainers
created: 2026-10-05
review_after: 2027-01-05
---

# 可信公共入口 / Trusted public origin

门户邀请、成员登录链接和 demo 重定向使用 `APP_URL` 的 canonical origin。生产环境必须显式配置 HTTPS origin；不得带用户名、口令、路径（末尾 `/` 除外）、查询或片段。配置缺失或无效会返回固定 `public_origin_invalid` 错误，在创建令牌、写成员或创建 demo 会话前停止，不回退到 Host / X-Forwarded-* 请求头。

Portal invitations, member login links and demo redirects use the canonical `APP_URL` origin. Production requires an explicit HTTPS origin without credentials, a non-root path, query or fragment. Missing or invalid configuration fails with `public_origin_invalid` before token issuance, member writes or demo session creation. Forwarded headers never provide fallback authority.

`development` / `test` 未配置 `APP_URL` 时只接受精确 loopback Host 和合法端口；缺少 Host 的本地工具使用本机 3000 端口。转发头始终忽略；类似 localhost 子域的字符串不算 loopback。显式但无效的 `APP_URL` 即使在开发环境也不会降级。有效的开发 HTTP origin 也必须是 loopback。

In development/test only, absent configuration permits an exact loopback Host and valid port; local tools with no Host use port 3000. Lookalike domains are rejected. Explicit invalid configuration never falls back, including development. Configured development HTTP origins must also be loopback.

部署前配置并验证 `APP_URL`，再执行上述写操作。多域租户动态 origin 不在此实现范围；如需支持，应添加显式可信域契约而不是重新信任请求头。本规则不替代角色、workspace、会话或发送能力门禁，也不声明其他 OAuth / URL helper 已全面统一。

Configure and validate `APP_URL` before these operations. Dynamic multi-domain tenancy needs an explicit trust contract; it must not restore caller-controlled forwarding headers. Existing authorization and sending gates remain required. Other OAuth/URL helpers are outside this change.

验证入口：`npm test -- lib/auth/trusted-public-origin.test.ts lib/auth/trusted-public-origin-wiring.test.ts lib/auth/trusted-public-origin-demo.test.ts`。前三组测试分别覆盖配置边界、真实 action 在副作用前的接线及真实 demo handler 的各重定向分支；默认公共 Vitest CI 会自动收集。

Validation: the three tests above exercise configuration boundaries, the actual action entrypoints before side effects, and real demo handlers. The existing public Vitest CI discovers them automatically.

新增成员操作统一在开始时验证配置，即使后来发现成员已激活也要求合法 origin；这是避免创建用户后才发现邀请地址无效的操作前置，不改变其他成员生命周期操作。 Add-member operations validate the origin up front even when an existing active membership is later reused, avoiding partial user creation before discovering invalid invitation configuration. Other membership lifecycle actions are unchanged.
