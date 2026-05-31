---
status: active
owner: helm-core
created: 2026-04-24
review_after: 2026-07-23
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Reserved Account Deployment Config V1

更新时间：2026-04-24

## 结论

Helm 预留账户用于承载 Helm 自己的 first-party 商业运营、推广结算、贡献方门户、program application review、formal skill review 和 Git 工程交付复盘。

部署时必须把“预留账户邮箱”和“预留 workspace identity”分开理解：

- `${HELM_SYSTEM_EMAIL}` 是 Helm 预留账户的主账号锚点，也是默认系统发信账号。
- 运行时真正决定 Helm 预留租户的是 `Workspace.workspaceClass = HELM_RESERVED` 与 `Workspace.systemKey = "helm_reserved_primary"`。
- `ALIYUN_MAIL_SYSTEM_EMAIL=${HELM_SYSTEM_EMAIL}` 只决定系统邮件 sender，不决定当前请求属于哪个 workspace。
- 普通客户 workspace 必须继续是 `CUSTOMER`，不得通过 slug、名称或邮箱复用 Helm reserved-only 功能。

## 配置目标

这份说明只解决部署配置与运营校验，不改变产品逻辑、不执行数据迁移、不开放 payout rail、不引入自动结算或股权逻辑。

部署完成后应满足：

- 只存在一个 operational Helm reserved workspace。
- Helm 预留 workspace 的 `systemKey` 固定为 `helm_reserved_primary`。
- `${HELM_SYSTEM_EMAIL}` 作为生产主账号应具备该 reserved workspace 的 `OWNER` 或等效运营成员身份。
- Git 贡献复盘、推广结算、manual settlement、participant portal admin、program application review 只在 Helm reserved workspace 可见。
- 外部 `/programs` 可以读取 Helm reserved host 的 public catalog，但这不代表客户租户可见后台结算与审核面。

## 代码配置点

| 配置点 | 当前代码位置 | 部署含义 |
| --- | --- | --- |
| Reserved system key | `lib/workspace-identity.ts` | `HELM_RESERVED_WORKSPACE_SYSTEM_KEY = "helm_reserved_primary"` |
| Reserved workspace 判断 | `lib/workspace-identity.ts` | 同时要求 `workspaceClass = HELM_RESERVED` 和 `systemKey = helm_reserved_primary` |
| Operational reserved host | `lib/workspace-reserved.ts` | reserved workspace 还必须不是 `CANCELED` |
| Demo seed | `prisma/seed.ts` | `db:reset` 后 demo workspace 会被标为 `HELM_RESERVED`，仅用于本地/演示验证 |
| 系统邮箱 | `lib/notifications/system-mail.ts` 与 `.env.example` | 默认 sender 为 `${HELM_SYSTEM_EMAIL}`，不参与 workspace routing |
| Backfill 工具 | `scripts/backfill-helm-reserved-workspace.ts` | 默认 dry-run inventory，只有显式 apply 才迁移 first-party 数据 |
| Settings visibility | `features/settings/queries.ts` | commercial / settlement / portal admin 需要 reserved workspace + capability |
| Git 复盘 visibility | `lib/workspace-identity.ts` | engineering delivery review 只允许 reserved workspace |

## 必需环境变量

生产或 staging 部署至少确认：

```bash
DATABASE_URL="mysql://..."
APP_URL="https://..."

ALIYUN_MAIL_IMAP_HOST="imap.qiye.aliyun.com"
ALIYUN_MAIL_IMAP_PORT="993"
ALIYUN_MAIL_IMAP_SECURE="1"
ALIYUN_MAIL_SMTP_HOST="smtp.qiye.aliyun.com"
ALIYUN_MAIL_SMTP_PORT="465"
ALIYUN_MAIL_SMTP_SECURE="1"
ALIYUN_MAIL_SYSTEM_EMAIL="${HELM_SYSTEM_EMAIL}"
ALIYUN_MAIL_SYSTEM_PASSWORD="<deployment-secret>"
```

`ALIYUN_MAIL_SYSTEM_EMAIL` 不得被用作租户选择器。它只影响注册、邀请、verification、participant portal 等系统邮件的发送身份。

## 数据库预检

部署前应确认 reserved workspace 唯一且 operational：

```sql
SELECT id, name, slug, status, workspaceClass, systemKey
FROM Workspace
WHERE systemKey = 'helm_reserved_primary';
```

期望结果：

- 正好 1 行。
- `workspaceClass = 'HELM_RESERVED'`。
- `status != 'CANCELED'`。
- `systemKey = 'helm_reserved_primary'`。

同时确认主账号 membership：

```sql
SELECT u.email, m.role, m.status, w.slug, w.workspaceClass, w.systemKey
FROM User u
JOIN Membership m ON m.userId = u.id
JOIN Workspace w ON w.id = m.workspaceId
WHERE u.email = '${HELM_SYSTEM_EMAIL}'
  AND w.systemKey = 'helm_reserved_primary';
```

