---
status: archived / executed-with-as-built-record
owner: helm-core
created: 2026-08-19
review_after: 2026-09-19
public_safety: Implementation plan for the member prompt-queue contract
  slice, with as-built deviation record. No customer data, credential,
  private endpoint, or production-readiness claim.
---

# Member Gateway M3a (成员 prompt 队列契约) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 executing-plans。

**Goal:** 落地 spec §6.3(监督投递)与 §5/§7(四类写入语义、分级信任)的公共契约:成员 prompt 类型与生命周期、critical 严重度的确定性规则约束、静默期/防打扰投递判定、响应写入类分类与信任档要求、protected_human_response 到 `caio-governance` 冻结 `CaioHumanResponse` 的桥接。

**Architecture:** 纯契约切片,M1/M2a 同模式——新文件 `lib/member-gateway/prompt.ts`(+ 同址测试),复用 `ContractValidation`/`hasRef` 语义、`parseInstant`、M1 类型;**复用而非复制** `lib/caio-governance` 的 `CaioHumanResponse` 与 `validateHumanResponse`(refuse/pause/appeal 的唯一真值)。无 IO。Work Packet 依旧不可表达。

**设计真值:** spec §5/§6.3/§7;治理契约 `lib/caio-governance/types.ts`(`CAIO_HUMAN_RESPONSE_TYPES = ["refuse","pause","appeal"]`、`retaliationProhibited: true`)。

**分支:** `feat/member-gateway-m2`(继续,同一 PR 链)。

---

### Task 1: prompt 类型、冻结字面量与基础校验

**Files:** Create `lib/member-gateway/prompt.ts`, `lib/member-gateway/prompt.test.ts`

冻结字面量:

```ts
export const MEMBER_PROMPT_SEVERITIES = ["critical", "normal"] as const;

export const MEMBER_PROMPT_STATES = [
  "pending",
  "delivered",
  "snoozed",
  "responded",
  "withdrawn",
  "expired",
  "suppressed",
] as const;

// spec §5 four write classes, frozen.
export const MEMBER_RESPONSE_CLASSES = [
  "candidate_write",
  "interaction_receipt",
  "protected_human_response",
  "authority_bearing_action",
] as const;

// spec §7 trust tiers, frozen. protected_response is NOT "higher" than
// challenge_write on a severity axis — it is a distinct semantic tier with
// a guaranteed-path obligation (see judgeProtectedResponseRoute).
export const MEMBER_TRUST_TIERS = [
  "read",
  "challenge_write",
  "protected_response",
  "authority_action",
] as const;
```

类型:

```ts
export type MemberPrompt = {
  promptRef: string;
  workspaceRef: string;
  memberRef: string;
  severity: MemberPromptSeverity;
  // Frozen invariant (spec §6.3): critical severity may only come from a
  // deterministic rule, never from free-form model judgment.
  severityRuleRef: string | null;
  subjectObjectRef: string;
  projectedSummary: string;
  evidenceRefs: readonly string[];
  issuedAt: string;
  expiresAt: string;
};

export type MemberPromptDeliveryContext = {
  now: string;
  inQuietHours: boolean;
  doNotDisturb: boolean;
};

export type MemberPromptDeliveryDecision =
  | { deliver: true; heldReason: null }
  | { deliver: false; heldReason: "held_quiet_hours" | "held_do_not_disturb" | "prompt_expired" };
```

校验 `validateMemberPrompt`:refs/instants/窗口(复用 parseInstant;`expiresAt > issuedAt`);**`severity === "critical"` 且 `severityRuleRef` 为空 → `critical_severity_without_rule`**;`severity === "normal"` 且带 ruleRef 合法(规则也可产生 normal)。

投递判定 `decideMemberPromptDelivery(prompt, ctx)`:过期 → `prompt_expired`;critical 无视 quiet hours 与 DND(确定性规则背书的一分钟窗口语义);normal 在 `inQuietHours` → `held_quiet_hours`,`doNotDisturb` → `held_do_not_disturb`;其余 deliver。测试覆盖每个分支 + critical 穿透静默期。

