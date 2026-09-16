---
status: planning / closure-plan-pending-slices
owner: helm-core
created: 2026-09-16
review_after: 2026-10-16
public_safety: Public-safe implementation plan for closing the CAIO pull
  inference loop (tenant gateway mount serving only the two inference routes,
  socket-owning host, device-side worker client and local model adapter,
  client-certificate material discipline, process supervision). Records
  mount-time constraints read from in-tree code. No customer data, private
  endpoint, credential, certificate material, production receipt, activation,
  or production-readiness claim.
---

# CAIO 推理闭环落位实施计划（P2）

> **给执行者：** 必需子技能：用 superpowers:subagent-driven-development 或 superpowers:executing-plans 按任务逐条实施。步骤用复选框（`- [ ]`）跟踪。

**Goal:** 让安小信的复盘作业真的被认领并产出判断——网关跑在生产机 loopback，worker 跑本地 Mac Studio 的本地模型，两端经堡垒机持久隧道加双向 TLS 连通。

**Architecture:** 生产机上起一个只听回环、端口钉死 7443 的访问网关宿主，只挂载两条推理路由；本地 Mac Studio 上跑设备侧 worker，经隧道 + 客户端证书 + `hcaio_inf_` 令牌认领与提交。判断落 CAIO 自有表，先只给创始人看。

**Tech Stack:** Core `tools/caio-access-gateway`（挂载工厂）与 `tools/caio-inference-worker`（设备侧循环）、overlay 装配、CP env 契约与进程托管、oMLX/DeepSeek 本地端点（OpenAI 兼容）。

**Spec:** 本计划由 P1 总计划 A16 引出（`docs/superpowers/plans/2026-09-16-caio-p1-master-plan.md`）。

## Global Constraints

抄自实现核查，逐条是硬约束，不是偏好：

- 端口**钉死 7443**（`PORT_PINNED`），绑定地址禁止通配、禁止主机名、**禁止公网地址**。
- **mTLS 必填**：服务端证书、私钥、客户端 CA 三份绝对路径，`requireClientCertificate: true`，一律不给默认值。worker 必须持客户端证书——令牌不够。
- 挂载的必填端口里有 `projectResolver` 与 `operationResolver`，但**推理路由不调用它们**（只有「经营问题生成」与「私有执行结果」两类路由用）。因此安小信给**一律拒绝**的实现：如实声明本部署不经网关授予任何项目或能力。给「全都放行」的实现是门面，禁止。
- 挂载面**从不拥有套接字**：绑定监听的是宿主。
- 判断是 advice 类、`humanReviewerRequired=true`，先只给创始人看（owner 2026-09-16）。
- 数据不出域：模型在本地设备，网关只听回环，隧道是自有堡垒机，不新增任何公网可达的面。

## 已定：宿主上提到 Core，WorkBuddy 降为可选（owner 2026-09-16 裁定 A，改自先前的 B）

先前裁定过 B（复制进安小信）。**读完那 1800 行之后，B 的代价变了，所以裁定也改了**：

- 宿主不是「通用宿主 + WorkBuddy 用法」，而是 **WorkBuddy 优先**的：全文 80 处 WorkBuddy 引用，
  配置类型是 `HelmSelfWorkBuddyGatewayConfig`，路由器**强制**认领一条 WorkBuddy 路径
  （`claim(input.workBuddyPath, "workbuddy", ...)`）。所以「复制」实际是**分叉加手术**，
  而手术落在 mTLS 终止、排空、截止期这些路径上。
- 副本经手术后不可能与原件逐字相同，来源钉扎闸随之退化成「原件变了，去看一眼」。
- 反过来说，这个宿主**本来就是为挂访问网关设计的**：它已支持同一套接字上挂额外 surface
  （`surfaces`、`ComposedGatewaySurface`、`resolveComposedGatewaySurfaces`），
  而且要求调用者显式声明「挂」或「不挂并给理由」。

所以要改的不是结构，而是**把 WorkBuddy 从必需降为可选**，然后上提到 Core 共用一份。
只有一份安全敏感代码，钉扎闸就不需要了——没有第二份可漂移。

**分三步，把「改行为」与「搬位置」分开**，各自可评审、可回滚：

