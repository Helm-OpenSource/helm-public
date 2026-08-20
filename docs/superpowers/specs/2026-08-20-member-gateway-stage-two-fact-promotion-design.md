---
status: active / owner-ruled-implementing
owner: helm-core
created: 2026-08-20
review_after: 2026-09-20
public_safety: Design proposal for stage-two fact promotion of confirmed
  member signal candidates. No customer data, credential, private endpoint,
  or production-readiness claim; nothing here authorizes implementation.
---

# Member Gateway 阶段二:事实晋升设计(成员网关会话锚点)

> 依据 spec §5.1 裁定 6:阶段一(已上线)只把确认后的成员信号候选晋升为
> 任务;阶段二把"晋升为经营记忆事实候选"打通,前提是解决成员网关的
> 会话锚点问题。本文是设计提案,**未经 owner 批准不进入实现**。

## 1. 问题

事实晋升的既有终点是 `MemoryCandidate`(`prisma/schema.prisma:2524`),
其行携带 `runtimeSessionId` 外键——记忆候选必须锚定在一次可审计的运行
会话上。既有投影路径 `projectConfirmedArtifactToMemoryCandidate`
(`lib/governed-intelligence/capability-closeout-review.ts:615`)双重钉死
在 governed 候选类型上,且要求真实 runtime session。成员网关没有
runtime session 概念:信号经一次性 challenge 提交,提交上下文由
(memberRef, deviceRegistrationRef, clientId, challenge 窗口)构成。

## 2. 设计提案

### 2.1 会话锚点:一等 `MemberGatewaySession`(推荐)

新增模型 `MemberGatewaySession`:

- `id`(caller-supplied)、`workspaceId`、`memberRef`、
  `deviceRegistrationRef`、`clientId`、`openedAt`、`closedAt?`、
  `createdAt`;append-only 语义(关闭是唯一变更,CAS)。
- **创建时机**:成员网关 store 首次为某 (member, device, client) 三元组
  签发 challenge 时开启会话;会话窗口内的后续 challenge/提交复用同一
  会话;超过闲置窗口(建议 30 分钟,冻结为契约值)自动开新会话。
  信号回执与响应回执**新增可空列** `gatewaySessionRef`(新迁移,回填
  不追溯——历史回执无会话锚点,不参与阶段二晋升,成文即可)。
- 备选方案(不推荐):(a) 晋升时合成一次性假会话——语义欺骗,审计上
  把"会话"降级为形式字段;(b) 放宽 `MemoryCandidate.runtimeSessionId`
  可空——在核心记忆链上开口子,违背"只走既有链路"的冻结裁定。

`MemoryCandidate.runtimeSessionId` 指向 runtime session 表;成员网关会
话是另一张表。两种对齐方式,需 owner 择一:

- **A(推荐)**:`MemoryCandidate` 增加可空 `memberGatewaySessionRef`
  列 + CHECK(`runtimeSessionId` 与 `memberGatewaySessionRef` 恰好一个
  非空)。改动小、语义诚实,记忆读侧按来源分支。
- **B**:为每个成员网关会话镜像创建一条 runtime session 行。零读侧改
  动,但 runtime session 表混入非 runtime 语义,长期更脏。

### 2.2 投影路径:平行函数(与 M2c 同模式)

新增 `projectConfirmedMemberSignalArtifactToMemoryCandidate`
(放 `lib/member-gateway/`,类型钉死本 artifact 家族),镜像
capability-closeout 的形状:要求 bundle CONFIRMED + review CONFIRMED、
Serializable 事务、幂等(一 bundle 一 memory candidate)、冻结假值
`memoryPromotionCreated:false`、`canonicalMemoryWritten:false`(与
closeout 相同:投影产生的是 `PENDING_VERIFICATION` 候选,不写正典记
忆)。**不改**既有 governed 投影函数。

### 2.3 taint 与非绩效化在记忆层的携带