Commit: `feat(member-gateway): add member prompt contract with deterministic-critical invariant`

### Task 2: 生命周期转移判定

**Files:** Modify `prompt.ts` / `prompt.test.ts`

```ts
export type MemberPromptTransitionCause =
  | "deliver" | "snooze" | "unsnooze" | "respond"
  | "withdraw" | "expire" | "suppress";

export function judgeMemberPromptTransition(input: {
  from: MemberPromptState;
  to: MemberPromptState;
  cause: MemberPromptTransitionCause;
}): ContractValidation
```

允许表(其余一律 `prompt_transition_invalid`;cause 与 to 不匹配 → `prompt_transition_cause_mismatch`):

| from | cause | to |
|---|---|---|
| pending | deliver | delivered |
| pending | withdraw | withdrawn |
| pending | expire | expired |
| pending | suppress | suppressed |
| delivered | snooze | snoozed |
| delivered | respond | responded |
| delivered | withdraw | withdrawn |
| delivered | expire | expired |
| snoozed | unsnooze | delivered |
| snoozed | expire | expired |
| snoozed | withdraw | withdrawn |

终态(responded/withdrawn/expired/suppressed)出发的任何转移拒绝。每条允许边与代表性拒绝边都有测试;转移本身即回执语义(append-only 由 M3b store 承担)。

Commit: `feat(member-gateway): judge member prompt lifecycle transitions`

### Task 3: 响应写入类分类、信任档与治理桥接

**Files:** Modify `prompt.ts` / `prompt.test.ts`

```ts
export const MEMBER_PROMPT_RESPONSE_KINDS = [
  "acknowledge",       // interaction_receipt
  "progress_report",   // candidate_write
  "free_text_answer",  // candidate_write
  "refuse",            // protected_human_response
  "pause",             // protected_human_response
  "appeal",            // protected_human_response
  "commitment_confirm" // authority_bearing_action
] as const;

export function classifyMemberPromptResponse(kind): MemberResponseClass
export function requiredTrustTier(cls): MemberTrustTier
// interaction_receipt/candidate_write → "challenge_write"
// protected_human_response → "protected_response"
// authority_bearing_action → "authority_action"
```

**protected 路径保障(spec §7 冻结):**

```ts
export function judgeProtectedResponseRoute(input: {
  userPresenceAvailable: boolean;
  localFallbackAvailable: boolean;
}): ContractValidation
// 两者皆不可用 → "protected_response_path_unavailable"(系统故障级错误,
// 语义是"平台失职",不是对响应的拒绝;注释必须写明:user-presence 不可用
// 时 localFallback 必须可用,响应权不得被实质剥夺)
```

**治理桥接(复用冻结契约,不复制):**

```ts
import { validateHumanResponse } from "@/lib/caio-governance/contract";
import type { CaioHumanResponse } from "@/lib/caio-governance/types";

export function bridgeProtectedHumanResponse(input: {
  responseId: string;
  mandateRef: string;        // 由治理层提供;Gateway 不创造 mandate
  responderRef: string;
  responseType: "refuse" | "pause" | "appeal";
  subjectPromptRef: string;  // 映射为 subjectWorkRef
  reason: string;
  auditRefs: readonly string[];
}): { response: CaioHumanResponse; validation: ContractValidation }
// 组装 CaioHumanResponse(status: "raised", retaliationProhibited: true)
// 后调 validateHumanResponse;返回两者。桥接不落库、不晋升、不产生权限。
```

**authority_bearing_action 判定:**

```ts
export function judgeAuthorityBearingAction(input: {
  externalAuthorizationRef: string | null;
  challengeRef: string | null;
  userPresenceVerified: boolean;
}): ContractValidation
// externalAuthorizationRef 缺失 → "authority_missing"(注释:成员身份、
// 设备签名、challenge 与 Gateway 本身都不能创造该权限;无授权即阻断,
// 不提供升级路径);challenge 缺失 → "authority_challenge_missing";
// 未过强身份 → "authority_user_presence_missing"。三项全部满足才 valid。
```

