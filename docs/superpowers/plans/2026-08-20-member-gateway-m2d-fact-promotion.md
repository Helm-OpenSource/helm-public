---
status: archived / executed-with-as-built-record
owner: helm-core
created: 2026-08-20
review_after: 2026-09-20
public_safety: Implementation plan for stage-two fact promotion (member
  gateway session anchor). No customer data, credential, private endpoint,
  or production-readiness claim.
---

# Member Gateway M2d(阶段二事实晋升)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 executing-plans。

**Goal:** 按 owner 四项裁定(设计文档尾部"Owner 裁定记录")落地:一等 `MemberGatewaySession` 会话锚点、确认后的成员信号候选投影为 `MemoryCandidate(PENDING_VERIFICATION)`、taint/非绩效化溯源进入记忆层并在既有面板可见。

**设计真值:** `docs/superpowers/specs/2026-08-20-member-gateway-stage-two-fact-promotion-design.md`(含裁定与实现修正);2026-08-20 记忆层探查(MemoryCandidate/RuntimeSession 形状、closeout 投影先例、门禁约束)。

**Architecture(绑定):**

1. **会话语义(固定窗口,行近不可变)**:`MEMBER_GATEWAY_SESSION_WINDOW_MS = 30 * 60_000` 冻结;会话自 `openedAt` 起 30 分钟内有效;窗口内同 (workspace, memberRef, deviceRegistrationRef, clientId) 复用,过窗即开新行(**不做 lastActivity 滚动更新**——保持行不可变,closedAt 是唯一变更且本切片不实现关闭)。
2. **schema/迁移** `20260821090000_member_gateway_session`(hand-authored,house 风格):
   - `MemberGatewaySession`:id(caller-supplied)、workspaceId、memberRef、deviceRegistrationRef、clientId、openedAt、closedAt?、createdAt;`@@unique([id, workspaceId], map:"MWGatewaySession_id_workspace_key")`;`@@index([workspaceId, memberRef, deviceRegistrationRef, clientId, openedAt], map:"MWGatewaySession_tuple_opened_idx")`;Workspace 反向关系;CHECK `closedAt IS NULL OR closedAt > openedAt`。无触发器(可变表)。
   - 加列(全部可空 VARCHAR(191),无 FK——relationMode prisma):`MemberWorkSignalChallenge.gatewaySessionRef`、`MemberWorkSignalReceipt.gatewaySessionRef`、`MemberPromptTransitionReceipt.gatewaySessionRef`、`MemberPromptResponseReceipt.gatewaySessionRef`。对已带 append-only 触发器的表做 ALTER 是 DDL,不触发行触发器(迁移头注明,这是仓内首例)。
   - `MemoryCandidate`:`runtimeSessionId` 改 `String?`(relation 变 optional,既有写方全部显式提供,无行为变化)+ 新列 `memberGatewaySessionRef String?` + CHECK `((runtimeSessionId IS NULL) <> (memberGatewaySessionRef IS NULL))`(恰一锚点)+ `@@index([workspaceId, memberGatewaySessionRef, createdAt], map:"MemoryCandidate_workspace_mgws_idx")`。
3. **会话开启/复用**:新文件 `lib/member-gateway/gateway-session.ts`(纯契约:窗口常量、`isSessionOpenAt(session, nowMs)` 判定、id 形状 `mgws-<uuid>`)+ store 内联函数 `resolveGatewaySession(tx, tuple, now)`(查询窗口内最新未关闭行,无则 create;必须在既有 Serializable 事务内、lockWorkspace 之后调用)。挂接点:
   - `signal-store.service.ts` `issueMemberWorkSignalChallenge` 事务内(lockWorkspace 后、challenge create 前)→ challenge 行落 `gatewaySessionRef`;`submitMemberWorkSignal` 的 receipt insert 把 challenge 行的 `gatewaySessionRef` 复制到信号回执(不重新解析——回执锚定的是**签发时**会话)。
   - `prompt-response-store.service.ts` `issueMemberPromptResponseChallenge` 同挂接;`recordMemberPromptResponse` 把 challenge 的 sessionRef 写进响应回执与其内联转移回执。`prompt-store.service.ts` 自身的 `transitionMemberPrompt`(系统因转移)**不写** sessionRef(保持 null,语义:非成员会话内动作)。
