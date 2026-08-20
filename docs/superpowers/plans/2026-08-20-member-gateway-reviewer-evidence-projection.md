---
status: planning / ready-to-execute
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
