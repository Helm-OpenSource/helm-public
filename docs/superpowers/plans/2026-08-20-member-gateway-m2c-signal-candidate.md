---
status: archived / executed-with-as-built-record
owner: helm-core
created: 2026-08-20
review_after: 2026-09-20
public_safety: Implementation plan for the member work-signal candidate
  materialization slice (owner-ruled design). No customer data, credential,
  private endpoint, or production-readiness claim.
---

# Member Gateway M2c(信号候选材料化)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 executing-plans。

**Goal:** 按 owner 六项裁定(见 `2026-08-20-member-gateway-m2c-design-questions.md` 尾部"Owner 裁定记录")落地信号→审阅→晋升为任务的后端接缝:平行 artifact 类型 `member_work_signal_candidate`、taint 一等字段、脱链接化投影、可选对象锚点、opaque 证据 ref、**第一阶段只晋升为任务**(事实晋升是后续阶段)。**UI(/approvals lister 接线与审阅面)是 M2c-b,本切片到 service 层为止**(与 capability-closeout 先例一致——该先例同样零 UI)。

**Architecture(绑定决定):**

1. **复用 `ArtifactBundle`/`ArtifactReview` 表,不建新表。** 判别靠 `artifactType + reviewPosture + systemOfRecordWrite:false`(无 kind 列;JSON 字段名是 **`artifactsJson`** 复数)。冻结:
   - `MEMBER_SIGNAL_CANDIDATE_ARTIFACT_TYPE = "member_work_signal_candidate.json"`
   - `MEMBER_SIGNAL_CANDIDATE_REVIEW_POSTURE = "member_work_signal_candidate_review_required"`
2. **契约层零 zod**(模块惯例):artifact 形状用 plain 类型 + `ContractValidation` 校验函数;写入前校验,审阅/晋升读取时**重新解析并校验**(taint 完整性,corrupt → 拒绝)。
3. **taint 一等字段(裁定 2)**:artifact 必含 `taint: "untrusted"` 与 `evaluationUseProhibited: true` 与 `promotionAllowed: false` 字面量;candidate 本身不授予任何东西。
4. **脱链接化投影(裁定 3)**:`projectSignalToCandidate` 把正文中 `https?://\S+`(大小写不敏感)替换为 token `[link-evidence:<n>]`,并生成 `linkEvidence: [{token, evidenceRef: "link-evidence:<signalReceiptRef>:<n>"}]`;原始 URL 只存在于信号回执,artifact 正文必须 link-free(校验函数强制)。安全扫描:私有拷贝仓内 persistable-text 正则(第三份拷贝是先例;不要 hoist 进 lib/llm——那会落入 llm-candidate 门禁根)+ `detectPIIInOutput`(从 `@/lib/llm/output-pii-scrubber` import,方向合法)。
5. **对象锚点(裁定 4)**:`objectAnchor` 判别联合:`{resolved:true, objectType, objectId}`(objectType 为 plain string,与 proposal 侧 `objectRefSchema` 同风格,不绑 Prisma 枚举)| `{resolved:false, objectRef, objectVersion}`(保留原始 opaque ref)。解析输入由调用方提供,材料化器不做解析。
6. **证据(裁定 5)**:artifact 只带 opaque `relatedEvidenceRefs`;审阅人按需投影(七元交集、主体换审阅人)是 M2c-b/运行时职责,本切片成文不实现。
7. **晋升终点(裁定 6)**:只实现 promote-to-task(ActionItem + ApprovalTask,照 `governed-candidate-review.ts:398` 形状);**不调用/不实现** `projectConfirmedArtifactToMemoryCandidate` 路径。
8. **CAS 合规从第一行开始**:先例 review/promote 的 `count!==1` CAS 是被 baseline 的不合规代码——我们的所有事务一律 `db.$transaction(..., { isolationLevel: Serializable, maxWait:10_000, timeout:30_000 })` 内联 + `lockWorkspace` 先行,零新 finding、零 baseline 写入。
9. **材料化幂等(照 closeout 三层)**:确定性 PK `member-signal-candidate:${sha256(canonicalJson({workspaceId, artifactType, signalReceiptRef})).slice(0,32)}`(一信号一候选);存在性复读需匹配 AuditLog;P2002 捕获后重查。**被 superseded 的信号回执拒绝材料化**(`signal_receipt_superseded`,查 supersedesReceiptRef 指向它的行)——只有更正链头可成为候选。
10. **能力门**:review 用 `assertWorkspaceGovernedActionReviewServiceAccess`(REVIEW_GOVERNED_ACTIONS);promote 用 `assertWorkspaceGovernedCandidatePromotionServiceAccess`(PROMOTE_GOVERNED_CANDIDATES)。MEMBER 能力为空集,成员不能审/晋升自己的信号——现状已正确,测试钉死一条。
11. **ActionItem 溯源**:`sourceId = "member-signal-candidate-artifact:${bundleId}"`(晋升幂等键),`contentAuthorship: ActorType.HUMAN`(正文源自成员人写内容,区别于 governed 候选的 AI 署名);`aiReason` 写明 member-signal 溯源与 taint。其余列形状照 governed promote(CREATE_TASK / MEDIUM / REQUIRES_APPROVAL / PENDING_APPROVAL / autoExecute:false)。

