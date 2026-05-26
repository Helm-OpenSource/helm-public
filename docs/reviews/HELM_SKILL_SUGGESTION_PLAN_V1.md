---
status: active
owner: helm-core
created: 2026-04-09
review_after: 2026-07-08
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# HELM_SKILL_SUGGESTION_PLAN_V1

状态：Planned  
Owner：Helm Core  
日期：2026-04-09

## 1. 目标

本轮只做一条最小、可审计、review-first 的内部链路：

`PatternFact -> SkillSuggestion -> 人工 accept -> candidate capability`

它的目标不是让 Helm 自动发明正式 Skill，而是补出一个介于“系统学到的 pattern”和“人工手写进静态 skill catalog 的正式能力”之间的候选层，方便 operator 看见、判断、采纳、忽略。

本轮只冻结 4 件事：

1. `SkillSuggestion` 最小 schema
2. 最小 list / accept / dismiss API
3. 最小 operator surface
4. accept 之后的边界落点

## 2. 当前阶段引用的产品 truth

本轮显式引用：

- `docs/product/HELM_PRODUCT_PRINCIPLES_V1.md`
- `docs/product/HELM_WORKER_SKILL_RESOURCE_PROTOCOL_V1.md`
- `docs/product/HELM_OPERATING_FOUNDATION_BASELINE_FREEZE_REPORT.md`
- `docs/product/HELM_COGNITIVE_OBJECT_AND_FOUR_PLANE_CONTRACT_BASELINE_V1.md`
- `docs/product/helm-proactive-work-and-human-collaboration-protocol-v1.md`

本轮直接建立在当前已成立的 repo seam 上：

- `prisma/schema.prisma` 已有 `PatternFact`、`StrategySuggestion`、`CapabilityCatalogEntry`
- `lib/evolution/pattern-detection.service.ts` 已有 evolution refresh 主循环
- `lib/evolution/strategy-suggestion.service.ts` 已有 accept / dismiss / audit / event / notification 姿态
- `app/(workspace)/dashboard/page.tsx` 已有 evolution insight preview
- `features/settings/settings-client.tsx` 的 `tab=policies` 已有 operator policy center
- `features/settings/actions.ts` 与 `app/api/evolution/strategy-suggestions/*` 已有治理与 revalidate 模式

本轮为什么现在做：

- Helm 已经会从使用中总结 pattern，并把一部分建议收敛成 rule / signal
- Helm 还没有一层“候选可复用能力”来承接这些 pattern
- 如果直接跳到 runtime-generated formal skill，会越过当前静态 catalog、边界治理和 review-first posture

## 3. 范围

### In Scope

- 新增 `SkillSuggestion` 最小 Prisma model
- 新增 `lib/evolution/skill-suggestion.service.ts`
- 在 evolution refresh 中触发 `syncSkillSuggestions`
- 新增 `GET /api/evolution/skill-suggestions`
- 新增 `POST /api/evolution/skill-suggestions/[id]/accept`
- 新增 `POST /api/evolution/skill-suggestions/[id]/dismiss`
- 新增 `acceptSkillSuggestionAction` / `dismissSkillSuggestionAction`
- 在 `/settings?tab=policies` 增加 `Skill suggestions` 区块
- 在 dashboard evolution 卡片增加 1 条 candidate preview
- accept 后 upsert 一条 `CapabilityCatalogEntry`
- 同步 docs / self-check / boundary-check / tests

### Out of Scope

- 修改 `lib/operating-system/skill-catalog.ts`
- 扩张 `lib/operating-system/types.ts` 中的 `OperatingSkillId`
- 自动生成 `.agents/skills/*.md`
- 自动把 candidate skill 接进 worker routing / orchestration
- customer-facing auto-send
- high-risk auto-write
- capability marketplace / skill builder / full skill console

## 4. 最小 schema

为避免把本轮扩成新平台，schema 继续对齐现有 `PatternFact` / `StrategySuggestion` 风格，优先使用 string snapshot，不引入更重的 canonical spec engine。