4. **投影** 新文件 `lib/member-gateway/signal-candidate-memory-projection.service.ts`(**不得**放 capability-closeout-review.ts——llm-candidate 门禁的切片扫描到该文件尾;**禁止写 MemoryPromotion/MemoryItem**):
   `projectConfirmedMemberSignalCandidateToMemoryCandidate({ workspaceId, actorUserId, actorName, artifactBundleId })`:
   - 双门:`assertWorkspaceGovernedCandidatePromotionServiceAccess`(裁定 4)+ `assertWorkspaceMemoryServiceAccess`(memory 写入接缝既有要求),都在事务外。
   - 类型钉死加载候选(CONFIRMED|CONSUMED bundle + CONFIRMED review + reviewedByUserId 非空)→ 解析+校验 artifact → supersession 复查(与 review/promote 同)→ **会话锚点**:取 artifact.signalReceiptRef 对应信号回执行的 `gatewaySessionRef`;为 null → `signal_receipt_without_session`(裁定 2,历史回执拒绝)→ 校验会话行存在且同 workspace(`gateway_session_not_found`)。
   - Serializable 内联事务 + lockWorkspace;确定性 candidateKey `member-signal-memory:<sha256(workspaceId, bundleId, artifactsJson hash).slice32>`;三层幂等(existence + AuditLog 匹配 + 字段等值,漂移 → conflict;P2002 复查)。
   - `memoryCandidate.create`:workspaceId、`memberGatewaySessionRef`(runtimeSessionId 不设)、artifactBundleId、candidateKey、summary = projectedSummary 截 4000、`sourceVerification` = JSON `{artifactReviewId, reviewedByUserId, reviewStatus:"CONFIRMED"}`、`sourceStatus` = JSON `{artifactStatus, candidateStatus:"pending_verification", officialMemoryPromotionAllowed:false, taint:"untrusted", evaluationUseProhibited:true, provenance:{memberRef, deviceRegistrationRef, clientId, policyRef, policyVersion, signalReceiptRef, gatewaySessionRef}}`(裁定 3:taint 随源携带,验证不抹除)、status PENDING_VERIFICATION、evidenceRefs。
   - 回执形状(纯对象返回,冻结字面量 `memoryPromotionCreated: false`、`canonicalMemoryWritten: false`,自校验 hash 照 closeout receipt 风格但 zod-free)+ audit `MEMBER_SIGNAL_MEMORY_CANDIDATE_PROJECTED`(payload 含两冻结假值,无正文)。
5. **taint 可见**:`lib/helm-v2/runtime-upgrade.ts` `buildEvidenceSourceClasses`(≈:6969)增加分支——`sourceStatus` 含 `"taint":"untrusted"` → push `"untrusted"` class(既有 Badge 渲染自动流入 /memory 与 operator 面板)。配套最小单测(该函数如未导出,导出或用既有测试模式)。
6. **测试**:契约单测(窗口判定、id 形状);mysql 扩展**既有套件**(不增新 env/CI 接线):`signal-store.mysql.test.ts` 加会话开启/窗口复用/跨窗新开 + challenge/回执落 sessionRef;`prompt-response-store.mysql.test.ts` 加响应与转移回执 sessionRef;`signal-candidate.mysql.test.ts` 加投影用例:happy(MemoryCandidate 行、恰一锚点、taint JSON、PENDING_VERIFICATION、audit)、幂等复用、历史回执(手工把信号回执经 root `$executeRaw`……不行,append-only——改为:直接造一条无 session 的信号回执?回执由 store 写入且现在总带 session——**用迁移前语义模拟**:测试里绕过?最诚实:对该用例直接 UPDATE 挑战表让 challenge 无 sessionRef 再走 submit?挑战表可直改(无触发器)→ 置 challenge.gatewaySessionRef=NULL → submit 产生无锚回执 → 投影拒绝 `signal_receipt_without_session`)、双门(MEMBER 拒)、**禁写证明**(投影后 MemoryPromotion/MemoryItem 计数为 0)、恰一锚点 CHECK(root `$executeRaw` 试插双锚/无锚行 → 3819)。
7. **门禁**:`check-member-gateway.ts` 扫描列表 += `gateway-session.ts`、`signal-candidate-memory-projection.service.ts`(+其测试);frozen marker += `"member-signal-memory:"`?(不必——marker 只锁契约字面量,加 `memoryPromotionCreated: false` 与 `canonicalMemoryWritten: false` 对投影 service 文件断言)。llm-candidate 门禁不扫 lib/member-gateway(已确认),但投影 service 自律遵守其禁写清单并以 mysql 禁写用例钉死。