**设计真值:** spec §5 + 本切片新增 spec 节(Task 0);六项 owner 裁定;`capability-closeout-materializer.ts`(材料化机械先例)与 `governed-candidate-review.ts`(review/promote 形状先例,注意其 CAS 不合规不可照抄)。

**分支:** `feat/member-gateway-m2c`。

---

### Task 0: spec 增补

`docs/superpowers/specs/2026-08-19-member-workbuddy-caio-gateway-design.md` §5 的 `candidate_write` 行后新增小节 **"§5.1 候选晋升接缝(M2c)"**:六项裁定的规范化表述(平行 artifact 类型与两个冻结字符串、taint/evaluationUseProhibited/promotionAllowed 三字面量、脱链接投影与 linkEvidence、objectAnchor 判别联合、opaque 证据 + 审阅人按需投影义务、阶段一只到任务晋升 + 阶段二事实晋升需成员网关会话锚点另立设计;成员不能审阅/晋升自己的信号由能力体系保证)。英文摘要段同步补一句。Commit: `docs: specify the member signal candidate promotion seam (M2c owner rulings)`

### Task 1: 契约 `lib/member-gateway/signal-candidate.ts`(+ 同址单测)

导出:两个冻结字符串;`MemberWorkSignalCandidateArtifact` 类型(schemaVersion:1、taint/evaluationUseProhibited/promotionAllowed 字面量、signalReceiptRef、五元溯源 memberRef/deviceRegistrationRef/clientId/policyRef/policyVersion、kind、projectedSummary/projectedDetail(link-free)、linkEvidence、relatedEvidenceRefs、objectAnchor、submittedAt);`projectSignalToCandidate(input)`(纯函数:输入信号回执契约对象 + payload{summary,detail,relatedEvidenceRefs} + anchor;输出 artifact;链接替换实现见 Architecture 4);`validateMemberWorkSignalCandidateArtifact`(全不变量:字面量、link-free(私有正则)、锚点分支完整性、instants、refs);`computeMemberWorkSignalCandidateContentHash = sha256(canonicalJson(artifact))`。TDD:投影(含大写 HTTPS、多链接编号、无链接原样)、校验每个错误码、锚点两分支、hash 稳定性。Commit: `feat(member-gateway): add member signal candidate contract with de-linked projection`

### Task 2: 材料化器 `lib/member-gateway/signal-candidate-materializer.ts`

