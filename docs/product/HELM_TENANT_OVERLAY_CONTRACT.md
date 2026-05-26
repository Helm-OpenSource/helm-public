---
status: active
owner: helm-core
created: 2026-05-17
review_after: 2026-08-15
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Tenant Overlay Contract

更新时间：2026-05-17

适用范围：Open Core / Enterprise / Cloud 架构中的 tenant-specific branding、copy、locale、extension enablement 与 private config references

实现状态：Phase 2 最小 contract 已落地；当前提供 TypeScript contract、validator、locale fallback helper 与只读 runtime resolver，不接 DB schema、API、UI、Pack SDK 或 marketplace，也不读取 secret / private files

## 1. 结论

Tenant Overlay 是部署侧或私有租户仓提供的**客户覆盖层**。它只能表达：

- 品牌 / 主题 / copy 覆盖
- locale 默认值与 supported locale
- workspace extension enablement
- connector config / private asset 的 opaque reference

Tenant Overlay 不是 Pack，不是 license / entitlement，不是 marketplace install，不是 schema migration，也不授予 auto-send / broad auto-write / silent CRM write / external side effect authority。

## 2. 当前代码入口

- Contract / validator：[../../lib/tenant-overlays/contract.ts](../../lib/tenant-overlays/contract.ts)
- Contract tests：[../../lib/tenant-overlays/contract.test.ts](../../lib/tenant-overlays/contract.test.ts)
- Read-only resolver：[../../lib/tenant-overlays/resolver.ts](../../lib/tenant-overlays/resolver.ts)
- Resolver tests：[../../lib/tenant-overlays/resolver.test.ts](../../lib/tenant-overlays/resolver.test.ts)

## 3. Contract Shape

最小字段：

```ts
type TenantOverlayDefinition = {
  tenantKey: string;
  displayName: string;
  source: "open_core_example" | "deployment_config" | "private_tenant_repo";
  capabilities: Array<
    | "brand_theme"
    | "copy_override"
    | "locale_default"
    | "extension_enablement"
    | "connector_config_reference"
  >;
  locale: {
    defaultLocale: "zh-CN" | "en-US";
    supportedLocales: Array<"zh-CN" | "en-US">;
  };
  branding?: {
    productName?: string;
    logoAssetRef?: string;
    themeTokenSet?: string;
    poweredByHelm: {
      mode:
        | "default_visible"
        | "customized_by_user"
        | "contracted_white_label";
      trademarkGrant: "none" | "enterprise_contract" | "opc_contract";
    };
  };
  enabledExtensionKeys?: string[];
  connectorConfigRefs?: string[];
  privateAssetRefs?: string[];
  copyOverrides?: Array<{
    scope: "ui" | "email" | "report";
    key: string;
    locale: "zh-CN" | "en-US";
    valueRef: string;
  }>;
};
```

`connectorConfigRefs`、`privateAssetRefs`、`branding.logoAssetRef` 与 `copyOverrides.valueRef` 只能是 opaque reference：

- `env://...`
- `private-file://...`
- `tenant-asset://...`
- `vault://...`

它们不得内联 URL、token、password、secret 或客户系统真实凭据。

## 4. Branding / Trademark Rule

Apache-2.0 允许用户修改代码和 UI，因此 Open Core 不能声称运行时强制保留 `Powered by Helm`。

Tenant Overlay 的 branding contract 只记录 Helm 官方发行、Enterprise / OPC 合同和私有部署之间的支持边界：

| Mode | 含义 | 要求 |
| --- | --- | --- |
| `default_visible` | 官方默认展示 `Powered by Helm` | 不要求商标授权 |
| `customized_by_user` | 用户自行修改 UI / copy | 不授予 Helm 商标使用权 |
| `contracted_white_label` | Enterprise / OPC 合同支持的白标 | 必须有 `enterprise_contract` 或 `opc_contract` |

## 5. Locale Fallback

`resolveTenantOverlayLocale()` 的顺序为：

1. request locale
2. user locale
3. workspace default locale
4. overlay default locale

只有精确落在 overlay `supportedLocales` 中的值才会被采用。未知 locale 不会被自动 coercion 成 `zh-CN`，避免英文发行版被错误回退到中文。

Tenant overlay 可以声明单语言租户。中文-only overlay 应使用 `defaultLocale: "zh-CN"` 且 `supportedLocales: ["zh-CN"]`；request / user / workspace 的 `en-US` 不应让该租户 surface 渲染英文版。

## 6. Validation Rules

`validateTenantOverlayDefinition()` 当前检查：

- `tenantKey` 必须是 lowercase kebab-case
- `source` 必须是三类受控来源之一
- `capabilities` 只能使用允许集合且不能重复
- `defaultLocale` 必须包含在 `supportedLocales`
- `enabledExtensionKeys` 必须稳定且不能重复
- private refs 必须是 opaque refs
- `contracted_white_label` 必须绑定 Enterprise / OPC 商标授权
- 任意嵌套对象不得声明 `autoSend`、`autoWrite`、`silentCrmWrite`、`schemaMigration`、`licenseEntitlement` 等 authority grant

## 7. Runtime Resolver

`resolveTenantOverlayForTenantKey()` 是当前唯一 runtime-oriented 入口。它是 pure function：

- 输入：`tenantKey` 与候选 overlay 数组
- 输出：`matched` / `not_found` / `blocked`
- `matched` 只返回 read-only runtime view：branding、locale、enabled extension key list、copy override refs、connector config refs 与 private asset refs
- `not_found` 不报错，表示该 workspace / tenant 没有 overlay
- `blocked` 用于空 lookup key、matching overlay invalid、duplicate tenant key 等 fail-closed 场景

它刻意不做：

- 不读 `process.env`
- 不读文件系统
- 不查数据库
- 不 dereference `env://` / `vault://` / `private-file://` / `tenant-asset://`
- 不启用 extension
- 不修改 workspace
- 不授予 trademark、license、entitlement、schema migration 或执行权限

## 8. No-Go

当前 contract 明确不做：

- tenant overlay DB persistence
- tenant overlay dynamic loader
- tenant overlay secret / asset dereference
- extension runtime enablement
- `BUILD_EDITION` license / entitlement boundary
- Pack SDK
- marketplace install
- schema migration declaration
- connector implementation
- auto-send
- broad auto-write
- silent CRM write
- external side effect authority

## 9. 下一层

只有在以下条件满足后，才进入 runtime loader：

1. Public mirror 通过 `check:public-release`、`check:secret-history` 与 clean receipt。
2. Deployment Profile env validation 已 fail-closed。
3. 至少一个私有租户仓或部署侧 overlay 样例完成人工 review。
4. Overlay loader 只读取 opaque refs，不读取真实 secret 值。
5. Runtime adoption 仍由 workspace membership、extension access 与 action approval gate 裁决。
