---
status: active
owner: helm-core
created: 2026-05-17
review_after: 2026-08-15
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Deployment Profile Contract

更新时间：2026-05-16

适用范围：`HELM_RELEASE_PROFILE`、`HELM_DEPLOYMENT_REGION`、`HELM_DATA_RESIDENCY`、`HELM_DEFAULT_LOCALE`

实现状态：最小 contract 已落地；`npm run validate:env` 已接入 fail-closed 枚举校验。当前不做 license、security、source isolation、entitlement、billing、Cloud control plane 或 Enterprise feature gate。
`npm run check:public-release` 已拦截 public source 中把 Deployment Profile / `BUILD_EDITION` / `NEXT_PUBLIC_*` 当商业授权边界的误用。

## 1. 结论

Deployment Profile 只表达部署默认姿态：

- 默认发行 profile
- 默认 region hint
- 默认 data residency hint
- 默认 UI locale

它不是商业许可边界，不是源码隔离边界，不是安全边界，也不是 entitlement boundary。

## 2. 代码入口

- Contract / validator：[../../lib/deployment-profile/contract.ts](../../lib/deployment-profile/contract.ts)
- Contract tests：[../../lib/deployment-profile/contract.test.ts](../../lib/deployment-profile/contract.test.ts)
- Env validation：[../../scripts/validate-env.ts](../../scripts/validate-env.ts)
- Env defaults：[../../.env.example](../../.env.example)

## 3. Allowed Values

| Env | Allowed values | Default | 语义 |
| --- | --- | --- | --- |
| `HELM_RELEASE_PROFILE` | `community` / `enterprise` / `cloud` / `opc` | `community` | 默认 UX / 默认能力姿态提示 |
| `HELM_DEPLOYMENT_REGION` | `cn` / `global` | `global` | 部署 region hint |
| `HELM_DATA_RESIDENCY` | `cn` / `global` | `global` | 数据驻留 hint |
| `HELM_DEFAULT_LOCALE` | `zh-CN` / `en-US` | `zh-CN` | 默认 UI locale |

未知值一律 fail closed。`HELM_DEPLOYMENT_REGION` 与 `HELM_DATA_RESIDENCY` 必须一致：`cn/cn` 或 `global/global`，避免部署区域和数据驻留姿态互相打架。这个一致性校验只防止配置打错；它不证明数据已被物理隔离，也不替代 Cloud control plane 的 region / KMS / network boundary。

## 4. Boundary Posture

所有 profile 的 boundary posture 固定为：

```ts
{
  licenseBoundary: false,
  securityBoundary: false,
  sourceBoundary: false,
  entitlementBoundary: false,
}
```

商业能力必须来自 private commercial repo、server-side entitlement、合同与运维控制面，不得由 `HELM_RELEASE_PROFILE` 或 build flag 决定。

`HELM_DEFAULT_LOCALE` 可被 public runtime 读取为默认 UI 语言；`HELM_RELEASE_PROFILE`、`HELM_DEPLOYMENT_REGION`、`HELM_DATA_RESIDENCY` 和 `BUILD_EDITION` 不得在 public source 中作为商业能力 gate 使用。`NEXT_PUBLIC_*` 也不得承载 license、entitlement、SSO、audit、billing、white-label 或 enterprise/cloud 授权判断。

## 5. No-Go

- 不用 Deployment Profile 隐藏 Enterprise / Cloud 源码
- 不把 `NEXT_PUBLIC_*` 暴露的 profile 当付费权限裁决
- 不把 `HELM_RELEASE_PROFILE=enterprise` 当作多工作区 / SSO / 审计授权
- 不把 `HELM_RELEASE_PROFILE=cloud` 当作托管云隔离已成立
- 不把 `HELM_DATA_RESIDENCY` 当作数据库物理隔离证明

## 6. 下一层

下一层只允许做两类事情：

1. 在 runtime boot / deployment preflight 中复用同一 validator。
2. 把 private Enterprise / Cloud repo 的真实 entitlement、region、KMS、audit、billing gate 与该 profile 的 posture hint 分开实现。