server-only;输入 `{workspaceId, signalReceiptId, objectAnchor}`;Serializable 事务:lockWorkspace → 读信号回执行(payloadJson 哈希复核,corrupt → `signal_receipt_corrupt`)→ superseded 检查 → `projectSignalToCandidate` → 校验 + 安全扫描(persistable-text 私有拷贝 + PII)→ 三层幂等(Architecture 9)→ `tx.artifactBundle.create`(列集合照 closeout::265-280:id/workspaceId/artifactType/title(固定模式 `成员信号候选:<kind>`,不含正文)/status DRAFT/systemOfRecordWrite false/summary(截断的 projectedSummary)/artifactsJson(canonical JSON)/evidenceRefs(opaque refs JSON)/sourceProvenance(taint+五元溯源 JSON)/reviewPosture)→ `tx.artifactReview.create`(PENDING 三字段)→ `tx.auditLog.create`(actionType `MEMBER_WORK_SIGNAL_CANDIDATE_MATERIALIZED`,targetType "ArtifactBundle",ActorType.SYSTEM,principal `runtime:member-signal-candidate-materializer`,trace context)。返回 `{artifactBundleId, artifactReviewId, reused}`。Commit: `feat(member-gateway): materialize work signals into reviewable candidates`

### Task 3: review/promote `lib/member-gateway/signal-candidate-review.service.ts`

- `reviewMemberWorkSignalCandidate`:能力门(REVIEW_GOVERNED_ACTIONS)→ 类型钉死 finder(artifactType+posture+systemOfRecordWrite:false)→ 读取时解析+校验 artifact(corrupt/taint 缺失 → `candidate_artifact_corrupt`)→ Serializable CAS:confirm → bundle DRAFT→CONFIRMED + review PENDING→CONFIRMED(带 reviewer 字段);reject → 双 REJECTED;`count!==1` → 冲突错误;audit `MEMBER_WORK_SIGNAL_CANDIDATE_REVIEWED`。
- `promoteMemberWorkSignalCandidateToTask`:能力门(PROMOTE_GOVERNED_CANDIDATES)→ 要求 CONFIRMED bundle+review → `resolvePolicyDecision`(CREATE_TASK/MEDIUM,FORBIDDEN 与 SUGGEST_ONLY 拒绝)→ CAS CONFIRMED→CONSUMED(consumedAt)→ ActionItem(Architecture 11)+ ApprovalTask(PENDING/isHighRisk:false/autoExecute:false)+ notification + audit `MEMBER_WORK_SIGNAL_CANDIDATE_PROMOTED_TO_TASK`;晋升幂等靠 sourceType+sourceId 复读。
- `listMemberWorkSignalCandidateReviews(workspaceId)`:类型钉死、take 50、返回冻结列表项(含 taint 字段——M2c-b UI 的读模型),照 `listGovernedJudgementCandidateReviews` 形状。
- 明确**不实现**事实晋升路径(裁定 6 阶段一)。
Commit: `feat(member-gateway): review and promote signal candidates to governed tasks`

### Task 4: 隔离 MySQL 测试 `lib/member-gateway/signal-candidate.mysql.test.ts`

env `MEMBER_SIGNAL_CANDIDATE_DATABASE_URL`(mandate 模式)。fixture 需要 OWNER 成员(能力门要过)+ 一条真实信号(走 signal-store issue+submit)。用例(≥13):材料化 happy(三行齐、artifact 校验通过、taint/promotionAllowed 在场);幂等 reused;字段漂移 → conflict;superseded 信号拒绝;带链接(含大写)信号 → artifact link-free + linkEvidence 编号正确;含凭据样式文本 → `unsafe_candidate_text`;review confirm happy;reject happy;错误 artifactType 的 bundle → 拒绝;corrupt artifactsJson($executeRaw 直改)→ `candidate_artifact_corrupt`;promote happy(ActionItem/ApprovalTask/CONSUMED/sourceId);未 CONFIRMED promote 拒绝;二次 promote 幂等复读;MEMBER 角色调用 review/promote → 能力拒绝(建一个 MEMBER 成员 fixture)。本地真库全绿。Commit: `test(member-gateway): cover candidate materialization, review, and promotion against MySQL`

### Task 5: 接线与收尾

`test:member-gateway:mysql` 加文件;CI job GITHUB_ENV 加 `MEMBER_SIGNAL_CANDIDATE_DATABASE_URL`;CPV1 白名单;`check-member-gateway.ts` 扫描列表 += 3 文件,冻结 marker += `'"member_work_signal_candidate.json"'`、`'"untrusted"'`(signal-candidate.ts 内)、`"promotionAllowed"`;as-built;最终整体 review;push + PR(base main)。

