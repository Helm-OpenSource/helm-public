---
status: active / formed-needs-next-layer
owner: helm-core
created: 2026-07-23
review_after: 2026-08-25
public_safety: Public reference runbook. Commands and evidence are synthetic or isolated; no customer endpoint, credential, policy, or production receipt.
---

# Helm CAIO 模型准入与数据出域 Runbook

> English title: Helm CAIO Model Admission and Data Egress Runbook

## 1. 运行边界

本 Runbook 用于验证 Public Core 的模型准入和出域治理链，不授予任何真实 provider、
客户数据或生产调用权限。默认状态必须满足：

- 没有生产 adapter；
- 没有 secret value；
- 没有客户 active policy；
- 没有外部副作用；
- 所有测试只使用 public-safe synthetic 数据或显式隔离数据库。

## 2. 验证顺序

### 2.1 静态与单元门

```bash
npm run check:model-egress-governance
npm run typecheck
npm run lint
npm run check:boundaries
```

成功判据：

- 直接 mutation、gateway bypass 和 raw SQL mutation 扫描为零；
- contract、gateway、OWNER-only readout 和 guard 测试全绿；
- schema、类型和边界检查全绿。

任一失败即停止，不得激活 adapter 或将测试结果描述为 production ready。

### 2.2 空库迁移重放

只允许对一次性隔离 MySQL 数据库执行。数据库名称必须带已批准的测试前缀，严禁对
Demo、开发共享库或生产库运行 reset / drop。

```bash
DATABASE_URL='<isolated-mysql-url>' npx tsx prisma/setup-db.ts prepare
DATABASE_URL='<isolated-mysql-url>' npx prisma migrate status
DATABASE_URL='<isolated-mysql-url>' npx prisma validate
```

成功判据：

- 全部迁移按顺序重放；
- `migrate status` 无 pending migration；
- Prisma schema 可验证；
- 没有绕过现有数据库保护。

### 2.3 隔离 MySQL 行为验证

```bash
DATABASE_URL='<isolated-mysql-url>' \
MODEL_EGRESS_STORE_DATABASE_URL='<isolated-mysql-url>' \
MODEL_EGRESS_STORE_TEST_DATABASE_NAME='<approved-test-db-name>' \
npm run test:model-egress:mysql
```

测试会再次确认 URL、数据库名称和允许前缀。成功判据至少包括：

- blocked decision 不可 claim；
-并发 claim 只有一个赢家；
-相同 claim 可幂等重放，不同 gateway/runtime 不可抢占；
- route 并发槽位在终态回执前保持占用；
- policy 撤销或 readiness 失效后 claim fail closed；
- 实际输入或请求输出 token 超预算时拒绝终态成功回执；
- 实际费用超 route 上限、计价证据缺失或 pricing version 不匹配时保持
  `in_doubt`，不写终态；
- adapter 返回非 JSON 输出时扣留结果并记录安全错误码；
- dispatch lease 到期前拒绝 reconciliation；
- lease 到期后只允许沿原 claim 和 provider idempotency key 对账；
- terminal receipt 与 claim、前序回执和 workspace 严格绑定；
- 两个不同 decision 并发争抢 `maxConcurrency=1` 的同一路由时只有一个成功；
- 相同终态并发写入收敛为一次追加，冲突终态只有一个成功；
- `requestDisposition=unknown`、`accepted` 但无 provider request reference hash、
  或超过 signed MySQL `INT` 范围的数值都不得形成终态；
- `ModelEgressReceipt` 的合法形状 UPDATE 和 DELETE 也被数据库 trigger 拒绝；
- malformed direct write 被数据库约束拒绝。

CI 中的 `Model Egress MySQL` job 使用 MySQL 8.4 空库重放迁移并执行同一命令，
且 Build / Test 都依赖该 job。CI 配置存在不等于远端 CI 已通过；必须保留对应运行
链接或 commit check receipt 后，才能声称获得 CI 证据。

## 3. 准入准备清单

真实客户启用前必须由对应私有层和 owner 回执证明：

1. 数据资产已分类且授权未撤销；
2. route 使用精确 model version，不使用“latest”等浮动版本；
3. adapter、endpoint fingerprint 和能力完成就绪探测；
4. credential 仅以受管 reference 存储，secret value 不进 Helm 数据库；
5. deployment form、jurisdiction 和 region 明确；
6. provider retention、training use、deletion 和 terms 引用及哈希完整；
7. projector/scanner registration、hash、version 与 pricing terms、hash、
   精确 pricing version 均经 owner 批准；
8. token、费用、时延和 concurrency 上限明确；
9. fallback 每一维都完成“不更宽”验证；
10. shadow 对拍和客户批准回执存在；
11. Control Plane entitlement、BOM 和部署版本相互一致。

