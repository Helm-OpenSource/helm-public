---
status: archived / executed-with-as-built-record
owner: helm-core
created: 2026-08-20
review_after: 2026-09-20
public_safety: Implementation plan for the reviewer per-evidence-ref
  authorization projection seam. No customer data, credential, private
  endpoint, or production-readiness claim.
---

# Member Gateway 审阅人逐 ref 证据投影 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 executing-plans。

**Goal:** 落地 spec §5.1 裁定 5 的运行时义务:审阅人在候选审阅面对每个 opaque `relatedEvidenceRef` 下钻时,按 ref 单独跑**工作区级授权投影**(M1 七元交集,主体换审阅人),返回投影决定;无法安全投影即拒绝。公共核心交付契约 + service + UI 接缝;真实授权数据解析由部署层注册 resolver,默认 **fail-closed(全 null → 七元全拒)**。

**Architecture(绑定):**

1. **判定零新发明**:复用 M1 的 `decideMemberReadSurface` + `decideMemberProjection` + `validateMemberToolEnvelope`,主体是审阅人(`MemberPrincipal` 形状,memberRef=reviewer 的成员 ref);`purpose` 固定 `"candidate_evidence_review"`。返回形状就是 M1 的 `MemberToolEnvelope`(带投影判定依据),返回前过 envelope 校验。
2. **resolver port**(公共核心唯一新概念):`lib/member-gateway/reviewer-evidence-projection.service.ts` 定义
   ```ts
   type MemberEvidenceAuthorizationResolver = {
     resolve(input: { workspaceId: string; reviewerMemberRef: string;
       evidenceRef: string }): Promise<{
       liveMembershipRef: string | null; toolScopeRef: string | null;
       objectRelationshipAuthorizationRef: string | null;
       fieldPurposePolicyRef: string | null;
       sourceAuthorizationRef: string | null;
       tenantProviderEgressPolicyRef: string | null;
       classification: MemberObjectClassification | null;
       freshnessMinutes: number | null;
       providerRef: string | null;
       projectionPolicyRef: string; projectionPolicyVersion: number;
       projectedFields: Readonly<Record<string, unknown>> | null; // 白名单字段值,仅 metadata_only/remote_projected 时消费
     }>;
   };
   ```
   模块级 `registerMemberEvidenceAuthorizationResolver` / `resetMemberEvidenceAuthorizationResolverForTests`(照 `governed-model-adapter-registry` 的注册风格);**默认 resolver 返回全 null**(policyRef 用哨兵 `"unresolved"`, version 1)→ 七元全拒 → envelope 携带 `read_surface_denied` 与全部 deniedDimensions。注释成文:默认即拒绝是设计,不是缺失;真实 resolver 只能由受控私有层注册。
3. **service 函数** `projectCandidateEvidenceForReviewer(input: { workspaceId; reviewerUserId; artifactBundleId; evidenceRef })`:能力门 `assertWorkspaceGovernedActionReviewServiceAccess` → 加载并校验候选 artifact(类型钉死 + `validateMemberWorkSignalCandidateArtifact`;corrupt → 拒)→ **evidenceRef 必须属于该 artifact 的 `relatedEvidenceRefs`或 `linkEvidence[].evidenceRef`**(否则 `evidence_ref_not_in_candidate`——不能拿审阅面当任意 ref 的探针)→ resolver.resolve → `decideMemberReadSurface`(reviewer 主体)→ `decideMemberProjection` → 组装 `MemberToolEnvelope`(data 仅在投影非空时携带 resolver 的 `projectedFields` 经 **metadata_only 白名单过滤**(`METADATA_ONLY_FIELD_WHITELIST`)后的对象;remote_projected 同样只放行白名单字段——公共核心不定义更宽的字段面,私有层扩展另议并成文)→ `validateMemberToolEnvelope` 兜底(invalid → 抛,平台故障)。审计:`auditLog` 记 `MEMBER_SIGNAL_EVIDENCE_PROJECTION_REQUESTED`(actor 审阅人、targetType "ArtifactBundle"、metadata 含 evidenceRef 与 blockReason/projection,**不含字段值**)。
4. **lister 读模型扩展**:`MemberSignalCandidateReviewListItem` 增加 `relatedEvidenceRefs: readonly string[]`(从 artifact 解析;corrupt 行为空数组)。service 文件在 `check:member-gateway` 冻结 marker 集内——只加字段,不动 marker。
5. **server action**:`features/member-signal-candidates/actions.ts` 增 `projectMemberSignalEvidenceAction`(zod strict:artifactBundleId ≤191、evidenceRef ≤191)→ 能力预检(review)→ service → 返回 `{ ok, envelope }` 或映射错误(新错误码并入既有 record:`evidence_ref_not_in_candidate`、`evidence_projection_unavailable`)。注意 import 链不得触达 caio-governance(时间解析已在 `lib/time/strict-instant`)。
6. **面板扩展**:候选行(非 corrupt)增加"证据(N)"折叠区:逐 ref 列 opaque 值 + "查看授权投影"按钮 → action → 就地渲染结果:拒绝时显示 blockReason + deniedDimensions(zh/en);投影时显示白名单字段表。**文案红线**同前(无 systemspeak);默认 resolver 下用户看到的是"当前部署未接入证据解析器,默认拒绝"一类以部署为主语的说明。
7. **测试**:service 单测(默认 resolver 全拒 + envelope 合法;注册合成 resolver 后 remote_projected/metadata_only/LOCAL_VIEW_REQUIRED 三态;ref 不在候选内拒绝;corrupt 候选拒绝;白名单过滤钉死——resolver 给出 `customerName` 字段也不放行);action/面板测试照既有 harness;mysql 测试(套件并入 `signal-candidate.mysql.test.ts` 或新文件,验证能力门与审计行)。