---

## 边界声明

- UI(/approvals lister 接线、审阅面 taint 渲染、审阅人证据按需投影)是 **M2c-b**;本切片到 service 层为止,与 closeout 先例一致。
- 事实晋升(MemoryCandidate/runtimeSessionId)是裁定 6 的阶段二,本切片不可表达。
- candidate 本身不授予权限、不产生承诺;晋升产物 ActionItem 仍走 REQUIRES_APPROVAL 既有审批链。
- 判定/投影全部在契约层;materializer/review/promote 零判定复制。

---

## As-built 记录(2026-08-20 执行完毕)

分支 `feat/member-gateway-m2c` 上 6 个 commit(spec §5.1 增补、契约层、
materializer、review/promote service、隔离 MySQL 测试、门禁与 CI 接线)。
本地可验证门禁全绿:typecheck 0 错误、lint 0 违规、
`check:conditional-update-cas` 零新 finding(47 条既有 baseline 位点不变)、
`check:member-gateway` PASS、模块单测 167 通过(+ mysql 套件按 env 跳过)、
隔离 MySQL 套件对本地真库实跑 16 通过 0 失败、全量 `check:boundaries`
每 commit 绿。

偏离与判断记录:

1. **`ActorType.USER` 替代计划文本的 `ActorType.HUMAN`**:Prisma `ActorType`
   枚举只有 `USER | SYSTEM | AI`,不存在 `HUMAN`。`ActionItem.contentAuthorship`
   字段本身的 schema 注释说明:内容由人撰写的流程必须显式声明 `USER`
   (`AI` 是默认值)。`USER` 是"成员撰写、非 AI 撰写"在本仓语义下唯一正确
   的字面量,已在 review service 内联注释记录该替换与理由。
2. **第四份 persistable-text 正则拷贝**:`signal-candidate-materializer.ts`
   内的私有拷贝是仓内第四份(前三份分别是
   `lib/llm/governed-candidate-materializer.ts`、
   `lib/governed-intelligence/capability-closeout-materializer.ts:40-41`、
   `lib/member-gateway/signal-candidate.ts`)。它与 Task 1 契约层的拷贝
   扫描的是**不同文本面**:契约层只扫 `projectedSummary`+`projectedDetail`
   (正文),materializer 这份扫描 `canonicalJson(artifact)` 全量(含
   `relatedEvidenceRefs`/`objectAnchor`/五元溯源),因此不能靠共享一份
   拷贝或 re-export 合并——已在 mysql 测试中用两个独立用例分别证明两层
   各自能单独拦截(正文内的凭据样式文本在契约层校验阶段就先被拒
   `candidate_body_unsafe_text`——该错误码后经 review 更名,原名
   `candidate_body_link_bearing` 已弃用,因为该正则同时匹配链接、数据库
   连接串与凭据标记,不止链接——materializer 自身的全量扫描只在正文之
   外的字段——例如 `relatedEvidenceRefs`——才是唯一可观察到
   `unsafe_candidate_text` 分支触发的路径)。
3. **晋升幂等一致性检查零 zod**:`findExistingCandidatePromotion` 用
   `safeParseJson` 做 `ActionItem.metadata` 的字段级一致性检查,而不是像
   `governed-candidate-review.ts` 先例那样引入 zod schema——与
   member-gateway 模块"契约层零 zod"的既有惯例保持一致,该 metadata 只是
   审计展示用途的 plain JSON,不是需要重新校验的契约对象。
4. **`ActionItem.aiReason` 列长度 bug(真库实跑发现)**:该列是普通 Prisma
   `String?`,未标注 `@db.LongText`/`@db.Text`,MySQL 侧映射为
   `VARCHAR(191)`。晋升逻辑最初把 `artifact.kind`/`signalReceiptRef` 插值
   进 `aiReason`,在隔离 MySQL 套件对真实 receipt id 实跑时超列宽报错
   (`PrismaClientKnownRequestError`)。已修复为固定、简短、直接声明
   taint 的静态字符串;可变长度的溯源信息(kind/signalReceiptRef)只保留
   在 `metadata`(LongText)与晋升 `AuditLog.payload`(LongText)中。