**Tasks/commits:**
- T1 schema+迁移(db:generate、db:migrate 本地应用、typecheck)→ `feat(member-gateway): add gateway session anchor schema and memory candidate dual-anchor`
- T2 会话契约+store 挂接+单测/既有 mysql 套件扩展 → `feat(member-gateway): open and stamp gateway sessions across member write paths`
- T3 投影 service+回执+审计+mysql 用例 → `feat(member-gateway): project confirmed signal candidates into session-anchored memory candidates`
- T4 taint 渲染分支+测试 → `feat(helm-v2): surface untrusted member provenance in memory source classes`
- T5 门禁扩展+as-built+最终整体 review+push+PR。

**边界:** 不实现会话关闭、不实现 PENDING_VERIFICATION→VERIFIED 的验证动作(仓内本就无此转移,属记忆域后续)、不写 MemoryPromotion/MemoryItem;`officialMemoryPromotionAllowed:false` 与两冻结假值照 closeout 姿态。

---

## As-built 记录(2026-08-20 执行完毕)

分支 `feat/member-gateway-m2d`。五个任务全部按计划落地,顺序执行,每个
commit 过完整 pre-commit 门禁(`check:boundaries` 含
`check:conditional-update-cas`、`check:member-gateway`)。隔离 MySQL 套件
本地真库全绿;`npm run test:member-gateway:mysql`(四个 env var 全开)
77/77。

判断记录:

1. **遗留 FK 的强制丢弃(PROMINENT)**:`MemoryCandidate.runtimeSessionId`
   在 202604150001 baseline 迁移里带一个真实 MySQL 外键
   `MemoryCandidate_runtimeSessionId_fkey`(`ON DELETE CASCADE`),早于
   `relationMode = "prisma"` 切换,一直未被后续迁移动过。T1 迁移把该列
   改可空 + 加 `MemoryCandidate_anchor_check`(恰一锚点)时,MySQL 报错
   3823:"Column 'runtimeSessionId' cannot be used in a check constraint
   ... needed in a foreign key constraint's referential action"——只要那
   条 FK 的 CASCADE 语义还在,就不能在同一列上加 CHECK。这是在本地真库
   上实测到的,不是文档推断。迁移因此显式 `DROP FOREIGN KEY` +
   `DROP INDEX`(MySQL 为该 FK 自动建的同名单列索引),让
   `MemoryCandidate` 与其余 member-gateway 时代的表一致——都不带手写数
   据库 FK,匹配当前 `relationMode = "prisma"` 的真值。**行为后果**:
   Prisma Client 走查询引擎的调用仍由 relationMode="prisma" 的模拟层保
   证 `ON DELETE CASCADE` 语义;但一次绕过 Prisma Client 的原始 SQL
   `DELETE FROM RuntimeSession` 不会再在数据库层级联删除
   `MemoryCandidate` 行——仓内目前没有已知的这类原始删除路径,但这里明
   确记录供 owner 知悉。**索引覆盖**:被丢弃的 FK 支撑索引
   (`MemoryCandidate_runtimeSessionId_fkey`,MySQL 因当时没有以
   `runtimeSessionId` 打头的索引而自动建的单列 key)是冗余的——既有复合
   索引 `MemoryCandidate_workspaceId_runtimeSessionId_createdAt_idx`
   (`workspaceId`, `runtimeSessionId`, `createdAt`,baseline 迁移 +
   schema.prisma `@@index`)已覆盖本仓库每一处按 `runtimeSessionId` 的租
   户范围查询(所有查询都先按 `workspaceId` 过滤),因此未补建替代索引。
   T3 的 CHECK 证明用例(root-free,直接 `db.$executeRaw` INSERT)同时验
   证了两件事:恰一锚点 CHECK 生效;丢弃 FK 后任意
   `runtimeSessionId` 取值不再被外键校验(证明该丢弃确实生效,不是只
   停在 schema.prisma 文本层面)。