建议新增：

```prisma
model SkillSuggestion {
  id                      String    @id @default(cuid())
  workspaceId             String
  fingerprint             String    @unique
  suggestionType          String    @default("NEW_SKILL_CANDIDATE")
  status                  String    @default("OPEN")
  candidateSkillKey       String
  candidateSkillName      String
  candidateCategory       String
  candidateBoundary       String
  candidateEffectMode     String
  candidateDefaultSurface String
  title                   String
  reason                  String
  confidence              Int       @default(50)
  candidateSpecJson       String
  evidenceSnapshot        String?
  sourcePatternFactIds    String?
  sourceRecommendationIds String?
  nonCommitmentNote       String
  confirmedByUserId       String?
  confirmedAt             DateTime?
  appliedTargetType       String?
  appliedTargetId         String?
  appliedEffectSummary    String?
  appliedAt               DateTime?
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
  workspace               Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId, status, createdAt])
  @@index([workspaceId, candidateSkillKey])
}
```

`candidateSpecJson` 只承载 review 用的建议 spec，不承载 executable runtime contract。建议最小字段：

- `reads`
- `writes`
- `resourceBindings`
- `primaryActionTypes`
- `primaryObjectTypes`
- `sourcePatternTitles`
- `operatorReviewChecklist`

字段约束：

- `candidateBoundary` 只能进入 `internal_only` / `draft_only` / `review_required`
- `candidateEffectMode` 只能进入 `read_only` / `draft_only` / `internal_write`
- 必须显式写 `nonCommitmentNote`
- 不允许通过 schema 表达 `customer_visible_send` 或 `auto_commitment`

## 5. 任务拆解

### Task 1 - schema and data seam

目标文件：

- `prisma/schema.prisma`

本任务只做：

- 新增 `SkillSuggestion` model
- 在 `Workspace` 上补 `skillSuggestions SkillSuggestion[]`
- 保持字段命名与 `StrategySuggestion`、`CapabilityCatalogEntry` 对齐
- 保持 migration 范围最小，不引入新的 capability runtime object

### Task 2 - detection and sync service

目标文件：

- `lib/evolution/skill-suggestion.service.ts`
- `lib/evolution/pattern-detection.service.ts`
- `lib/evolution/evolution-insights.service.ts`

本任务只做：

- 新增 `syncSkillSuggestions(workspaceId)`，复用 evolution refresh 主循环
- 输入只读取当前已存在的低风险信号：
  - active `PatternFact`
  - 已有 recommendation / approval / adoption 证据
  - 已成立的 settings / dashboard evolution 数据流
- 生成条件收窄为：
  - 同类 flow 重复至少 3 次
  - `confidence >= 70`
  - 只能指向 `read_only` / `draft_only` / `internal_write`
  - 必须带 review-only / non-commitment note

本任务明确不做：

- LLM 自由生成完整 skill DSL
- 从 pattern 直接升格成 formal `OperatingSkillId`
- 让 detection 结果直接进入执行面

### Task 3 - API, actions and governance

目标文件：

- `app/api/evolution/skill-suggestions/route.ts`
- `app/api/evolution/skill-suggestions/[id]/accept/route.ts`
- `app/api/evolution/skill-suggestions/[id]/dismiss/route.ts`
- `features/settings/actions.ts`
- `lib/auth/tenant-ownership.ts`
- `lib/auth/insight-governance-routes.test.ts`

本任务只做：

- 新增 list / accept / dismiss route
- 新增 `acceptSkillSuggestionAction` / `dismissSkillSuggestionAction`
- 复用现有 workspace governance posture
- 复用现有 ownership assertion 模式
- 复用现有 `/settings`、`/dashboard`、`/reports` revalidate 范式

治理要求：

- 只有 `canManageWorkspacePolicies` 为真时才允许 accept / dismiss
- route 和 action 都必须做 active workspace ownership 校验
- accept / dismiss 都必须写 audit log、event log、notification
- 所有 user-facing 文案必须说明这是 `candidate capability`，不是正式 skill，也不是外部承诺

