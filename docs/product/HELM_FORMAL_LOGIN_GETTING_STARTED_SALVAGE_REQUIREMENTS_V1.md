---
status: active
owner: helm-core
created: 2026-04-21
review_after: 2026-07-20
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Formal Login / Getting-Started Salvage Requirements V1

更新时间：2026-04-21  
状态：Requirements Freeze（salvage branch only）

## 1. 目标与结论

本需求只服务一件事：把 `codex/local-salvage-20260421` 上已经保住的 3 个本地私有 auth/onboarding 草稿，整理成一条可落地、可验证、可回滚的最小产品切片。

这条线要解决的不是“再做一个登录页”，而是：

1. 把并行草稿吸收到当前真实 `/login` 主链路，而不是保留第二个 route owner
2. 给 `/getting-started` 定义明确的进入契约，避免它作为孤立新 route 永远挂在仓库里
3. 把文档、测试、边界和验证入口补齐到仓库标准

这条线不是：

- auth system 重写
- self-serve signup / trial onboarding 重写
- 第二套 onboarding 平台
- 第二套 public entry

## 2. 当前现实

当前真实登录与 onboarding 主链路已经成立：

- `/login` 的真实 route owner 是 `app/(auth)/login/page.tsx`
- 正式登录/注册交互主入口是 `features/auth/login-panel.tsx`
- 当前 `/login` 已经把 `SimplifiedLoginPanel` 挂成 returning-member quick-entry disclosure，但它仍然只是窄子面
- `/getting-started` 当前已经收成 explicit-only orientation contract，不自动替代 `/setup?onboarding=trial` 或 `/dashboard`
- verified signup 完成后会落到 `/setup?onboarding=trial`
- password / phone-code re-entry 使用现有 `features/auth/actions.ts`

salvage 分支额外保住了 3 个草稿文件：

- `app/(auth)/login/page-optimized.tsx`
- `components/auth/simplified-login-panel.tsx`
- `app/getting-started/page.tsx`

它们当前的问题不是“代码不存在”，而是三个结构性风险：

1. `page-optimized.tsx` 不会自然生效，因为它不是当前 `/login` 的 route owner
2. `/getting-started` 没有稳定进入主流程，因为当前 auth 返回值没有显式 first-entry / first-login truth
3. 这组草稿还没有 README / docs / tests / boundaries / self-check 对齐，所以按仓库标准不能算完成

## 3. 范围内

本需求只覆盖以下范围：

### 3.1 登录入口

- 保持 `app/(auth)/login/page.tsx` 为唯一登录 route owner
- 把 `page-optimized.tsx` 中真正有价值的 presentation 吸收进真实 `/login` 页面或其共享子组件
- `SimplifiedLoginPanel` 只作为窄登录子面或可切换子视图，不单独代表完整 formal entry

### 3.2 getting-started 路由

- 保留 `app/getting-started/page.tsx` 作为候选的 first-value / orientation 页面
- 只有在“进入条件”可被当前系统稳定判定时，才允许把它接进主流程
- 在进入条件未成立前，它只能：
  - 作为显式入口页面存在
  - 或被降级为非主流程草稿

### 3.3 仓库级配套

- `PLANS.md`
- `README.md`
- `docs/README.md`
- 必要的测试与边界说明

## 4. 非目标

以下内容明确不在本轮：

- 不改 `createSession` / `AuthSession` 主体模型
- 不改 verified signup 双验证主链路
- 不重做 `/setup` trial onboarding
- 不把 `SimplifiedLoginPanel` 扩成统一 auth platform
- 不引入新的环境变量、全局 feature flag 或第二套 app tree

## 5. 产品真相

### 5.1 单一路由拥有者

登录页只能有一个 route owner：

- 允许存在共享 UI 组件
- 不允许让 `page-optimized.tsx` 与当前 `app/(auth)/login/page.tsx` 长期并行承担同一职责

最终成立标准：

