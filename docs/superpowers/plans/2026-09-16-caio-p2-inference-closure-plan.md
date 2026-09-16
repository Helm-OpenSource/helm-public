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

## 已定：宿主复制进安小信 overlay（owner 2026-09-16 裁定 B）

唯一拥有套接字并终止 mTLS 的实现是 `overlays/helm-self/lib/workbuddy-lan/https-gateway.ts`，1800 行，
含排空与停机控制。owner 选择**复制进安小信 overlay**，不动 helm-self 在役路径。

这个选择的已知代价是：安全敏感代码有了第二份，两份会各自漂移。**所以复制必须带一道来源钉扎闸**，
把「日后有人改了原件而副本没跟」从靠人记得变成机械可判定：

- 台账记录来源路径与其 sha256、副本路径与其 sha256（复制当时的值）；
- 任一侧变了而台账没更新，检查必红，并指出是哪一侧变的；
- 更新台账是**显式动作**：要么同步副本，要么写明为什么这次不同步。红灯不许靠重算摘要糊过去。

没有这道闸就不要复制——那样等于把一个已知会漂移的东西放进仓库，只在文档里提醒。

## 切片与顺序

| 切片 | 内容 | 依赖 | 落在哪 |
| --- | --- | --- | --- |
| P2-1 | 安小信推理挂载装配：拒绝式 resolver、推理作业端口、只开 `inferenceJobsEnabled`、材料缺任一项即不挂载 | — | overlay |
| P2-2 | 宿主复制进安小信 + 来源钉扎闸（裁定 B） | — | overlay |
| P2-3 | worker 的网关 HTTP 客户端（带客户端证书）与本地模型适配器（OpenAI 兼容，指向 oMLX） | — | Core `tools/caio-inference-worker` |
| P2-4 | PKI：客户端 CA、服务端证书、worker 客户端证书的签发与轮换口径 | ← P2-2 | CP 文档 + 运维 |
| P2-5 | CP：网关进程的 env 契约键与进程托管；令牌经 OWNER CLI 在生产签发 | ← P2-1、P2-2 | CP |
| P2-6 | 端到端演练：离线（worker 停）、租约到期回收、判断产出只给创始人看 | ← 全部 | 切换后 |

## P2-1：安小信推理挂载装配

**Files:**
- Create: `overlays/anson/lib/caio/inference-gateway-deployment.ts`
- Test: `overlays/anson/lib/caio/inference-gateway-deployment.test.ts`

**Interfaces:**
- Consumes：Core 的 `createCaioAccessGatewayMount`、`createCaioAccessTokenService` / `createPrismaCaioAccessTokenPersistence`、`createCaioAuditGate` / `createPrismaCaioAuditReceiptStore`、`caioGatewayReadinessFromAuditGate`、`createInMemoryCaioSourceIpRateLimiter`，以及 `claimCaioInferenceJob` / `submitCaioInferenceJudgement`。
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