缺一项均不得激活。

## 4. 正常调用检查

每个允许调用应形成以下连续证据：

```text
active policy revision
→ valid readiness receipt
→ allowed ModelRouteDecision
→ pre_dispatch UNKNOWN receipt
→ one dispatch claim
→ terminal SUCCESS | FAILURE | PARTIAL receipt
```

OWNER-only 读模型应显示 terminal outcome，并保持：

- `rawContentVisible=false`
- `credentialsVisible=false`
- `dispatchAvailable=false`

读模型为空或 schema 尚未部署时返回 `null`，不得伪造健康状态。

## 5. 事故处置

### 5.1 `in_doubt`

条件：decision 已 claim，但没有 sequence 2 terminal receipt。

处置：

1. lease 未到期时停止同一 decision 的重试和 reconciliation；
2. lease 到期后，只让与 readiness 精确匹配的 adapter 使用原 provider
   idempotency key 查询既有请求；
3. 保留原 claim、完整 runtime binding 和 sequence 1 receipt；
4. provider 返回可核验终态时，由受治理 gateway 追加
   `resolutionSource=reconcile` 的 sequence 2，不得直接改表；
5. provider 返回 unknown、adapter 不支持查询或注册不匹配时继续保持 `in_doubt`；
6. 恢复得到的终态只用于事实收敛，不释放崩溃前已丢失的模型输出；
7. 未取得外部可核验结果前，不得描述为成功，也不得重新派发。

**lease 到期只是开始对账的门槛，绝不是重新发送的授权。**

### 5.2 policy 被撤销或替换

条件：head version / revocation epoch 与 decision 不一致。

处置：

- 把 dispatch claim 视为授权截止点：撤销阻止未 claim 请求，但不能撤回已经 claim
  且可能已发往 provider 的请求；
- 拒绝 claim；
- 不修改历史 decision；
- 已 claim 请求作为在途事实保留，只允许沿原 provider idempotency key 对账；
- 对新 policy 重新完成 projection 和 route decision；
- 不复用旧 decision 的 dispatch 权限。

### 5.3 readiness 过期或 runtime 漂移

条件：精确 model / adapter / endpoint 与 readiness receipt 不匹配，或 receipt 已过期。

处置：

- fail closed；
- 重新探测并生成新 readiness receipt；
- 不更新旧 receipt；
- 重新生成 route decision。

### 5.4 并发容量已满

条件：同 route 未终态 claim 数达到 `maxConcurrency`。

处置：

- 返回容量阻断；
- 不新增 claim；
- 检查是否存在长期 `in_doubt`；
- 只有已取得 terminal receipt 的 claim 才释放容量。

### 5.5 terminal receipt 落库失败

处置：

- 扣留 provider 输出；
- 保持 `in_doubt`，不写伪 UNKNOWN 终态；
- 禁止通过其他业务表补写“成功”；
- 恢复持久化后按同一 claim 和幂等键重放 terminal write。

### 5.6 fallback

只有 provider 明确不接受请求，且失败 terminal receipt 已成功落库时，才可请求一个
policy 已声明的 fallback。异常、超时、断连和未知结果不 fallback。

### 5.7 进程内执行器的状态机与 `in_doubt` 处置

适用：CAIO 推理队列由服务端进程内执行器（`lib/caio-inference/inline-execute-job.ts`）
经同步受治理 gateway 直接派发，而不是设备 worker claim / submit 的部署。

状态机（队列行，`CaioInferenceJob`）：

| 步骤 | 队列行 | 网关侧 | 说明 |
| --- | --- | --- | --- |
| 预留 | `queued → claimed`，写 preparation lease（默认 2 分钟）、新 `claimToken`、`attempt+1`、`gatewayRef`；`decisionRef` 为空 | 无 | 短事务；`gatewayRef` 有值而 `decisionRef` 为空即「进程内预留」标记 |
| 执行 | 不变 | 投影回执 → **一次** gateway 调用：claim、invoke、terminal receipt 与花费核销在同一次调用内完成 | 网络不在任何数据库事务内；不重试、不 fallback |
| 终态写入 | 以 `(id, workspaceId, claimToken, attempt, status=claimed)` 做 CAS，计数为 1 才算写入 | 已完成 | 旧线程不能覆盖新预留；CAS 失败只记 `stale`，不再写 |

终态写入按 gateway 结果分流：

