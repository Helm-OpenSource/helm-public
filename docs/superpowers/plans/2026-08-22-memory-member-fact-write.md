---
status: archived / executed-with-as-built-record
owner: helm-core
created: 2026-08-22
review_after: 2026-09-22
public_safety: Implementation plan for member candidate fact promotion
  (verify writes runtime memory). No customer data, credential, private
  endpoint, or production-readiness claim.
---

# 记忆域:成员候选事实晋升(验证即写入)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 executing-plans。

**Goal:** 按 owner 三项裁定(2026-08-22 第二轮)落地:member 锚定候选的验证动作**直接写入运行时记忆**——目标 `MemoryItem`、有锚带锚无锚也写、taint 来源标注永久携带。

**裁定取代声明(必须写进 spec/as-built)**:本轮裁定 3"验证即自动写入"**取代**上一轮裁定 3"验证≠写入、文案诚实"。已上线的验证面语义与文案随之返工:verify = 确认真实 **并** 写入运行时记忆(带永久 untrusted 来源标注);候选终态由 VERIFIED 改为 **PROMOTED**(回填 `memoryItemId`);历史上停在 VERIFIED 的 member 行(如有)保持原样展示,新流程不再产生。

**Architecture(绑定):**

1. **写入目标 MemoryItem(裁定 1)**:镜像既有 create 站点(`lib/helm-v2/meeting-action-pack-runtime.ts:759` 等)的必填列;`sourceProvenance` 携带完整 member 溯源 JSON(taint:"untrusted"、evaluationUseProhibited、memberRef/device/client/policy、signalReceiptRef、gatewaySessionRef、artifactBundleId、candidateKey)——**永久标注,检索/展示可见**。
2. **锚点(裁定 2)**:artifact 的 `objectAnchor.resolved` 且其 plain-string `objectType` 恰为 Prisma `ObjectType` 枚举成员 → 写 `objectType/objectId`;否则(未解析、或字符串不在枚举内)写无锚条目,opaque objectRef 保留在 provenance。枚举匹配用白名单比对,不做 as-cast。
3. **验证 service 语义改造**(`signal-candidate-memory-verification.service.ts`):
   - `decision:"verify"` 的事务体扩展:CAS PENDING→**PROMOTED**(不再落 VERIFIED)+ 同事务 `tx.memoryItem.create` + CAS 回填 `memoryItemId`(同一 update);`decision:"reject"` 不变(REJECTED)。
   - 幂等:行已 PROMOTED 且 `memoryItemId` 非空 → `already_decided`(不重复写 item);行 VERIFIED(旧语义遗留)→ `memory_candidate_state_conflict`(旧行不自动升级,as-built 记录);corrupt 检查保留(写入前更要严)。
   - **MemoryPromotion 仍不可写**(runtime 锚必填,结构不变);audit payload 增 `memoryItemId`、`memoryItemCreated: true`。
4. **门禁修订(显著记录)**:`check-member-gateway.ts` 对验证 service 的禁写正则从 `/\.memoryPromotion\.|\.memoryItem\./` 收窄为 `/\.memoryPromotion\./`,注释引用本轮裁定与取代声明;投影 service 的双禁不变(投影仍然只产生 PENDING 候选)。frozen marker:验证 service 增 `"PROMOTED"` 与 `memoryItemCreated: true` 在场断言。
5. **UI/文案返工**(`memory-client.tsx` + 契约测试):区头文案改为"验证 = 确认为真实信号并写入运行时记忆(条目永久携带'未信任成员上行'来源标注);拒绝则不写入"——避 systemspeak;member 决定标签:PROMOTED→"已验证并写入记忆",REJECTED→"已拒绝",VERIFIED(遗留)→"已验证(旧流程,未写入)";按钮文案 verify 改"验证并写入";`memory-client-source-contract.test.ts` 文案钉同步替换。action/queries 形状不变(status IN 集合加 PROMOTED)。
6. **测试**:mysql 用例改造/新增:verify happy 现在断言 MemoryItem 行存在(sourceProvenance 含 taint/refs、锚点两分支各一例:枚举命中带锚、opaque 无锚)+ 候选 PROMOTED + memoryItemId 回填 + audit;幂等重放不重复建 item(count 不变);reject 不建 item;corrupt 仍拒;遗留 VERIFIED 行冲突;MemoryPromotion 零增量保持。`features/memory` 组件/契约测试同步。

**Tasks/commits:**
- T1 service 语义改造 + mysql → `feat(member-gateway): verify now writes a tainted runtime memory item`
- T2 门禁修订 + UI/文案返工 + 契约测试 → `feat(memory): rework verification surface for write-on-verify semantics`
- T3 spec 取代声明 + as-built + 最终整体 review + push + PR。