期望结果：

- 至少 1 行 active membership。
- 推荐 `role = 'OWNER'`；最小也必须满足当前运营面所需 capability。
- 如果生产主账号尚未写入数据库，应通过正式用户创建/邀请流程补齐，不要把系统邮箱变量误认为用户账号已经存在。

## 部署步骤

1. 先完成数据库 migration，确保 `Workspace.workspaceClass` 与 `Workspace.systemKey` 字段存在。
2. 创建或确认唯一 Helm reserved workspace：`workspaceClass = HELM_RESERVED`，`systemKey = helm_reserved_primary`。
3. 创建或确认 `${HELM_SYSTEM_EMAIL}` 用户，并将其加入 Helm reserved workspace。
4. 配置 Aliyun system mail secrets，确保 `ALIYUN_MAIL_SYSTEM_EMAIL=${HELM_SYSTEM_EMAIL}`。
5. 如果历史 first-party 商业数据落在普通 workspace，先运行 dry-run inventory。
6. 只有确认 source workspace 确实承载 Helm first-party 数据后，才显式运行 apply backfill。
7. 运行验证命令，确认普通客户租户不可见 Git 贡献与结算后台面。

## Backfill 命令

默认只做盘点：

```bash
npm run backfill:helm-reserved:inventory
```

显式迁移某个 source workspace：

```bash
npm run backfill:helm-reserved:apply -- --source-workspace-id=<workspaceId>
```

约束：

- apply 不是 automatic tenant classification。
- apply 只迁移 Helm first-party `commercial / program / portal / settlement` 数据链。
- `CapabilityCatalogEntry` 与 `SkillSuggestion` formal review 仍是 inventory-only，不自动迁移。
- 如果 target-key collision 或 cross-workspace integrity preflight 失败，必须人工处理，不得绕过。

## 可见性边界

当前 reserved-only 可见性按以下规则部署：

- Git engineering delivery review 只在 Helm reserved workspace 渲染。
- Settings 内的 contribution registry、manual settlement、participant portal admin、program application review 只在 Helm reserved workspace 渲染。
- Participant portal self-only 访问仍锚定 Helm reserved workspace，但不等于贡献方可管理后台。
- Public `/programs` 读取 Helm reserved host catalog，但 public catalog 不等于 marketplace，也不等于客户租户可见内部结算数据。
- `.mailmap` 只影响 Helm 内部 git readout，不改变 GitHub 官方 contribution graph。

## 禁止配置

- 不得把普通客户 workspace 标成 `HELM_RESERVED`。
- 不得给多个 workspace 设置 `systemKey = helm_reserved_primary`。
- 不得用 workspace `slug`、workspace name、登录邮箱或 system mail sender 作为 reserved-only 判断依据。
- 不得把 `Helm平台` 或任何 customer workspace 作为 Git 复盘、推广结算、manual settlement 的备用 host。
- 不得把 `ALIYUN_MAIL_SYSTEM_EMAIL` 写成密钥或租户权限来源。
- 不得把 ValueAccrual、Settlement Proposal 或 manual settlement posture 写成自动付款、确定债权或股权授予。

## 验证清单

部署配置变更后至少运行：

```bash
npm run self-check
npm run check:boundaries
npm run test -- lib/workspace-identity.test.ts lib/auth/service-governance.test.ts lib/billing/foundation-service-governance.test.ts features/participant-portal/queries.test.ts
```

如本轮改动涉及 TypeScript 代码，还应运行：

```bash
npm run typecheck
npm run lint
npm run build
```

`npm run db:reset` 和 `npm run db:seed` 只适合本地、demo 或 disposable staging。生产环境不得用它们来“修复” reserved workspace，除非明确接受清库副作用。

## 故障排查

如果 `/programs` 为空，优先检查是否存在 operational `HELM_RESERVED + helm_reserved_primary` workspace。

如果 `/reports` 不显示 engineering delivery review，优先检查当前 active workspace 是否为 Helm reserved workspace。

如果 settings 里看不到推广结算或 participant portal admin，优先检查 reserved workspace identity、membership role 与 capability gating。

如果系统邮件 sender 不对，检查 `ALIYUN_MAIL_SYSTEM_EMAIL` 与 `ALIYUN_MAIL_SYSTEM_PASSWORD`，不要修改 workspace identity。

如果普通客户租户能看到 Git 贡献或结算后台面，应视为权限回归，优先检查 `canViewEngineeringDeliveryReview()` 与 `features/settings/queries.ts` 的 reserved gating。

## 当前边界

- 这不是 full multi-tenant first-party registry。
- 这不是 payment rail 或 payout execution。
- 这不是 GitHub 官方贡献归因系统。
- 这不是自动结算、自动打款或股权授予系统。
- 这只是 Helm reserved host 的部署配置与可见性边界说明。
