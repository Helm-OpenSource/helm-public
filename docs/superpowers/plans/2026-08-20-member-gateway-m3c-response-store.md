---
status: planning / ready-to-execute
owner: helm-core
created: 2026-08-20
review_after: 2026-09-20
public_safety: Implementation plan for the member prompt response
  persistence slice. No customer data, credential, private endpoint, or
  production-readiness claim.
---

# Member Gateway M3c (响应内容落库) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 executing-plans。

**Goal:** 落地 spec §5/§6.3/§7 的响应内容持久层,承接 M3a/M3b as-built 全部继承义务:四类写入按类落库、challenge 流、`bridgeProtectedHumanResponse` 产物落库(仓内首个 `CaioHumanResponse` 持久层)、authority 三元绑定钉死、非绩效化字面量延伸到响应回执。

**Architecture(关键决定,执行者不得偏离):**

1. **candidate_write 响应(progress_report / free_text_answer)复用 M2 信号机器**:候选类响应**就是**一条绑定 prompt 主题对象的工作信号——不建新表,组合函数走 `submitMemberWorkSignal` → `transitionMemberPrompt(cause:'respond', responseRef=信号 receiptId)`。两个事务的组合语义:信号先落库即为持久 candidate 证据(独立成立、无害);转移失败可用同 responseRef 重试;函数返回失败发生在哪一步。
2. **非候选类响应(acknowledge / refuse / pause / appeal / commitment_confirm)落新表** `MemberPromptResponseReceipt`(append-only 触发器),按 `responseClass` CHECK 分列承载:
   - 公共列:id、workspaceId、promptRef、memberRef、deviceRegistrationRef、clientId、responseKind、responseClass、challengeRef、occurredAt、`evaluationUseProhibited`(CHECK = TRUE)、createdAt;
   - protected 列:`governedResponseJson`(bridge 产物完整 canonical JSON)+ `governedResponseHash` + `governanceResponseId` + `mandateRef` + `routePath`(CHECK IN ('user_presence','local_fallback'));
   - authority 列:`externalAuthorizationRef` + 三元绑定列 `authorizedMemberRef` / `authorizedObjectRef` / `authorizedActionRef`。
   - CHECK:`responseKind IN ('acknowledge','refuse','pause','appeal','commitment_confirm')`(候选类 kind 不允许入此表);`responseClass IN ('interaction_receipt','protected_human_response','authority_bearing_action')`;class 与 kind 的配对一致性由 store 层保证(M3a `classifyMemberPromptResponse` 为真值)。
3. **challenge 复用 `MemberWorkSignalChallenge` 表**(其形状本就是通用的"一次性成员写入 challenge":objectRef/objectVersion/payloadHash/窗口):`objectRef = promptRef`、`payloadHash = sha256(canonicalJson(响应载荷))`。表名的 signal 前缀是历史命名,as-built 记录该复用决定。新增发放函数 `issueMemberPromptResponseChallenge`(镜像 issue 的判定与落库,payload 为响应载荷)。
4. **CAS 门禁强制的机械内联**:`recordMemberPromptResponse` 必须在**一个**词法 serializable `$transaction` 内完成 challenge CAS 消费 + prompt 转移 CAS + 转移回执 + 响应回执(refuse/pause/appeal/commitment_confirm 触发 respond 转移;acknowledge 不转移)。不得调用 `transitionMemberPrompt` 复合两个事务,也不得抽共享 tx helper(`client-from-parameter` finding)——转移的 CAS/回执机械代码**有意内联复制**,判定仍全部来自 M3a 契约。as-built 必须记录这一条及其原因。
5. **判定复用**:`classifyMemberPromptResponse`、`requiredTrustTier`、`judgeProtectedResponseRoute`、`bridgeProtectedHumanResponse`、`judgeAuthorityBearingAction`、`judgeMemberPromptTransition`、`decideMemberPromptDelivery`(不适用)、challenge 判定复用 signal 契约的 `judgeMemberWorkSignalChallenge`/提交窗口语义。store 零判定复制。
6. **authority 三元绑定钉死(M3a as-built 8 继承义务)**:提交输入携带授权证据声明的 `(authorizedMemberRef, authorizedObjectRef, authorizedActionRef)`;store 校验 memberRef 与提交主体一致、objectRef 与 prompt 主题对象一致、actionRef 与响应 kind 对应动作一致,任一不匹配 → `authority_binding_mismatch`。契约层同步在 `prompt.ts` 的 `judgeAuthorityBearingAction` 输入上扩展三元字段(错误码 `authority_binding_missing` / `authority_binding_mismatch`),保持判定在契约层。
7. **protected 路径**:输入携带 `{userPresenceAvailable, localFallbackAvailable, routePath}`;`judgeProtectedResponseRoute` 先判可用性;`routePath` 必须是可用路径之一(`protected_route_path_invalid`);bridge 产物必须 `validateHumanResponse` 通过才落库(`protected_response_invalid` 携带其 errors)——**注意:校验失败拒绝的是"这次落库调用"的完整性,不是响应本身**,错误信息必须引导修复输入后重提,响应权不受影响(注释成文)。