- `success` / `partial` 且有正文 → 校验正文（证据只能引用冻结输入、禁止动作口径）→ `completed`，
  绑定 `decisionRef` / `dispatchClaimHash`；正文与 terminal receipt 的 `outputContentHash` 不一致 → `rejected:output_hash_mismatch`。
  校验失败 → `rejected:<闭集码>`，**不改 gateway 终态**，也不再调用 deferred dispatch 的 complete / fail / expire（终态与花费已由 gateway 结算，重复结算即重复计费）。
- `success` / `partial` 但正文为空（terminal 已存在、只回放不给正文）→ `rejected:output_lost`：已收费、无判断，**不重发**。
- `failure` → `rejected:provider_failure`；`blocked` / `not_dispatched` → `rejected:dispatch_claim_denied`。
- `in_doubt` / `unknown`，以及 claim 之后抛出的
  `terminal_receipt_persistence_failed_output_withheld`、`spend_invariant_breach_output_withheld` 或任何未分类异常
  → 行保持 `claimed`，`rejectionCode=in_doubt`。

`in_doubt` 处置（进程内执行器补充 §5.1）：

1. 回收作业（`reclaimCaioInferenceJobs`）对 `rejectionCode=in_doubt` 的行**只计数**（`inDoubt`），不清 claim、不重排队、不 dead letter；
   对 lease 已过期且带进程内预留标记（`gatewayRef` 有值、`decisionRef` 为空）的行，同样以该行自己的 CAS 元组标为 `in_doubt`，
   而不是重排队——这覆盖「网关已写终态、保存正文前进程崩溃」的情形。重排队意味着新 attempt、新 requestKey，即对已付费请求的盲目重发。
2. 仍存活的原线程可以在被标 `in_doubt` 之后用同一元组完成 `finalize`（finalize 会清掉标记）；这是避免人为制造「已收费无判断」的依据。
3. 处置路径只有两条：由受治理 gateway 用**完全相同**的请求（同 `caio-inference-inline:<jobId>:<attempt>`、同投影回执）走 §5.1 的对账得到可核验终态；
   或由操作者按 §5.1 第 7 条认定为未成功。**不得**通过手工把行改回 `queued` 来「重试」——那会换 requestKey 并重发。
4. 读出面上 `claimed` 行仍被计为 worker「working」；`in_doubt` 行长期停留时请以 `rejectionCode` 为准，而不是以状态推断有人在跑。

派发前置条件（任一不满足即 `skipped`，不消费积压）：任务类开关精确等于 `"true"`、上海时区落在复盘 cron 的小时区间内（`5 8-20 * * *` → 08:00–20:59）、
注入的停机端口 `guards.isStopped(workspaceId)` 为假。停机端口由装配方接 guardian stop / mandate 状态；Core 只定义端口。

English summary: the in-process executor reserves a queue row under a short preparation lease, makes exactly one
governed gateway call (claim, invoke and terminal settle inside the gateway), and writes the outcome with a
compare-and-swap on the reservation tuple; a doubtful or in-flight inline row is counted by reconciliation and
never requeued, because a new attempt is a new request key and therefore a blind resend of a possibly charged request.

## 6. 回滚

模型策略回滚不是删除历史记录：

1. 撤销当前 policy；
2. 激活已重新审查的旧 route policy 新 revision；
3. 生成新的 readiness receipt；
4. 新调用重新生成 decision 和 receipt chain；
5. 历史 policy、decision 和 receipt 保持不可变。

不得删除 receipt 来释放并发槽位，不得原地改 hash，也不得把旧 production receipt
复制到新 revision。Public Core 运行路径没有 receipt 硬删除能力；
法规留存期届满后的归档或删除只能通过单独审批、审计和可回滚的数据生命周期迁移处理，
不能绕过 append-only trigger 临时改表。

## 7. 交付回执模板

```text
scope:
branch:
commit:
database_kind: isolated | production-equivalent
migration_count:
static_gate:
contract_tests:
mysql_integration:
owner_readout:
real_adapter_present: false
customer_policy_present: false
customer_data_present: false
production_activation: false
remaining_blockers:
reviewer:
reviewed_at:
```

本地、合成或隔离库证据必须保持对应标签，不能升级为生产事实。

## English Summary

Validate static boundaries, contracts, empty-database replay, and isolated
MySQL behavior before any private adapter work. A claimed dispatch without a
terminal receipt is in doubt and must not be retried or reported as successful.
The dispatch claim is the authorization cutoff: revocation blocks unclaimed
requests but cannot unsend a claimed request, which remains in flight and must
be reconciled.
After the lease expires, the exact adapter may reconcile the original provider
idempotency key, but must never blindly resend it. The in-process executor
(section 5.7) follows the same rule: a doubtful or in-flight inline queue row is
never requeued, since a new attempt would be a new request. Rollback creates a newly
reviewed policy revision; it never deletes or mutates the historical decision
and receipt ledger.