5. **最终 review 修复(同类列宽 + 时序 + 反伪造)**:
   - `promoteMemberWorkSignalCandidateToTask` 的 `title`/`description` 现
     在写入前做长度校验(`promotion_title_too_long`/
     `promotion_description_too_long`),而不是让 Prisma 在真库上抛
     `P2000`——与第 4 条是同一类"plain VARCHAR(191) 列宽"问题,这次在写入
     前堵住,而不是事后从错误信息反推。
   - `reviewMemberWorkSignalCandidate`/`promoteMemberWorkSignalCandidateToTask`
     现在都在 Serializable 事务内重新查一次"该信号是否已被更正
     (`supersedesReceiptRef` 指向它)",拒绝为 `signal_receipt_superseded`
     ——材料化时的一次性检查不足以防止 review/promote 与"成员事后更正"之
     间的竞争;两个检查点都补齐了。
   - `validateMemberWorkSignalCandidateArtifact` 新增反伪造校验:正文中
     字面量子串 `[link-evidence:` 的出现次数必须等于 `linkEvidence.length`
     ——成员在自己文本里手写一个假的 `[link-evidence:9]` 不会被
     projection 产生,但之前不会被拒绝;现在会被拒绝为
     `candidate_link_evidence_invalid`。
   - 错误码 `candidate_body_link_bearing` 更名为
     `candidate_body_unsafe_text`——该正则同时匹配链接、数据库连接串与
     凭据标记,旧名字过窄、有误导性。

### 留给 owner(仍是记录在案的义务,本切片不落地)

- **M2c-b UI**:`/approvals` lister 接线、审阅面 taint 一等渲染、审阅人
  按 ref 逐条下钻的工作区级授权投影(七元交集,主体换审阅人——spec §5.1
  裁定 5 的运行时义务,本切片 service 层完整实现了 review/promote,但
  证据按需升面投影本身尚未实现)。
- **阶段二事实晋升**:候选晋升为 `MemoryCandidate` 需要成员网关会话锚点
  (`runtimeSessionId`),裁定 6 明确这是另立设计,本切片任何路径都不可
  表达、也未表达。
- **CI 首次真实运行**:本切片把 `MEMBER_SIGNAL_CANDIDATE_DATABASE_URL` 接
  进既有 `member-gateway-signal-mysql` job 与 `test:member-gateway:mysql`,
  但该 job 在 CI 环境的首次真实运行(而非本地实跑)仍待观察。
- **`helm-v2` 的 `confirmRuntimeArtifact` 缺 artifactType 钉死**:
  `runtime-upgrade.ts:14362` 一带按 `workspaceId + id` 选 bundle,不校验
  `artifactType`;当前只是因为 member-signal bundle 没有
  `runtimeEventId`/`meetingId` 而偶然与该路径隔离——这是结构性缺口,不是
  本切片刻意设的边界,修复(补 `artifactType` 钉死)属于 owner 待办,不在
  本切片修改范围内;另有五处 `helm-v2` sweep 同类模式,需一并排查。
- **M2c-b 渲染器义务**:link-evidence token 的出现次数不可假定单射(一个
  token 只对应一条真实链接)——展示层必须按 `linkEvidence` 数组本身渲染
  证据列表,不得对正文做字符串匹配/计数来推断证据数量或存在性(正文本身
  只是不可信的成员输入,详见本文件第 5 条反伪造校验)。
- **governed 先例的 `Pending review:` 通知标题同样可能溢出**:
  `governed-candidate-review.ts` 用 `z.string().max(191)` 校验 `title`,
  但它同样会拼进 `Pending review: ${title}` 写入 191 列宽的
  `Notification.title`——`title` 在 176-191 字符区间时 zod 校验通过但
  仍会在 Prisma 写入时溢出。本切片已经在自己的路径上把上限收紧到 175;
  governed 先例的 `.max(191)` 未改动(不在本切片范围内),owner 可顺手
  收紧到 175 或改为拼接前置计算列宽。