- `MemoryCandidate` 的 provenance JSON 携带
  `{ taint: "untrusted", memberRef, deviceRegistrationRef, clientId,
  policyRef, signalReceiptRef, gatewaySessionRef,
  evaluationUseProhibited: true }`;记忆验证(verification)UI 必须一等
  渲染 taint(与审阅面同一义务)。
- 验证通过后的事实写入是否保留 taint 标注:**建议保留为来源标注**
  (事实可信度由验证背书,来源不可信性是历史事实,不应抹除)。
  需 owner 确认。

### 2.4 能力与审计

- 投影动作沿用 `PROMOTE_GOVERNED_CANDIDATES` 能力 + 既有 policy
  decision(`MEMORY_WRITE` 类动作的 policy 语义如无既有 ActionType,
  需在实现轮确认映射;禁止新造能力常量除非 owner 另裁)。
- 审计链:materialize → review → memory-project 三段各自 append-only
  审计;记忆候选 id 采用确定性派生(一 bundle 一候选)。

## 3. 需 owner 拍板的点

1. 会话锚点采用 2.1 的一等 `MemberGatewaySession` + 对齐方式 A?
2. 历史回执(无 `gatewaySessionRef`)永久不参与事实晋升,是否接受?
3. 验证通过后的事实保留 taint 来源标注(2.3)?
4. 能力沿用 PROMOTE_GOVERNED_CANDIDATES(2.4)?

## 4. 批准后的实现轮廓(M2d)

迁移(MemberGatewaySession + 三张回执表的可空 sessionRef 列 +
MemoryCandidate 对齐列)→ store 会话开启/复用逻辑 + 契约判定 →
平行投影函数 + mysql 测试 → 记忆验证面的 taint 渲染义务 → 门禁与
as-built。全程沿用 M1-M2c 的两段式 review 流程。

## English Summary

Stage two promotes confirmed member signal candidates into memory
candidates. The existing `MemoryCandidate` requires a runtime session
anchor; the member gateway has none. This proposal introduces a
first-class `MemberGatewaySession` (opened on first challenge issuance
per member/device/client, idle-windowed, append-only), a nullable
`memberGatewaySessionRef` on `MemoryCandidate` with an exactly-one-anchor
CHECK, a parallel type-pinned projection function mirroring the
capability-closeout shape (frozen memoryPromotionCreated:false — the
projection yields a PENDING_VERIFICATION candidate, never a canonical
memory write), taint and evaluation-use-prohibited provenance carried
into the memory layer with first-class rendering at verification, and the
existing promotion capability. Four owner decision points are listed;
nothing is implemented until they are ruled on.

---

## Owner 裁定记录(2026-08-20)

§3 四项决策已由 owner 拍板,本设计转为可实现(M2d):

1. **会话锚点**:一等 `MemberGatewaySession` + 对齐方式 A(`MemoryCandidate`
   增可空 `memberGatewaySessionRef`,`runtimeSessionId` 改可空,DB CHECK
   恰一锚点非空)。
2. **历史回执**:无会话锚点的存量回执永久不参与事实晋升,不做回填、
   不提供人工补锚工具;它们仍可走阶段一任务晋升。
3. **taint 保留**:验证通过后写入的事实保留"源自未受信成员上行"的来源
   标注——事实可信度由验证背书,来源史实不抹除。
4. **能力**:投影动作沿用 `PROMOTE_GOVERNED_CANDIDATES`(叠加既有
   memory 服务门,不新造能力常量)。

实现细节修正(基于 2026-08-20 记忆层探查):`MemoryCandidate` 现无
provenance 列,taint/溯源随 `sourceStatus` JSON 携带;投影函数必须放
**新文件**(llm-candidate 门禁对 capability-closeout-review.ts 的切片扫描
到文件尾)且**禁止写 MemoryPromotion/MemoryItem**;taint 渲染最小插点是
`buildEvidenceSourceClasses`(lib/helm-v2/runtime-upgrade.ts:6969),零组
件改动流入 /memory 与 operator 面板。
