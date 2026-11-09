# Scoped usage observations / 工作区用量记录

## Contract / 契约

`recordUsageLedgerEntry` keeps its existing behavior when `operationKey` is omitted.
Opt-in callers supply a stable, server-owned operation key after checking the source object's workspace and permission.
The key identifies one logical observation, not a browser click or one provider retry. No existing caller is automatically migrated.

不传 `operationKey` 时保持原行为；选择启用的调用方须先校验业务对象归属和权限，再用服务端稳定操作键记账。
同一逻辑操作、同一工作区、同一内容重放返回原行；不同内容拒绝。操作键允许 ASCII 引用字符，最长 191 字符；内容按规范化 JSON 比较。
正向用量必须是 1..2147483647 的整数；零、小数、负数、越界均拒绝。历史无键行不回填，不改变原有校验语义。

The existing `UsageLedger` owns the nullable operation key, content fingerprint and unique reversal reference.
Unique database constraints arbitrate races; bounded retries handle only definite uniqueness or transaction-conflict failures.
An unknown commit outcome is propagated. A later replay must use the same key and content, never invent a replacement charge.

`reverseUsageLedgerEntry(input, client)` appends one full negative observation and never updates the original.
The actor must be a server-authenticated user, not a user ID supplied by an untrusted request body. The transaction locks the actual
Workspace, Membership and User, requires an active internal membership and the existing OWNER/BILLING_ADMIN billing capability.
There is no HTTP endpoint, background correction job or caller-provided authorization boolean.
This database capability recheck does not independently authenticate the caller; the existing server session remains authoritative.
数据库复核成员和权限不等于认证调用者；`actorUserId` 必须取自现有服务端认证会话，不可信任客户端提交值。

冲回仅适用于本契约的有键正向行，同一原行最多冲回一次；不能冲回跨工作区行、历史无键行或反向行。
原因使用封闭代码；修改数值采用“全量冲回 + 新操作键的正确记录”，不修改历史。重复同键同内容可重放，不同原因或身份视为冲突。
冲回的 `recordedAt` 继承原记录，表示原用量期间的净额调整；`createdAt` 保留真实更正时点。
这不是关闭财务期间的重开、客户退款或历史账单改写。需要此类功能时必须另行定义会计及授权契约。

## Boundary / 边界

This is a usage-observation correction, not a financial reversal. It creates no invoice, payment, provider call or entitlement.
Price versions, maximum charges, unknown consumption and provider attempts stay in the existing LLM spend contracts.
`LLMSpendLedgerEntry` and its signed price/FX authority are not duplicated here; missing provider cost remains unknown, never zero.
See [LLM spend contract](LLM_SPEND_RESERVATION_CONTRACT.md) and [trusted usage evidence](LLM_TRUSTED_USAGE_EVIDENCE.md).

本片不新增金额表、价格表、客户字段、真实供应商调用或收费开关。调用方不得将用量行直接等同可收费事件。
现有使用情况汇总按 `recordedAt` 加总 quantity；新增负数仅表达该期间净用量，不证明资金或回款变化。

## Verification / 验证

Run `npm test -- lib/billing/usage-ledger.test.ts lib/billing/foundation-usage.test.ts` for pure behavior and legacy compatibility.
The mandatory database command is `npm run test:usage-ledger:mysql`; without an explicitly isolated target it fails.
Local tests accept only an owned, private synthetic socket directory, verify networking is disabled and the exact data directory,
create a unique synthetic database, and drop only that database after disconnecting test clients. They never use `DATABASE_URL` as a fallback.
CI uses the existing Model Egress MySQL job's prepared ephemeral database and explicit container identity; tests fail the job normally.
Test-only inputs are `USAGE_LEDGER_MYSQL_SOCKET` locally, or `USAGE_LEDGER_MYSQL_DATABASE_URL` plus
`USAGE_LEDGER_MYSQL_CI_CONTAINER` in CI. They are mutually exclusive, not runtime feature flags.
`USAGE_LEDGER_MYSQL_REQUIRED=1` rejects a missing explicit target; an ordinary unit run skips the database suite.

持久回归覆盖独立连接并发同键、同键异内容、大小写键、跨工作区、权限撤销、唯一反向行、事务回滚及SQL约束。
合成验证不证明生产迁移、客户授权、真实计费或对账完成。临时数据库生命周期由外层有超时、空间限制和退出清理的runner负责。

## Migration and rollback / 迁移与回滚

Apply `20261109130000_usage_ledger_idempotency` before enabling any keyed writer; no historical row is rewritten.
Application rollback stops keyed writers/corrections and retains added columns and evidence. Do not call keyed writes against an old schema.
The guarded SQL rollback in `prisma/rollback/20261109_rollback_usage_ledger_idempotency.sql` refuses when any keyed evidence exists.
Do not delete evidence to make rollback pass; schema removal is only for an unused migration and requires a controlled maintenance window.

迁移是新增列和唯一约束；本地合成试验不代表获准在生产执行DDL。使用过的新列保留，先回退应用接线；不得通过删历史记录完成回滚。