测试:七种 kind 的分类映射逐一钉死;protected 与 authority 不共用错误码;`bridgeProtectedHumanResponse` 产物通过 `validateHumanResponse` 且 `retaliationProhibited === true`;缺 mandateRef/auditRefs 时 validation 报错但**函数不抛**(提出响应永远合法,缺陷以校验结果承载)。

Commit: `feat(member-gateway): classify response write classes and bridge protected responses to governance contract`

### Task 4: 门禁扩展与收尾

- `scripts/check-member-gateway.ts`:`promptFrozenMarkers` 对 `prompt.ts` 断言:`'"critical"'`、`'"protected_human_response"'`、`'"authority_bearing_action"'`、`'"refuse"'`、`'"pause"'`、`'"appeal"'`、`"retaliationProhibited"`;WorkPacket 扫描列表加入 `prompt.ts`。负向验证(删 `"pause"` → FAIL → 恢复)。
- `index.ts` 增加 `export * from "@/lib/member-gateway/prompt";`
- as-built 附录、最终整体 review、push。

Commit: `feat(member-gateway): extend frozen-contract gate to prompt slice`

---

## 边界声明

- refuse/pause/appeal 的类型与校验唯一真值在 `caio-governance`;本切片只桥接,禁止复制或放宽。
- critical 严重度必须携带确定性规则引用;模型自由裁量的 critical 在契约上不可表达为合法 prompt。
- authority_bearing_action 的授权只能来自外部权限系统引用;本模块任何函数不得凭 principal/challenge/签名生成它。
- prompt 队列的持久化(投递回执、幂等、cursor)是 M3b;本切片纯判定。

---

## As-built 记录(2026-08-19 执行完毕)

分支 `feat/member-gateway-m2` 上 4 个 commit。模块测试全绿(prompt 切片
新增测试见各 commit),门禁含 prompt 冻结 marker 与负向验证。

判断记录:
1. 转移表以冻结三元组列表编码;cause 不匹配与非法转移分为两个错误码。
2. `classifyMemberPromptResponse` 用穷尽 switch + never 检查,新增 kind
   必须显式分类,不能落入默认分支。
3. `bridgeProtectedHumanResponse` 永不抛出——提出响应永远合法,缺陷由
   validation 结果承载;真值唯一来源是 caio-governance 的
   `validateHumanResponse`。
4. M3b(队列持久化:投递回执、幂等、cursor、withdraw/expire/snooze 的
   append-only 记录)与运行时接线留待后续切片。
5. 最终 review 加固:`decideMemberPromptDelivery` 对"无规则 critical"设
   防御——bypass 只属于携带确定性规则引用的 critical,无规则时按 normal
   处理(不假设调用方先跑过 validate)。
6. 组合义务(M3b 必须承接):投递/unsnooze 回执必须内嵌 `deliver: true`
   的判定结果;respond 前必须先做过期清扫——转移判定本身不看时间,时序
   一致性由 store 层组合保证。
7. 范围判断成文:spec §5 的"稍后处理"由 `snooze` 转移承载而非响应 kind;
   "打开"未建模;障碍/客户信号走 M2 信号通道而非 prompt 响应;
   `suppressed` 仅可从 `pending` 到达(投递前策略决定)。
8. `judgeAuthorityBearingAction` 当前只查授权引用在场;"对该成员、该对象、
   该动作"的显式绑定在 M3b 接线时钉死。非绩效化约束的冻结字面量放到
   M3b 回执形状上。
9. 门禁 marker 是子串在场检查,是冻结字面量测试之后的纵深防御而非首要
   机制(单删数组行不触发,typecheck 与 toEqual 测试才是首要冻结)。