**Tasks/commits:**
- T1: service + registry + 单测 → `feat(member-gateway): project candidate evidence for reviewers behind a fail-closed resolver port`
- T2: lister 字段 + action + 面板折叠区 + 组件测试 → `feat(member-gateway): surface per-ref evidence projection in the candidate review panel`
- T3: mysql 测试补充 + 门禁(扫描列表加新文件)+ as-built + 最终 review + push + PR。

**边界:** 公共核心不解析任何真实授权数据;字段面钉死为 metadata_only 白名单(两档投影都不放宽);resolver 注册是部署层职责,与 model adapter registry 同一姿态。

---

## As-built 记录(2026-08-20 执行完毕)

分支 `feat/member-gateway-reviewer-evidence-projection` 上 4 个 commit
(T1 service+registry+单测、T2 lister 字段+action+面板折叠区+组件测试、
T3a 隔离 MySQL 覆盖、T3b 门禁扫描列表+as-built):

- `6358e5b7` — `feat(member-gateway): project candidate evidence for
  reviewers behind a fail-closed resolver port`
- `d8b629af` — `feat(member-gateway): surface per-ref evidence projection
  in the candidate review panel`
- `39b8d5fd` — `test(member-gateway): cover reviewer evidence projection
  against MySQL`
- (T3b, this commit) — `feat(member-gateway): wire reviewer evidence
  projection into the gate and record as-built`

本地可验证门禁全绿:typecheck 0 错误、lint 0 违规、`check:member-gateway`
PASS(扫描列表已加入 `reviewer-evidence-projection.service.ts`/
`reviewer-evidence-projection.test.ts`)、`check:caio-terminology` 权限防
火墙 PASS(actions.ts 的导入链不触达 `lib/caio-governance`)、全量
`check:boundaries` 每 commit 绿。db-free 单测 5 个通过(默认 resolver 七元
全拒 + 合法 envelope;合成 resolver 的 `remote_projected`/`metadata_only`/
`LOCAL_VIEW_REQUIRED` 三态,含白名单外字段 `customerName` 被丢弃的钉死用
例)。面板组件测试 11 个通过(含新增证据折叠区、denied-dimensions 渲染)。
隔离 MySQL 套件对本地真库实跑:`test:member-gateway:mysql` 全量 66 通过
0 失败(四个 env var 全部指向同一真实 MySQL schema,与 CI
`member-gateway-signal-mysql` job 姿态一致);`signal-candidate.mysql.test.ts`
单文件 24 通过(19 条既有 + 本次新增 5 条:默认 resolver 七元拒绝+审计行
零字段值、evidenceRef 不属于候选、bogus artifactBundleId、MEMBER 角色能
力拒绝、linkEvidence 派生 evidenceRef 仍被接纳)。

偏离与判断记录:

1. **`{ envelope, deniedDimensions }` 而非纯 `envelope` 返回**:M1 冻结的
   `MemberProjectionDecision`(`lib/member-gateway/types.ts`)本身没有逐维
   度字段——它是 WorkBuddy 客户端唯一可见的 wire 形状,contract.ts 明确
   "the only shape a client ever sees"。审阅面板(Architecture 6)需要展
   示具体是哪几个维度被拒绝,而 envelope 校验器本身禁止在 `projection:
   null` 时携带非空 `data`,所以逐维度详情不可能塞进 envelope 内部。解
   决方式是把 `decideMemberReadSurface` 的 `deniedDimensions` 作为
   envelope 的**同级兄弟字段**返回(`composeMemberEvidenceProjectionEnvelope`
   / `projectCandidateEvidenceForReviewer` 都返回 `{ envelope,
   deniedDimensions }`),envelope 本身字节级不变,仍是纯 M1 契约形状;
   面板消费者是内部审阅面,不是 WorkBuddy 客户端,不受 envelope-is-the-
   only-shape 约束。这是对 Architecture 3("envelope-only 返回")与
   Architecture 6(面板需要逐维度详情)两条表述之间张力的调和,不是对计
   划文本的偏离式违反。
2. **`reviewerMemberRef` 派生为 `reviewer:${reviewerUserId}`**:审阅人是
   内部 Helm 工作区用户在复核一条未受信的成员上行候选,不是 WorkBuddy
   成员会话——不存在可复用的会话绑定 `MemberPrincipal.memberRef`。选择
   从工作区用户 id 确定性派生一个稳定的 principal 侧 ref,并加
   `reviewer:` 前缀命名空间,使其永远不可能与该模块从不消费也从不生成
   的真实 WorkBuddy `memberRef` 冲突。
3. **`MemberEvidenceProjectionError` 同时携带 `code` 与 `reasons`**:计划
   文本只点名 `reasons` 字段,但 T2 的 action 需要对错误做判别式分支映
   射(镜像姊妹类 `MemberSignalCandidateReviewError` 的 `code` 形状)。
   `reasons` 保留给 `evidence_projection_unavailable` 这一条平台故障路
   径(`validateMemberToolEnvelope` 校验失败时,把校验器返回的多条
   `errors` 原样带出),而不是丢弃这条诊断信息。
4. **db-free 组合接缝 `composeMemberEvidenceProjectionEnvelope` 单独导
   出**:resolver→`decideMemberReadSurface`→`decideMemberProjection`→白
   名单过滤→envelope 校验这条纯判定路径与 db 绑定的候选加载/能力门/审
   计写入分离导出,T1 单测直接对合成 resolver 验证四态判定与白名单钉
   死,不需要 mock db;db 绑定路径(能力门拒绝、`candidate_not_found`、
   `evidence_ref_not_in_candidate`、审计行形状)留给本次 T3 的隔离
   MySQL 套件覆盖——按计划文本给出的两个可选路径之一执行。
5. **默认 resolver = 设计的拒绝,不是缺口**:与
   `lib/llm/governed-model-adapter-registry.service.ts` 对 provider
   adapter 的注册姿态一致——公共核心不包含任何能回答"这个审阅人的工作区
   是否授权这条证据 ref"的代码,因为这个答案需要实时工作区成员资格、工
   具授权范围、对象关联授权、字段用途策略、数据源授权、租户出站策略、
   当前分级等私有租户数据。真实 resolver 只能由受控私有层通过
   `registerMemberEvidenceAuthorizationResolver` 注册;公共核心默认返回
   全 null,喂给 `decideMemberReadSurface` 后七元全拒,审阅人看到的是
   "当前部署未接入证据解析器,按默认拒绝"这一以部署为主语的说明,而不
   是一句技术黑话或误导性的权限个人化拒绝。
6. **字段面对两档投影都钉死为 `METADATA_ONLY_FIELD_WHITELIST`**:`remote_
   projected` 与 `metadata_only` 都只放行白名单内字段
   (`whitelistedProjectionData` 内联注释记录);resolver 可以喂回更宽的
   字段(单测用 `customerName` 钉死这一点),但公共核心永远只透传白名单
   命中的键——更宽的字段面留给私有层另议,公共核心不表达。
6. 最终 review 加固:重复注册 resolver 抛
   `duplicate_resolver_registration`(镜像 governed model adapter registry
   的重复拒绝语义),测试钉死;晚到的第二次注册永远不能静默替换严格
   resolver。probe 类拒绝(ref 不在候选内等)发生在审计写入之前、不留
   审计行——与姊妹 review service 姿态一致,如需 probe 可见性属后续
   posture 决策。