| 步 | 内容 | 判据 |
| --- | --- | --- |
| P2-2a | 在 helm-self 内把 WorkBuddy 端点降为可选（给了路径时行为逐字不变；不给时只服务 surfaces，WorkBuddy 路径 404） | 现有回归全绿 + 新增两类用例 |
| P2-2b | 把宿主上提到 Core，helm-self 改为引用；纯搬移，不改行为 | 搬移前后 helm-self 回归结果一致 |
| P2-2c | 安小信用 Core 宿主起推理网关 | 端到端演练 |

## 切片与顺序

| 切片 | 内容 | 依赖 | 落在哪 |
| --- | --- | --- | --- |
| P2-0 | **推理队列的网关端口适配器**（实施时发现的漏项：端口收裸载荷、返回值即响应体，写它的人拥有线上契约，必须由 Core 一处 own） | — | Core `lib/caio-inference/gateway-port.ts` |
| P2-1 | 安小信推理挂载装配：拒绝式 resolver、推理作业端口、只开 `inferenceJobsEnabled`、材料缺任一项即不挂载 | ← P2-0 | overlay |
| P2-2 | 宿主上提到 Core（a 降为可选 / b 搬移 / c 安小信接入，裁定 A） | — | overlay → Core |
| P2-3 | worker 的网关 HTTP 客户端（带客户端证书）与本地模型适配器（OpenAI 兼容，指向 oMLX） | — | Core `tools/caio-inference-worker` |
| P2-4 | PKI：客户端 CA、服务端证书、worker 客户端证书的签发与轮换口径 | ← P2-2 | CP 文档 + 运维 |
| P2-5 | CP：网关进程的 env 契约键与进程托管；令牌经 OWNER CLI 在生产签发 | ← P2-1、P2-2 | CP |
| P2-6 | 端到端演练：离线（worker 停）、租约到期回收、判断产出只给创始人看 | ← 全部 | 切换后 |

## P2-1：安小信推理挂载装配

**Files:**
- Create: `overlays/anson/lib/caio/inference-gateway-deployment.ts`
- Test: `overlays/anson/lib/caio/inference-gateway-deployment.test.ts`

**Interfaces:**
- Consumes：Core 的 `createCaioInferenceGatewayPort`（P2-0）、`createCaioAccessGatewayMount`、`createCaioAccessTokenService` / `createPrismaCaioAccessTokenPersistence`、`createCaioAuditGate` / `createPrismaCaioAuditReceiptStore`、`caioGatewayReadinessFromAuditGate`、`createInMemoryCaioSourceIpRateLimiter`，以及 `claimCaioInferenceJob` / `submitCaioInferenceJudgement`。
- Produces：`readAnsonCaioInferenceGatewayMount(env)` → `CaioAccessGatewayMount | null`。

- [ ] **Step 1: 先写失败的测试**——拒绝式 resolver 下两条推理路由仍然可用

```ts
const mount = readAnsonCaioInferenceGatewayMount(fullEnv);
assert.ok(mount);
assert.deepEqual([...mount.apiPaths].sort(), ["/livez", "/readyz", "/v1/inference-jobs/claim", "/v1/inference-jobs/submit", "/v1/models"]);
```

- [ ] **Step 2: 再写一条**——缺任一材料即不挂载，且拒绝是具名的

```ts
for (const key of REQUIRED_KEYS) {
  const env = { ...fullEnv, [key]: undefined };
  assert.equal(readAnsonCaioInferenceGatewayMount(env), null);
}
```

- [ ] **Step 3: 跑测试确认失败**（模块尚不存在）
- [ ] **Step 4: 实现**：拒绝式 resolver 写成两个具名常量，注释说明「本部署不经网关授予项目或能力」，并断言推理路由不消费它们
- [ ] **Step 5: 变异验证**：把拒绝式 resolver 改成放行，必须有测试失败（防止日后有人「顺手」放开）
- [ ] **Step 6: 提交**

## 放行门

- 开 `HELM_CAIO_HOURLY_REVIEW_ENABLED` 之前，P2-1 到 P2-5 全部就位，且 P2-6 的离线演练做过。
- 台账先开一天（CP #672），拿到作业结局分布再开复盘。