**设计真值:** spec §5/§6.3/§7;M3a plan as-built 5-9;M3b plan as-built 6-7;`lib/caio-governance/types.ts`(`CaioHumanResponse` 唯一形状真值)。

**分支:** `feat/member-gateway-m3c`(基于 m3b,PR 将 stacked 在 #370 上)。

---

### Task 1: 契约扩展(authority 三元绑定)

**Files:** Modify `lib/member-gateway/prompt.ts` / `prompt.test.ts`

`judgeAuthorityBearingAction` 输入扩展为:

```ts
export function judgeAuthorityBearingAction(input: {
  externalAuthorizationRef: string | null;
  challengeRef: string | null;
  userPresenceVerified: boolean;
  // Explicit triple binding (spec §5): the external authorization must
  // name this member, this object, and this action; nothing else can
  // substitute for it.
  authorizedMemberRef: string | null;
  authorizedObjectRef: string | null;
  authorizedActionRef: string | null;
  submittingMemberRef: string;
  subjectObjectRef: string;
  actionRef: string;
}): ContractValidation
```

新错误码:三元任一缺失 → `authority_binding_missing`;与提交侧不一致 → `authority_binding_mismatch`。既有三错误码语义不变。TDD:缺失/错配/全匹配各钉死;更新既有测试的输入形状。

Commit: `feat(member-gateway): pin authority triple binding in the contract`

### Task 2: schema + 迁移

**Files:** Modify `prisma/schema.prisma`;Create `prisma/migrations/20260820180000_member_prompt_response_store/migration.sql`

`MemberPromptResponseReceipt` 按 Architecture #2 的列与 CHECK;`@@unique([id, workspaceId])`、`@@unique([workspaceId, challengeRef])`(一 challenge 一响应)、`@@index([workspaceId, promptRef])`;Workspace 反向关系;append-only 触发器 ×2。protected/authority 专属列均 nullable,配对完整性由 store 保证(DB 层只锁枚举与 evaluationUseProhibited)。

Commit: `feat(member-gateway): add member prompt response persistence schema`

### Task 3: store `lib/member-gateway/prompt-response-store.service.ts`

模式同 M2b/M3b(server-only、Serializable 内联、lockWorkspace、错误类携带 reasons)。API:

```ts
issueMemberPromptResponseChallenge(input: {
  principal: MemberPrincipal;
  promptRef: string;
  promptVersion: number;
  responsePayload: unknown;   // canonicalJson+sha256 进 payloadHash
  ttlMs: number;
}): Promise<MemberWorkSignalChallenge>

recordMemberPromptResponse(input: {
  principal: MemberPrincipal;
  promptRef: string;
  expectedVersion: number;
  challengeRef: string;
  responsePayload: unknown;           // 与 challenge hash 绑定
  kind: "acknowledge" | "refuse" | "pause" | "appeal" | "commitment_confirm";
  receiptId: string;
  transitionReceiptId: string;        // 触发转移的 kind 需要
  now: string;
  protectedInput?: { userPresenceAvailable: boolean; localFallbackAvailable: boolean;
    routePath: "user_presence" | "local_fallback";
    mandateRef: string; reason: string; auditRefs: readonly string[];
    governanceResponseId: string };
  authorityInput?: { externalAuthorizationRef: string; userPresenceVerified: boolean;
    authorizedMemberRef: string; authorizedObjectRef: string;
    authorizedActionRef: string; actionRef: string };
}): Promise<{ outcome: "recorded"; receipt: <契约形状>; promptTransitioned: boolean }>

respondWithWorkSignal(input: { ...signal submit 输入; promptRef; expectedVersion;
  transitionReceiptId; now }): Promise<{ signalOutcome; transitioned: boolean;
  receipt?: ... }>   // 组合函数:先 submitMemberWorkSignal,后 transitionMemberPrompt
```

`recordMemberPromptResponse` 事务体:load prompt(版本校验)→ 过期清扫语义与 M3b 一致(过期即 sweep 并拒绝本次响应落库,`prompt_expired_swept`)→ challenge 行加载 + 窗口/hash/绑定判定(复用 signal 契约判定语义;`payloadHash = sha256(canonicalJson(responsePayload))`)→ 按 kind 分类:class 为 candidate_write → `candidate_response_uses_signal_path` 拒绝;protected → route 判定 + bridge + `validateHumanResponse`(失败 → `protected_response_invalid`);authority → `judgeAuthorityBearingAction`(三元)→ challenge CAS 消费 → 非 acknowledge 时内联 prompt respond 转移(CAS + 转移回执,`responseRef = receiptId`)→ 插入响应回执(protected 存完整 bridge 产物 JSON + hash)。

Commit: `feat(member-gateway): record prompt responses per write class with governance persistence`

### Task 4: 隔离 MySQL 测试 `lib/member-gateway/prompt-response-store.mysql.test.ts`

env:`MEMBER_PROMPT_RESPONSE_STORE_DATABASE_URL`。用例(≥12):acknowledge 全链(不转移、回执 class/challenge 消费);refuse 全链(转移 respond、`governedResponseJson` 过 `validateHumanResponse` 回读校验、`retaliationProhibited`、routePath);pause/appeal 同族抽一;commitment_confirm 全链(三元绑定匹配);三元错配 → `authority_binding_mismatch`;无外部授权 → `authority_missing`;双路径不可用 → `protected_response_path_unavailable`;routePath 不可用 → `protected_route_path_invalid`;candidate kind 走本函数 → `candidate_response_uses_signal_path`;challenge 重放 → 拒绝;过期 prompt → `prompt_expired_swept`(行被清扫);append-only 触发器;`respondWithWorkSignal` 组合(信号落库 + 转移,responseRef=信号回执)。本地真库全绿。

Commit: `test(member-gateway): cover response classes, governance persistence, and authority binding against MySQL`

### Task 5: 接线与收尾

`test:member-gateway:mysql` 加新测试文件;CI job GITHUB_ENV 加 `MEMBER_PROMPT_RESPONSE_STORE_DATABASE_URL`;CPV1 白名单同步;`check-member-gateway.ts` 扫描列表 + 冻结 marker(`'"acknowledge"'`、`'"commitment_confirm"'`、`"evaluationUseProhibited"`);as-built;最终整体 review;push + PR(base: `feat/member-gateway-m3b`,stacked 在 #370)。

---

## 边界声明

- `CaioHumanResponse` 形状与校验唯一真值仍在 `caio-governance`;本切片只持久化 bridge 产物,任何形状变化都到那边改。
- 落库不产生权限、不晋升事实;M2c 的候选材料化是独立切片。
- 转移机械代码的内联复制是 CAS 门禁词法规则的既定代价,判定不复制。