2. **`lib/helm-v2/runtime-upgrade.ts` 的三处可空收窄改动**:
   `runtimeSessionId` 变可空迫使 `runtimeSession` 关系跟着变可空,
   typecheck 在三处现网读取点报错——全部与 M2d 的新写路径无关,纯粹是既
   有代码此前隐含假设"每条 MemoryCandidate 都锚定在 runtime session
   上"从未被类型系统检验过。
   - `dismissReflectionCandidate` / `acceptReflectionCandidate`:两处改
     为显式防御性 guard(`if (!candidate.runtimeSession) throw ...`),
     不是裸 `!` 断言——依据的不变量是"反思延续候选(reflection
     carry-forward candidate)只能由 runtime-session 锚定的巩固链路创
     建"(`isReflectionMemoryCandidate` 判据钉死),member-gateway 新路
     径写的是 `memberGatewaySessionRef`,产生的候选永远不满足该判据,
     两条链路在数据形状上互斥。guard 失败时抛错而不是静默继续,一旦这
     个不变量未来被打破也会显式报错而不是产生一次空指针。
   - 运营总览(workspace runtime operator overview)的 memoryCandidate
     查询:加 `runtimeSessionId: { not: null }` 过滤 + 读侧
     `.filter().map()` 收窄(Prisma 生成类型不会因 where 取值而自动收
     窄,需要显式收窄配合)。这条查询本来就是 runtime-session 范围的视
     图,过滤 member-gateway 锚定行是行为上正确的选择,不是权宜之计——见判
     断 4。
3. **`resolveGatewaySession` 共享而非复制,附 CAS 门禁推理**:`signal-
   store.service.ts` 导出该函数(不是模块私有),`prompt-response-store.
   service.ts` 直接 import 复用,而不是像该文件已有的 CAS 转移机械代码
   那样手抄一份。原因记录在函数注释里:`resolveGatewaySession` 是一次
   普通的 `findFirst` + `create`,不是条件 `updateMany`,不落在
   `scripts/check-conditional-update-cas.ts` 的 "client-from-parameter"
   词法限制范围内——那条限制只认"CAS `updateMany` 的接收者根标识符必须
   就是当前 `$transaction` 回调自己的客户端形参"这一种可证明形状,普通
   的 create/findFirst 不受它约束。执行后 `check:conditional-update-
   cas` 零新增 finding(47 条既有 baseline 不变)。
4. **运营总览排除 member 锚定候选 + 无读侧诚实记录 + 记忆域验证面是后
   续**:T1 的查询过滤(判断 2)意味着 T3 投影产生的
   `MemoryCandidate` 行在 `getWorkspaceRuntimeOperatorOverview` 里永远
   不出现。T4 验证了 `/memory` 的另一条查询
   (`features/memory/queries.ts` 的 reflection-candidate 查询)同样把
   它们排除在外:该查询要求 `sourceVerification ===
   "human_confirmed_reflection"` 或 `sourceStatus ===
   "trusted_runtime_compaction"`(精确字符串相等)且
   `status IN (VERIFIED, PROMOTED, REJECTED)`——member-gateway 锚定行的
   `sourceVerification`/`sourceStatus` 是 JSON blob(两个字符串相等判
   断都不成立),`status` 恒为 `PENDING_VERIFICATION`(三个条件同时不满
   足)。**诚实结论**:member-gateway 锚定的 `MemoryCandidate` 行当前在
   仓内**没有任何读侧界面**会渲染它们——T4 加的 taint 渲染分支
   (`buildEvidenceSourceClasses` 的 `"untrusted"` class)是面向未来
   的:一旦任何界面开始渲染这批行,taint 立即可见,不需要再补渲染代
   码。真正把这批 `PENDING_VERIFICATION` 行接入一个验证/复核界面,是记
   忆域的后续切片,不在 M2d 范围内——本 as-built 明确记录这个缺口,而不
   是假装它已经被这次改动关闭。