**边界:** MemoryFact 不写(升级留后续);MemoryPromotion 结构不可写不变;reflection 家族零触碰;历史 VERIFIED 行不迁移。

---

## As-built 记录(2026-08-22 执行完毕)

分支 `feat/memory-member-fact-write`(在已合并的
`feat/memory-member-verification` 之上续接)。三个任务全部按计划落地,
顺序执行,每个 commit 过完整 pre-commit 门禁(`npx lint-staged` →
`npm run check:boundaries`,含 `check:conditional-update-cas`、
`check:member-gateway`、`check:caio-terminology` → 独立
terminology 直调),从未跳过钩子。

Commits:

1. `1516c2f1` T1 — `feat(member-gateway): verify now writes a tainted
   runtime memory item`
2. `95f60906` T2 — `feat(memory): rework verification surface for
   write-on-verify semantics`
3. T3(本次)— `docs(memory): record the write-on-verify supersession and
   fact-write as-built`

### 判断记录

1. **裁定取代声明已落地三处**:本文件 §"裁定取代声明"、
   `docs/superpowers/specs/2026-08-20-member-gateway-stage-two-fact
   -promotion-design.md` 新增的"Owner 裁定记录(2026-08-22 第二轮:事
   实晋升)"小节、以及代码内(`signal-candidate-memory-verification
   .service.ts` 文件头注释 + `scripts/check-member-gateway.ts` 的门禁
   注释)全部显式引用"本轮裁定 3 取代
   `docs/superpowers/plans/2026-08-22-memory-member-verification.md`
   的裁定 3(验证≠写入、文案诚实)"。三处措辞一致,任何一处单独阅读都
   能定位到被取代的原始裁定与取代原因。

2. **`MemoryItem` 列集选择与判断依据**(T1 原始判断,verbatim 保留):
   - 必填列(`workspaceId, kind, scope, namespace, writer, summary,
     payload`)全部按 schema 要求填齐;`objectType/objectId` 仅在锚点
     解析且命中 `ObjectType` 白名单时写入,否则留空。
   - **`meetingId`/`opportunityId`/`companyId` 三列刻意不写**——这三
     列正是 `lib/helm-v2/opportunity-judge-runtime.ts`、
     `draft-comms-handoff-runtime.ts`、
     `connector-ingestion-retrieval-runtime.ts` 用来把 `MemoryItem`
     行拉进 AI 评估/判断上下文的 OR 过滤键;不写它们能让这条永久带毒
     的记忆行**结构性地**被排除在所有这些加载器之外,不论 status 取
     什么值——这比挑"看起来安全"的枚举值更强的
     `evaluationUseProhibited` 落地保证。
   - 选择 `status: CONFIRMED`(不是 `PROMOTED`)、
     `verification: DRAFT`(不是 `HUMAN_CONFIRMED`)的原因:
     `connector-ingestion-retrieval-runtime.ts` 的
     `toMemoryTrustStatus` 把 `status === PROMOTED` 直接读成
     `"human_confirmed"`,**不管** `verification` 列的值——停在
     `CONFIRMED` 能避开这条捷径,防止一条永久不受信的内容被误判为可
     信。`verification: DRAFT` 的原因是:验证动作只确认了"这是一条真
     实的成员信号"(来源真实性),从未确认"这条内容是事实"(内容真实
     性)——`HUMAN_CONFIRMED` 会主张后者,正好与
     `evaluationUseProhibited` 相反。
   - **已知 schema 缺口(留给 owner 的后续跟进项)**:
     `MemoryItemVerification` 枚举(`DRAFT | INFERRED |
     HUMAN_CONFIRMED | SYSTEM_OF_RECORD | DEPRECATED`)里没有一个诚实
     值能表达"来源(成员)已确认真实,但内容本身未受验证"这个中间态——
     `DRAFT` 是当前能选的最不会误导的选项,但它本身的通常语义是"尚未
     被任何人审阅",与"已经过一次人工审阅(验证动作本身)但内容仍未
     受信"并不完全贴合。这是一个可选的、非必填列上的判断,不构成本
     轮 T1 的 STOP 触发条件(STOP 条件是必填列上没有诚实值可选),但
     记录为供 owner 决定是否需要新增枚举值(例如
     `SOURCE_CONFIRMED_CONTENT_UNVERIFIED` 一类)的后续项。

3. **历史 VERIFIED 行不迁移,新流程不再产生**:T1 mysql 套件新增专门
   用例——手动把一条候选行的 `status` 置为 `VERIFIED`(模拟裁定生效
   前遗留的行),再对其发起 `verify` 决策,断言返回
   `memory_candidate_state_conflict` 且行状态原样保持
   `VERIFIED`、`memoryItemId` 仍为 `null`——验证遗留行既不会被自动升
   级为 `PROMOTED`,也绝不会在冲突路径上意外产生一条 `MemoryItem`。
   `/memory` 页面对应渲染独立标签"已验证(旧流程,未写入)"/
   "Verified (legacy, not written)",与 `PROMOTED` 的"已验证并写入记
   忆"/"Verified & written to memory"视觉区分(badge variant
   `warning` vs `success`)。

4. **门禁正则收窄,双重钉死**:`scripts/check-member-gateway.ts` 对验
   证 service 的禁写正则从 `/\.memoryPromotion\.|\.memoryItem\./` 收
   窄为 `/\.memoryPromotion\./`,注释引用本轮裁定;同时新增
   `"PROMOTED"` 与 `memoryItemCreated: true` 两个在场断言(字面量必
   须出现在文件源码里,静态防止未来改动悄悄丢掉这两个契约标记)。投
   影 service(`signal-candidate-memory-projection.service.ts`)的双
   禁(`MemoryPromotion` + `MemoryItem`)**完全未动**——投影产生的仍
   然只是 `PENDING_VERIFICATION` 候选,从不落地任何记忆写入,这条边
   界本轮裁定没有触碰。

5. **UI/文案返工范围克制在验证面**:`memory-client.tsx` 的改动只覆盖
   成员信号验证卡片(标题、说明段落、按钮文案、决定标签、徽章配
   色)、`queries.ts` 的 status IN 集合、以及 `actions.ts` 的过期注
   释;蒸馏候选区、复盘延续区等相邻卡片的文案与结构逐字未动。

### 验证(T3 收尾,全部本地真实执行,非猜测)

- `npm run test:member-gateway:mysql`(`DATABASE_URL`、
  `MEMBER_SIGNAL_STORE_DATABASE_URL`、
  `MEMBER_PROMPT_STORE_DATABASE_URL`、
  `MEMBER_PROMPT_RESPONSE_STORE_DATABASE_URL`、
  `MEMBER_SIGNAL_CANDIDATE_DATABASE_URL` 五个 env var 全部指向同一隔
  离本地 MySQL 库)本地真库全绿:4 files / 86 tests passed(其中
  `signal-candidate.mysql.test.ts` 单独跑时 39/39,含 T1 新增的两个锚
  点分支用例、幂等/reject/corrupt/legacy-VERIFIED-冲突五类断言)。
- `npx vitest run features/memory`:6 files / 37 tests passed。
- `npx vitest run features/memory lib/presentation/shared-surface
  -hierarchy-guards.test.ts`(T2 收尾时跑的组合口径,含 presentation
  守卫全量):7 files / 144 tests passed,零新增失败(高于原验证面轮
  次的 107/107 基线,因为本轮在 `queries.test.ts`/
  `memory-client-source-contract.test.ts` 里新增了 PROMOTED 相关的正
  向用例)。
- `npm run check:member-gateway`:PASS(含
  `check-member-gateway.ts` 静态门禁 + `lib/member-gateway` 全套
  vitest)。
- `npm run typecheck`:PASS(`tsc --noEmit --project
  tsconfig.public.json`,零错误)。
- `npm run lint`:PASS(零 warning,`--max-warnings 0`)。
- `npm run check:boundaries`(T1/T2 两个 commit 各自的 pre-commit 钩
  子里都完整跑过一次)与 `npm run test`(全量 967 个测试文件,T2 收尾
  时 944 files / 8294 tests passed、23 files / 278 tests skipped,跳
  过的全部是需要额外隔离 MySQL env var 的套件)均全绿。

**结论**:三项第二轮裁定(写入目标 `MemoryItem`、锚点白名单匹配带锚/
无锚双写、验证即自动写入)已完整落地并通过隔离 MySQL 真库验证;`验证
≠写入` 的旧裁定与其文案在 spec、代码注释、UI 三处均已显式记录为被取
代,不留误导性残留。

6. **最终 review 加固与诚实修正**:(a) 写入的 MemoryItem 当前**无任何
   展示/检索面渲染**,sourceProvenance 无任何读方——"结构性不可见"正
   是本轮对 taint 内容的保护;设计文档裁定 1 的"检索/展示可见"表述已
   修正为现状诚实说明,带 taint 一等渲染的展示面记录为 owner 后续项。
   (b) 新增对抗性用例:member 可控的伪造 resolved objectType
   ("NOT_A_REAL_TYPE")经枚举白名单落回无锚分支,钉死不可 cast 穿透。
   (c) 被取代的验证面计划头部补裁定取代前指。(d) `retention:
   UNTIL_VERIFIED` 目前无任何清理器消费,条目事实上永久——与姊妹
   create 站点惯例一致,记录以免误解存在生命周期。