1. `/login` 只由当前正式 route owner 输出
2. `page-optimized.tsx` 要么被吸收，要么退出主实施范围

### 5.2 `SimplifiedLoginPanel` 的职责

`SimplifiedLoginPanel` 只能表达窄 truth：

- 现有成员用手机号验证码回流
- 现有成员用邮箱 + 密码回流
- 不存在的手机号可以继续跳到正式 signup

它不应该承担：

- 完整 signup orchestration
- invite continuation 全链路
- OAuth fallback / compatibility entry

也就是说，它不是 `LoginPanel` 的全量替代品，而是一个可能被纳入 `/login` 的窄子面。

### 5.3 `/getting-started` 的职责

`/getting-started` 不等于 `/setup?onboarding=trial`。

两者必须分清：

- `/setup?onboarding=trial`
  - 负责 verified signup 后的正式 trial onboarding
- `/getting-started`
  - 只能负责更轻的 orientation / first-value readout

当前没有证据表明现有 auth 返回值已经提供稳定的 `isNewUser` 或同等 first-entry truth，所以：

1. 禁止根据不存在的 `isNewUser` 之类隐含字段做主流程跳转
2. 只有新增了显式、可测试、可持久化的 eligibility truth 后，`/getting-started` 才能进入自动跳转链

### 5.4 recommendation / commitment 边界

登录与 onboarding 页面仍必须保持：

- recommendation 不等于 commitment
- explanation 不等于承诺
- onboarding guide 不等于 execution platform

任何 customer-facing 文案都不能让人误解为：

- 系统已经替用户完成组织初始化之外的更深业务承诺
- `/getting-started` 已经代表正式 onboarding automation 成立

## 6. 进入契约要求

### 6.1 当前稳定契约

当前代码里已经稳定成立的是：

- verified signup -> `/setup?onboarding=trial`
- password / phone-code login -> server 返回 `redirectTo`

### 6.2 本轮禁止假设

当前本轮明确禁止：

- 假设 `loginWithPhoneCodeAction` 返回稳定的 `isNewUser`
- 假设所有第一次登录的用户都应该被送去 `/getting-started`
- 假设 returning member 与 newly verified member 能用同一条前端跳转规则区分

### 6.3 允许的最小收口方式

本轮只允许两种安全收口：

1. `/getting-started` 先保持非自动主流程，只做显式 orientation page
2. 或者先新增一个明确 helper / contract，再把它接进真实登录返回路径

## 7. 交付要求

至少交付：

1. 一份需求说明
2. 一份最小实施计划
3. `PLANS.md` 入口
4. `README.md` / `docs/README.md` 索引
5. 后续如果进入实现，再补：
   - 页面测试
   - auth follow-through 测试
   - 必要 boundary / self-check 同步

## 8. 验收标准

本条线进入“可实施”状态的标准是：

1. 需求边界已经明确：
   - 一个 route owner
   - 一个窄登录草稿组件
   - 一个条件受限的 getting-started route
2. 已经明确哪些内容是刻意未做，而不是遗漏
3. 后续实施 PR 可以直接按最小切片推进，不需要再重新解释这三条风险

本条线进入“已完成实现”状态时，至少还要额外满足：

1. `/login` 只有一个正式 route owner
2. `/getting-started` 进入条件稳定可测，或者被明确排除出主流程
3. README / docs / tests / boundaries 与页面行为一致

## 9. 验证约定

当后续真正进入实现时，默认验证链至少包括：

```bash
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
```

若某条命令无法运行，必须在实施报告中明确原因、替代验证和剩余风险。

## 10. 当前保留风险

1. salvage 分支上的 3 个文件当前仍只是“已成形但仍需下一层”
2. `SimplifiedLoginPanel` 的产品定位若不收口，后续很容易和 `LoginPanel` 形成长期双轨
3. `/getting-started` 若没有显式 eligibility truth 就进入主流程，会直接引入错误跳转和回归