5. **历史回执永久不参与事实晋升(裁定 2),已钉死测试**:T3 的
   `signal_receipt_without_session` 用例直接对 `MemberWorkSignalChallenge`
   (无触发器的可变表)做 `UPDATE ... SET gatewaySessionRef = NULL`,在
   `submitMemberWorkSignal` 之前把挑战行的会话锚点清空,模拟"M2d 迁移前
   签发的历史挑战/回执"——回执因此天生无锚,投影被拒绝,且没有任何补锚
   路径(裁定 2 明确排除人工补锚工具)。这是本切片里对"永久排除"最贴近
   现实的可测试模拟,不是理论声明。
6. **会话窗口语义(固定 30 分钟,开区间左闭右开)**:
   `isMemberGatewaySessionOpenAt` 在 `openedAt` 那一刻本身算"开着"(闭
   区间下界),在 `openedAt + MEMBER_GATEWAY_SESSION_WINDOW_MS` 那一刻
   算"已关"(开区间上界)——`gateway-session.test.ts` 显式钉死这两个边
   界(以及刚好在窗口结束前一毫秒仍被接受、超过窗口后被拒绝、
   `closedAt` 非空时无论 `nowMs` 落在哪里都拒绝)。没有滚动续期:
   `resolveGatewaySession` 复用一条行时只读它,从不写它,行在数据库里
   除了后续(本切片未实现的)显式关闭外保持不可变。

7. **运营笔记(非本切片缺陷,记录供未来排查参考)**:执行期间一次
   `npm run test:member-gateway:mysql` 全量并行运行偶发 24 个失败,报
   `MemberSignalCandidateError: unsafe_candidate_text`,来源是
   `lib/llm/output-pii-scrubber.ts` 的 `detectPIIInOutput`——它对序列化
   后的候选 artifact 全文做银行卡号 Luhn 校验扫描
   (`\b\d{13,19}\b` + Luhn),而本文件(以及每一个 member-gateway mysql
   套件)的测试夹具 id 前缀普遍用 `${process.pid}-${Date.now()}` 做唯一
   后缀——`Date.now()` 在当前年代恰好是 13 位纯数字,被前后的连字符天然
   构成单词边界,一旦这 13 位数字凑巧 Luhn 校验通过,就会被误判成银行
   卡号触发拒绝。复测(标准套件单独跑、全量套件重跑两次)全部
   77/77/30 绿,证明这是运行时刻的巧合,不是本次改动引入的缺陷——但这
   是整个 member-gateway mysql 测试家族共享的既有脆弱点(每个用同一
   `suffix` 生成 artifact 文本的用例都暴露在同样的小概率下),值得未来
   某个切片把该探测器换成不依赖裸数字游程宽匹配的实现,或让测试夹具的
   id 避免出现纯数字 13-19 位游程。本次不动手修——超出 M2d 范围,且
   `detectPIIInOutput` 本身没有 bug(它是按设计扫描任意长数字游程)。

Verified:typecheck/lint 均绿;`check:member-gateway` 负向验证通过(临时
从投影 service 文件里删除 `memoryPromotionCreated: false` 字符串 → 门禁
FAIL,报出缺失的具体 marker → 还原 → 门禁重新 PASS);
`check:conditional-update-cas` 零新增 finding;`npm run
test:member-gateway:mysql`(四个 env var 全开)77/77 绿,同一命令重跑两
次结果一致。