### Task 4 - operator surface

目标文件：

- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- `app/(workspace)/dashboard/page.tsx`

本任务只做两处 surface：

1. `settings -> policies`
2. dashboard evolution 卡片

`settings -> policies` 最小 UI：

- 卡片标题：`Skill suggestions`
- 每张卡展示：
  - `candidateSkillName`
  - `reason`
  - `confidence`
  - `candidateBoundary`
  - `candidateEffectMode`
  - `nonCommitmentNote`
  - `Accept as candidate capability`
  - `Dismiss`

dashboard 最小 UI：

- 只展示最新 1 条 open `SkillSuggestion`
- CTA 继续跳到 `/settings?tab=policies`
- 不增加新的 tab、wizard 或 console

### Task 5 - accept boundary

目标文件：

- `lib/evolution/skill-suggestion.service.ts`
- `prisma/schema.prisma`
- `lib/helm-v2/runtime-upgrade.ts`（只读对齐，不把 candidate 写进 seed path）

accept 的唯一落点是：

- upsert 一条 `CapabilityCatalogEntry`

建议写法：

- `capabilityKey = ${workspaceId}:candidate-skill:${candidateSkillKey}`
- `stage = "candidate_skill"`
- `loadPolicy = "on_demand"`
- `reviewRequired = true`
- `boundaryNote = nonCommitmentNote`

accept 后允许成立的效果：

- operator 在 capability catalog 中看见一条 review-first 的 candidate capability
- settings / dashboard / reports 可读取这条 adoption 结果
- 系统知道“这条 pattern 已被人工确认值得作为候选能力观察”

accept 后明确不允许成立的效果：

- 不注册正式 `OperatingSkillId`
- 不改动 `SKILL_CATALOG`
- 不自动分配 worker
- 不自动接进 routing
- 不自动获得 send / commitment / high-risk write authority

### Task 6 - promotion ladder

目标文件：

- `lib/evolution/skill-suggestion.service.ts`
- `features/settings/queries.ts`
- `features/settings/settings-client.tsx`
- `prisma/schema.prisma`
- `lib/operating-system/skill-catalog.ts`（只作为最终人工晋级时的目标，不在前两层自动改动）

本任务只先冻结晋级链，不在本轮直接实现完整自动升级：

1. `candidate capability`
2. `probationary capability`
3. `formal skill`

三层含义必须明确区分：

- `candidate capability`
  - 表示某类 pattern 已被人工确认“值得作为候选能力继续观察”
  - 允许进入 capability catalog
  - 不进入 routing，不进入 worker dispatch
- `probationary capability`
  - 表示候选能力已经有持续复用、持续采纳和稳定边界记录
  - 允许在 operator surface 里获得更高可见度和更完整 review checklist
  - 仍不进入正式 skill catalog，不获得自动执行权限
- `formal skill`
  - 只表示“人工确认它值得成为正式系统能力”
  - 需要显式补静态 catalog、测试、boundary guard、文档
  - 进入 formal skill 之后，是否允许被 routing 使用，仍要走独立治理，不因晋级自动获得

建议晋级信号：

- `candidate -> probationary`
  - 至少 3 次人工 accept
  - 至少 2 个时间窗口内持续复现
  - 没有新增 high-risk boundary exception
  - 相关 candidate capability 的 review note 保持稳定
- `probationary -> formal`
  - 已有稳定 adoption evidence
  - 已补正式边界文案与 non-commitment note
  - 已补 service / route / UI / guard / regression tests
  - 已人工评审并明确写入静态 `skill-catalog`

本任务明确不做：

- candidate 被系统自动升格为 formal skill
- probationary capability 自动获得 worker binding
- probationary capability 自动获得 send / commitment / official write 权限
- 用 usage count 直接替代人工治理

推荐落库方式：

