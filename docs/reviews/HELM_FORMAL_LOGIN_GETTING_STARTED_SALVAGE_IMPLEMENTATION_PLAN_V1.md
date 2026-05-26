---
status: active
owner: helm-core
created: 2026-04-21
review_after: 2026-07-20
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Formal Login / Getting-Started Salvage Implementation Plan V1

更新时间：2026-04-21  
状态：In Progress
当前切片：`Slice 3 complete: /getting-started explicit-only orientation contract`

## 1. Purpose

这份计划用于把 `codex/local-salvage-20260421` 上的 auth/onboarding 草稿，收口成一条最小可实施、最小可验证、最小可回滚的执行线。

当前目标不是扩 auth，而是把“已保住的本地草稿”转成“可以进入仓库实施流程的明确切片”。

## 2. Product Principles / Priority Mapping

本计划显式引用：

1. `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
2. `docs/product/HELM_PRODUCT_PRIORITY_MAPPING_V1.md`

### 2.1 接到哪条真实业务闭环

这条线接的是：

`public entry -> formal login/signup -> setup / first-value orientation -> dashboard first judgement`

它服务的是用户从公开入口进入真实 workspace 后的 activation / first-value continuity，不是新的 auth platform。

### 2.2 服务的是决策、执行、审计还是复盘

这条线主要服务：

- 执行：让登录后的下一跳更稳定
- 决策：让 `/login` 和 `/getting-started` 的职责不再漂移
- 审计：避免未来把 salvage 草稿误当成已接线主功能

它不是复盘系统，也不是 auth analytics 扩面。

### 2.3 为什么应该现在做，而不是继续扩功能

因为当前 salvage 分支的风险是结构性的，不先收口会直接导致：

1. route owner 漂移
2. onboarding 跳转语义漂移
3. 文档、代码、验证口径继续脱节

所以这件事的优先级来自“减少主线歧义和回归风险”，不是来自新功能扩张。

## 3. 当前代码锚点

### 3.1 当前正式主链

- `app/(auth)/login/page.tsx`
- `features/auth/login-panel.tsx`
- `features/auth/actions.ts`
- `app/setup/page.tsx`

### 3.2 salvage 草稿

- `app/(auth)/login/page-optimized.tsx`
- `components/auth/simplified-login-panel.tsx`
- `app/getting-started/page.tsx`

## 4. 关键假设

1. `/login` 的 route owner 不会改成第二套文件
2. 当前 auth 返回值里没有稳定 first-entry truth，可直接证明谁应该被送到 `/getting-started`
3. `/setup?onboarding=trial` 继续承担 verified signup 后的正式 onboarding

## 5. 最小实施切片

### Slice 0 - Requirements Freeze（当前）

目标：

- 把 salvage 草稿的边界和非目标写清楚
- 防止后续把“未接线草稿”误解成“只差 merge”

交付：

- requirements 文档
- implementation plan 文档
- `PLANS.md`
- `README.md`
- `docs/README.md`

### Slice 1 - 单一路由拥有者收口

目标：

- 解决 `page-optimized.tsx` 并行 route owner 风险

做法：

1. 保留 `app/(auth)/login/page.tsx` 作为唯一 route owner
2. 评估 `page-optimized.tsx` 中真正有价值的 shell / layout
3. 采用其中一种收口方式：
   - 吸收到 `app/(auth)/login/page.tsx`
   - 或提炼成共享 presentational subcomponent
4. 不允许在最终实现里同时保留两个页面 owner 争夺 `/login` 语义

完成标准：

- `/login` 真正只剩一条 owner truth

当前结果：

1. `app/(auth)/login/page-optimized.tsx` 已退出 `app/` route owner 位置
2. 草稿 presentation 被保留为 `components/auth/login-page-optimized-draft.tsx`
3. 当前 `/login` 继续只由 `app/(auth)/login/page.tsx` 拥有

### Slice 2 - `SimplifiedLoginPanel` 窄子面接线

目标：

- 解决“组件存在但长期漂浮”的风险

做法：

1. 明确 `SimplifiedLoginPanel` 只是窄 re-entry 子面
2. 保持现有 `LoginPanel` 继续负责：
   - verified signup
   - invite continuation
   - public SSO / fallback
3. 只把 `SimplifiedLoginPanel` 接到当前正式 `/login` 页中的一个明确位置
4. 禁止把它误写成新的全量 auth shell

完成标准：

- `SimplifiedLoginPanel` 的职责在代码和页面上可见、可解释、可测试

当前结果：

1. `/login` 正式页现在会把 `SimplifiedLoginPanel` 挂成一个受控的 returning-member quick-entry disclosure
2. quick entry 默认继续是 secondary surface，不替代上方 `LoginPanel`
3. 当 `tab=password` 或 `tab=phone` 进入 `/login` 时，quick entry 会默认展开，保持 returning member 的最短读面

### Slice 3 - `/getting-started` 进入契约收口

目标：

- 解决“新 route 已存在，但主流程没有稳定进入条件”的风险

做法：

1. 先定义进入 truth，再决定是否自动跳转
2. 当前最小安全规则：
   - 在没有显式 eligibility truth 前，不允许把 `/getting-started` 自动接到现有登录返回链
3. 允许两种实现收口：
   - `A`：先把它保留为显式 orientation page，不自动跳转
   - `B`：新增明确 helper / persisted truth 后，再进入自动链

推荐：

- 先走 `A`

原因：

- 当前代码没有稳定 `isNewUser` 等价物
- 继续硬接自动跳转，会把 returning member 误送进 orientation 页面

完成标准：

- `/getting-started` 是“显式有边界地存在”，而不是“似乎应该自动生效但其实没有”

当前结果：

1. `/getting-started` 现在通过 shared helper 明确声明 `explicit_only`
2. 它会显式说明自己不是自动登录后跳转目标
3. verified signup 继续到 `/setup?onboarding=trial`，已有成员继续到 `/dashboard`

### Slice 4 - 仓库级配套补齐

目标：

- 解决“草稿接线了，但仓库标准仍不成立”的风险

至少补齐：

1. `README.md`
2. `docs/README.md`
3. 对应测试
4. 必要的 boundary / self-check 同步

## 6. 验证方案

### 6.1 文档阶段（当前）

至少验证：

```bash
git diff --check
```

### 6.2 真正进入实现后

至少补：

```bash
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
```

建议新增的定向验证：

1. `/login` route-owner 行为测试
2. `SimplifiedLoginPanel` 的 action wiring 测试
3. `/getting-started` 的 access / redirect 测试
4. post-login target helper 的单元测试（若 Slice 3 走自动化 truth）

## 7. 风险与回滚

### 7.1 主要风险

1. 过早把 `/getting-started` 接到自动链，会产生错误跳转
2. 直接用 `SimplifiedLoginPanel` 替换 `LoginPanel`，会丢掉 signup / invite / SSO 边界
3. 只改页面不补 docs/tests，会再次回到 salvage 漂浮状态

### 7.2 回滚方式

这条线必须保持可分片回滚：

- Slice 1 可以只回退 presentation 吸收
- Slice 2 可以只回退 `SimplifiedLoginPanel` 接线
- Slice 3 可以单独撤销 `/getting-started` 主流程接入

## 8. 当前结论

当前 `codex/local-salvage-20260421` 的真实状态应被表达为：

- 已经保住一组有潜力的 auth/onboarding 草稿
- 已经有可落地需求说明和最小实施计划
- 但还没有进入“功能已成立”状态

只有当 Slice 1-4 至少完成其中前 3 个，并补齐仓库级配套后，这条线才应进入真正实现与评审阶段