- 继续以 `CapabilityCatalogEntry.stage` 承载 `candidate_skill` / `probationary_skill`
- `formal skill` 不继续只靠 `CapabilityCatalogEntry` 表达，而是必须回写到正式静态 catalog
- 所有晋级事件都必须写 audit / event / evidence snapshot

### Task 7 - docs, guards and tests

目标文件：

- `README.md`
- `docs/README.md`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- 对应 service / route / settings tests

本任务只做最小同步：

- 文档索引接入
- self-check 识别 `SkillSuggestion` 基础文件是否存在
- boundary-check 识别 candidate / probationary skill 仍停留在 review-first / non-commitment posture
- service tests 覆盖 detect / accept / dismiss
- governance tests 覆盖 permission 和 ownership
- 晋级链测试覆盖：
  - candidate 不会自动变 formal
  - probationary 不会自动获得 routing / send / write authority
  - formal skill 仍要求静态 catalog + tests + docs

后续实现完成时，应再补：

- `docs/product/HELM_SKILL_SUGGESTION_BASELINE_V1.md`
- `docs/reviews/HELM_SKILL_SUGGESTION_REPORT_V1.md`

## 6. 验收标准

实现 PR 完成时必须满足：

1. `SkillSuggestion` schema 已落库
2. list / accept / dismiss API 已可用
3. `settings -> policies` 与 dashboard preview 已接入
4. accept 只会生成 `candidate capability`，不会生成 formal skill
5. `candidate -> probationary -> formal` 晋级链已被明确建模为分层治理，不是自动扩权
6. audit / event / notification 已对齐
7. `README.md` / `docs/README.md` / self-check / boundary-check / tests 已同步
8. 完整验证链全绿

## 7. 验证清单

```bash
npm run db:reset
npm run self-check
npm run check:boundaries
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
npm run quality:regression
```

## 8. 风险

### 8.1 candidate capability 被误读成 formal skill

如果 accept 文案、stage 命名或 capability surface 写得太像正式能力，会直接冲掉当前 static catalog truth。

### 8.2 pattern 被误升格成 execution authority

如果 candidate skill 被接进 routing、worker dispatch 或 external send，等同于越权扩面。

### 8.3 suggestion spam

如果 detection 过松，operator surface 会被低价值 candidate 淹没，反而削弱信任。

### 8.4 capability key collision

如果 candidate capability 与现有 runtime capability 共用 key 结构，会污染 catalog。

### 8.5 probationary 被误读成已可执行 formal skill

如果 `probationary` 在页面、日志或文档里写得像“已经上线的正式能力”，会让 operator 误以为它已经获得 routing 或 execution authority。

## 9. 四类短表

| 项目 | 四类归属 | 说明 |
| --- | --- | --- |
| `PatternFact` detection | 已经完整成立 | 系统已能从近期审批、阻碍、推进节奏中总结稳定 pattern。 |
| `StrategySuggestion -> PolicyRule / PreferenceSignal` | 已经完整成立 | 人工 accept 后收敛成系统规则的链路已经存在。 |
| `SkillSuggestion -> candidate capability` | 已成形但仍需下一层 | 本轮只补候选能力层，不直接变 formal skill。 |
| `candidate capability -> probationary capability` | 已成形但仍需下一层 | 可以自动沉淀更多证据与复用性，但仍不获得正式执行资格。 |
| runtime-generated formal skill | 刻意未做 | 当前仍不让系统自己注册新 skill 或扩张执行边界。 |
| candidate / probationary 被误读成 commitment / authority | 风险项 | 最容易在 UI、命名和晋级文案上把边界写松。 |

## 10. 本轮完成定义

本轮完成，不看“自动生成了多少新 skill”，只看：

- Helm 是否新增了一层可审计、可解释、可人工确认的 `SkillSuggestion`
- operator 是否能在现有 policy center 里安全处理这些 candidate
- `candidate -> probationary -> formal` 是否被明确拆成分层治理，而不是自动进化成执行权
- candidate / probationary 是否仍明确停留在 `review-first`、`internal-only`、`non-commitment` 边界内
- 静态 skill catalog truth 是否仍被诚实保留
