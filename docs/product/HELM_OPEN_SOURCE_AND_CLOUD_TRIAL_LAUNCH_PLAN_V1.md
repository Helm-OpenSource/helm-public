---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Open Source And Cloud Trial Launch Plan V1

更新时间：2026-05-02
状态：Phase A planning freeze（仅文档与上下文层；尚未进入 runtime / schema / API 改造）
适用范围：五月开源 + 云端公开试用的目标、四项关键决策、五周分解、No-Go 触发条件
实现状态：未实现（本计划为推进依据，每条动作的真正落地仍需独立 PR 与验证链）

本文件把 2026-04-27 与项目 owner 对齐的四项关键决策与五周分解合并成一份对外可引用、对内可执行的 launch plan。它在 [HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md](./HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md) 之上叠加「五月开源 + 云端试用」目标，并在 §三 中**显式部分覆盖**该文件 §5.5 中关于 runtime adoption 的全局禁止条款。

---

## 一、目标

在 2026-05-31 前同时达成两件事：

1. **Track A：开源代码可读** — 公开 Git 仓库可被外部读者快速理解、可在 5 步内本地起服务、可依据 LICENSE / CONTRIBUTING / SECURITY 接收外部贡献。
2. **Track B：云端公开试用可注册** — 在一个公有云环境上提供 self-serve trial，新用户可完成 signup → setup → 看到 `/mobile` 第一屏 → 触达 `/operating` 与 Ask Helm，并理解试用边界。

两条 Track 共用同一个 `v0.1.0-trial` release 标记。

---

## 二、四项关键决策

以下四项已与 owner 对齐，作为本计划的输入约束：

### 2.1 License = Apache-2.0

- 已落地：`LICENSE`、`NOTICE`、`package.json` 的 `"license": "Apache-2.0"` 字段已添加
- 选择理由：与 Anthropic / Microsoft Copilot Studio 等竞品兼容；对企业贡献者最友好；包含明确的专利授权与终止条款
- 适用范围：本仓库公开发布的所有源代码、文档、配置；第三方依赖保留各自 license

### 2.2 不同步发布 `extensions/guangpu/`

- 公开仓库不包含 `extensions/guangpu/`、`app/api/extensions/guangpu/`、所有 `guangpu` / `midun` / `zhaojiling` 专属 npm script、专属 `.env.example` 块、专属 prisma manual SQL
- 共享层（`app/`、`features/`、`lib/`）必须把对租户 slug 的 hardcoded 引用抽到 `lib/extensions/registry.ts`，缺失时优雅降级
- 选择路径：**双仓库（路径 A）** — 公开仓库 = 当前仓库做剥离后的版本；私有仓库 = `helm-tenants-private` 镜像 guangpu 子树
- Git 历史中的 guangpu commit **不重写**（接受历史可搜到，HEAD 干净即可）。如果客户合同后续要求历史脱敏，再走 `git filter-repo` 路径
- 详细执行计划见 [HELM_PRIVATE_TENANT_SEPARATION_PLAN_V1.md](../internal/HELM_PRIVATE_TENANT_SEPARATION_PLAN_V1.md)

### 2.3 云端试用：不承诺 SLA，数据保留期需法务签署后生效

- **No SLA**：受控试点姿态，不承诺可用性、性能、恢复时点
- **数据保留期目标草案**（保守可发布路径，与现有 `lib/billing/foundation.ts` 一致；不做 schema 扩张；正式公开口径以工作区契约和法务签署后的生效数据政策为准）：
  - Active retention：30 天（自 workspace 创建日起）
  - Grace retention：7 天 read-only
  - Hard deletion：grace 结束即物理删除并通过邮件出具删除证明
  - User-initiated deletion：请求后立即进入 grace，7 天内可撤回；逾期物理删除
- 目标总链路最长 37 天；法务最终确认前不得作为 public commitment 销售或宣传
- **Sub-processors（实名）**：阿里云 RDS MySQL / ECS / OSS / SLS / DirectMail（cn-hangzhou，默认启用）；OpenAI API（默认关闭，启用前显式披露）；支付能力（public trial 默认关闭）
- 详细政策见 [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)

### 2.4 Phase 3 runtime adoption 在五月解禁（受限解禁）

- **解禁范围**：仅 TPQR-001 / TPQR-003 / TPQR-004 三条 thin read-model adapter；AdvancementSignal → MustPushItem deterministic adapter 接入 `/mobile` 第一屏 Must Push 段；Ask Helm interaction asset 写入 `MemoryCandidate / SkillSuggestion`
- **继续禁止**：TPQR-002（stalled_opportunity）/ TPQR-005（tenant_resource stalled_case）；schema 扩张；official write / 自动发送 / 自动审批 / 自动结算；LLM 做最终排序；跨 workspace 聚合；SkillSuggestion 自动晋升；Ask Helm 多轮聊天历史持久化
- **6 项硬前置**：redacted live DB calibration 证据；5 角色 Required Reviewer approval；disabled-by-default rollout；rollback proof；audit completeness；boundary regression test
- **OPC 执行解释**：在 founder-led 阶段，5 角色先作为 5 个强制评审视角进入 founder decision packet；内部 disabled scaffold / reserved dogfooding 准备不因真人 reviewer 未齐而停摆。但 public trial、production query adoption、客户数据、隐私、安全和公开 claim 仍必须按 [HELM_FOUNDER_LED_OPC_OPERATING_PROTOCOL.md](./HELM_FOUNDER_LED_OPC_OPERATING_PROTOCOL.md) 升级到 evidence gate 或 independent review。
- 详细范围、前置条件与回滚剧本见 [HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md)
- **本条决策显式部分覆盖** [HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md](./HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md) §5.5 中关于「runtime extractor / production query adoption / page 行为变更」的全局禁止条款；其余 No-Go 条款（schema 扩张、自动执行、跨 workspace、marketplace）继续生效

---

## 三、五周分解

### Week 1（4/28 – 5/4）— 开源前置卫生 + 云端最小集 + 解禁前置

**Track A（开源）：**
1. 已落地：`LICENSE`、`NOTICE`、`package.json` 加 `"license": "Apache-2.0"`
2. 起草 `CONTRIBUTING.md`（含 AGENTS.md §10 验证链）、`SECURITY.md`（受控试点姿态 + 漏洞披露邮箱）、`CODE_OF_CONDUCT.md`（Contributor Covenant 模板）、`CHANGELOG.md`
3. README 重写：当前 244K 文件改名为 `docs/HELM_INTERNAL_FREEZE_REFERENCE.md`；新 `README.md` 控制在 300 行以内（What / Demo / Quick Start / 当前能做 vs 刻意不做 / 路线图 / 贡献）

**Track B（云端最小集）：**
4. `.env.example` 分层：`MUST` / `OPTIONAL_AI` / `OPTIONAL_CONNECTORS` 三档，并在 `scripts/validate-env.ts` 实现分级校验
5. 写 `docker-compose.yml`：`mysql:8.4 + app + 可选 redis`，目标 `git clone && docker compose up && open http://localhost:3000` 可见 `/mobile`

**解禁前置：**
6. 起草 `docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md` 中英双版（当前为目标草案；法务最终确认前不作为 public commitment）
7. 起草 `docs/reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md`（已起草，见 reviews/）
8. **5 角色 Required Reviewer 候选名单起草**（最大瓶颈）
9. 在 dev / staging MySQL 上跑 `scripts/business-advancement-phase3p-redacted-snapshot-collector.ts`，输出首批 `phase3p_redacted_snapshot.json`
10. 跑 Phase 3O calibration evaluator，看 TPQR-001/003/004 三类 signal 命中率、排序稳定性、boundary 违规计数

### Week 2（5/5 – 5/11）— 租户隔离 + Adapter 实现

11. **租户名脱敏**：`git grep -l "guangpu\|midun\|zhaojiling\|aicaitest"` 完整盘点；共享层引用抽到 `lib/extensions/registry.ts`
12. **私有仓库准备**：`git subtree split --prefix=extensions/guangpu` + `app/api/extensions/guangpu` 输出到新分支，push 到 `helm-tenants-private`
13. 演示数据 seed 重做：`prisma/seed.demo.ts` 用纯虚构数据（Acme Corp / Globex / Initech），用 `SEED_PROFILE=demo|tenant-internal` 切换
14. **Phase 3 thin read-model adapter 实现**：`features/business-advancement/runtime/thin-read-model-adapter.ts` 把 TPQR-001/003/004 deterministic ranking 接到 `data/queries.ts`
15. **Feature flag 接入**：`lib/feature-flags.ts` 新增 `BUSINESS_ADVANCEMENT_RUNTIME_ENABLED` 与 `BUSINESS_ADVANCEMENT_RUNTIME_ALLOWLIST`，默认 false / 空 allowlist
16. **关键 invariant 守卫**：persisted `Commitment.overdueFlag` 列只能作为 candidate 输入，违反时 throw + audit
17. **AdvancementJudgement.evidenceChain 落库**：复用现有 `AuditEvent.metadata` JSON 字段，无 schema 改动

### Week 3（5/12 – 5/18）— 路线图重述 + `/mobile` 接入 + 数据保留落地

18. 重写 Business Advancement 公开叙述：内部 freeze 报告打包到 `docs/internal/freeze/`，对外只暴露 `docs/roadmap/HELM_PUBLIC_ROADMAP.md`（Now / Next 30 days / Later / Out of scope）
19. 收掉 MySQL 1020 concurrency warning（dailyUsageSnapshot / recommendationLog / membership）
20. **`/mobile` 第一屏 Must Push 切换数据源**：从 read-first 压缩切换到 adapter 输出，feature flag 控制
21. **Ask Helm asset capture 落地**：按 Phase 3 Slice 1-5 合约写入 `MemoryCandidate / SkillSuggestion`，review-first
22. **第二次 Required Reviewer 评审**：5 角色基于 Week 1-2 的 implementation evidence + redacted calibration 结果出条件 approval
23. 数据保留状态展示：`settings/billing` 加「数据保留状态」卡片 + 自助导出按钮（不新增 retention sweep cron / API；阶段转换由 `lib/billing/foundation.ts` 在请求路径派生）
24. 邮件提醒模板：阶段转换前 7 天 / 1 天通过阿里云 DirectMail 通知 workspace owner

### Week 4（5/19 – 5/25）— 云端部署 + 灰度演练 + Trial 流程

25. **云端目标已锁定**（release readiness correction §一 #3）：阿里云 cn-hangzhou 全栈 — RDS MySQL / ECS / OSS / SLS / DirectMail 默认启用；OpenAI API 默认关闭，启用前显式 banner + 二次同意；支付能力 public trial 默认关闭
26. 公开试用注册流：`/setup?onboarding=trial` 加数据政策同意 checkbox；OPENAI_API_KEY 留空时 Ask Helm 给出 deterministic placeholder + banner
27. `docs/pilot/PUBLIC_TRIAL_RUNBOOK.md`：试用须知、数据隔离声明、反馈渠道、可期望演进节奏
28. **内部 dogfooding**：Helm 团队 reserved tenant workspace 打开 flag，跑一周看 Must Push 命中率
29. **回滚演练**：故意触发 invariant violation，验证 adapter 降级到 read-first
30. **Pilot allowlist 准备**：选 1-2 个早期用户作为云端试用首批解禁对象
31. 删除证明邮件模板：阿里云 DirectMail 模板 + 内部 5 年 audit 存档；不新增 `/api/legal/deletion-attestation` 路由（保守可发布路径）

### Week 5（5/26 – 5/31）— 安全收尾 + 公开发布

32. 跑 `/security-review` + `npm audit` + `gh dependabot`，处理 P0/P1
33. 完成 release reality hard gates：RDS 凭据轮换 + history remediation、on-call / response policy owner approval、公开承诺降级、audit trace public posture = `claim_withdrawn` 或 `visualization_ready`
34. **第三次（最终）Required Reviewer 评审**：approve `BUSINESS_ADVANCEMENT_RUNTIME_ENABLED=true` 进入 allowlist
35. 跑 AGENTS.md §10 完整验证链一次，作为 `v0.1.0-trial` release evidence
36. 端到端 retention 演练（按生效数据政策模拟 active → grace → 物理删除 → 收到删除证明邮件）
37. **公开镜像验证**：剥离 guangpu 后所有 typecheck / test / build / e2e 仍全绿
38. **公开发布**：GitHub repo public + 试用注册页 + launch post（中英双版）+ 90 秒 Mobile Command Surface 演示视频
39. 观测看板：`must_push_quality_daily_report`（top-5 命中率、deterministic ordering 稳定性、boundary 违规计数、rollback 触发计数）

---

## 四、五月度量目标

### 4.1 产品判断质量（继承 [HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md](./HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md) §6.1）

1. Must Push 命中率：top 3-5 与人工挑选「今天必须推进」重合率不下降
2. 解释链完整率 = 100%（每个 Must Push 含 evidence / reason / boundary / primary action / review entry point）
3. 排序 deterministic 不变（输入反转下 ordering 一致）
4. Ask Helm 收口率不下降，多轮聊天历史持久化 = 0
5. `/mobile` 第一屏可达性：review-first 状态下可打开

### 4.2 边界与治理

1. recommendation / commitment A-minus 边界稳定：customer-facing wording 漂移检查无新增违规
2. workspace-first / membership-backed / capability-aware 校验通过
3. Phase 3 runtime adoption 在 5 角色 approval 完成 + redacted calibration 通过前不打开 flag
4. MySQL 1020 收敛
5. 验证链全绿一次性通过

### 4.3 五月新增度量

1. 公开仓库 5 步起服务命中率（外部读者实际执行）
2. 数据保留 cron 端到端跑通一次（含模拟时间快进）
3. 公开试用首批 1-2 个外部 workspace 的 D1 / D7 留存
4. v0.1.0-trial release 含完整 AGENTS.md §10 验证链 evidence

---

## 五、No-Go 触发条件（任意一条触发 → 立即停下，不发布）

继承 [HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md](./HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md) §七 全部条款，并在五月窗口额外补：

1. Redacted calibration 证据无法在 Week 1 末获得 → Phase 3 runtime adoption 推迟，但开源 + 云端试用仍可发布（仅 Must Push 退回 read-first 压缩）
2. 5 角色 Required Reviewer approval 或 OPC founder decision packet 对应的 independent review 要求在 Week 5 仍未齐备 → runtime adoption 推迟
3. Adapter invariant violation 在 Week 4 dogfooding 期间 ≥ 1 次 → runtime adoption 推迟
4. MySQL 1020 trace 在新增 audit write 后回归 → runtime adoption 推迟
5. 任何 PR 在解禁过程中越界改 schema / 引入 official write / 自动外发 → 整轮回滚
6. `extensions/guangpu/` 在公开仓库镜像中残留任何引用 → 不发布开源
7. 公开试用 ToS / 数据政策未与法务 / 安全团队对齐 → 不开放注册
8. License 字段 / NOTICE / 第三方 license 兼容性未审计 → 不发布开源
9. RDS 凭据轮换、secret-history remediation、on-call / response policy、audit trace public posture 任一 release hard gate 未确认 → 不发布公开试点

---

## 六、Go/No-Go Evidence Checklist（5-31 发布日决策门）

> **意图**：把发布日"两件事"（§一）从启发式判断升级为可证伪的 evidence checklist。
> **规则**：6 项**必备证据**，任一缺失 = No-Go。每项必须有可点击的 evidence artifact 或可重跑的命令链。
> **来源**：T010 派生自 [`HELM_COMPREHENSIVE_PROJECT_REVIEW_2026-05-19.md`](../internal/HELM_COMPREHENSIVE_PROJECT_REVIEW_2026-05-19.md) §四 #10。
> **与 §二 / §五 的关系**：本节是发布日 Go 决策的**操作清单**；§二 是决策依赖的**输入约束**；§五 是触发回滚的**否决条件**。三者不冲突。

### 6.1 必备 evidence 6 项

每项格式：`evidence`（要求的产物） + `verify`（验证命令 / 链接） + `pass-criteria`（通过判定） + `artifact-location`（落盘位置）。

#### 1. RDS 凭据轮换 + Aliyun 侧 revoked 证明

- **evidence**：旋转 receipt id（轮换工单号或自动 receipt JSON）+ Aliyun 控制台 RAM / RDS access key 状态 = `Inactive` 截图或 API readback。
- **verify**：
  - Receipt id 存在并可在 `docs/internal/release-runbook-logs/` 检索到
  - Aliyun 端 access key 列表显示对应 key `LastUsedDate` 早于轮换 receipt 时间且 `Status = Inactive`
- **pass-criteria**：receipt id + Aliyun readback 两份证据齐 → ✓
- **artifact-location**：`docs/internal/release-runbook-logs/credential-rotation-<receipt-id>.json`

#### 2. Secret history remediation 完整

- **evidence**：post-rewrite 仓库扫描结果：所有历史泄露 secret 已无法回溯。
- **verify**：
  - `npm run check:secret-history` → PASS
  - `git log -S '<known-leaked-secret-prefix>' --all` → 0 hits（针对 internal SECURITY-known leaked prefix list）
  - `git for-each-ref --format='%(refname)' | xargs -I {} git rev-list {} | git cat-file --batch-check='%(objectname) %(objecttype) %(objectsize)' --batch-all-objects | grep -c blob` 对比 rewrite 前后 object count 减少（rewrite happened）
  - `curl -s -o /dev/null -w "%{http_code}" https://api.github.com/repos/<org>/<repo>/commits/<old-pre-rewrite-sha>` → `404` 或 `422`
- **pass-criteria**：4 项检查全 ✓ → ✓
- **artifact-location**：`docs/internal/release-runbook-logs/secret-history-rewrite-<receipt-id>.json` + script `scripts/secret-history-check.ts` stdout 归档

#### 3. Public mirror clean receipt + release:check 全绿

- **evidence**：mirror-clean receipt id + clean-receipt:check PASS + release:check PASS 三个原子证据。
- **verify**：
  - `npm run public-mirror:clean-receipt` → 产出 `docs/operations/release-readiness-receipts/public-mirror-<date>-<sha>.json`
  - `npm run public-mirror:clean-receipt:check` → PASS（消费上面的 receipt）
  - `npm run release:check` → PASS（消费上面 receipt + RDS rotation + secret-history）
- **pass-criteria**：三命令均 exit 0 + receipt JSON 落盘 → ✓
- **artifact-location**：`docs/operations/release-readiness-receipts/public-mirror-<release-date>-<release-sha>.json`

#### 4. Public surface 一致性签字

- **evidence**：公开镜像出口处所有面向交付工程师的文档口径与 1-pager 一致；旧 SaaS sales 残留已 archive 或 internalize。
- **verify**（人工 + 命令组合）：
  - `npm run check:public-release` → PASS（自动卫生）
  - `npm run check:boundaries` → PASS（含 tenant slug + decision-first + extension boundary）
  - Owner 逐项签字 6 条：
    - `README.md` / `README.en.md` 已对齐交付工程师 GTM（差异表 / 30 分钟 onboarding / Phase 2 fixture banner）
    - `LICENSE` = Apache-2.0；`NOTICE` 列出第三方
    - `GOVERNANCE.md` / `CONTRIBUTING.md` / `SECURITY.md` 受控试点姿态明确
    - `docs/sales/HELM_CHINA_*` 已按 T004 决议处置（archived / internalized / 重写对齐）
    - `docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md` 是入口 1-pager
    - `extensions/case-management-sample/` 在公开镜像存在并可 fork
- **pass-criteria**：自动卫生 ✓ + 6 条人工签字齐 → ✓
- **artifact-location**：`docs/internal/release-runbook-logs/public-surface-signoff-<release-date>.md`（owner 当面签）

#### 5. Release rehearsal 全清单 PASS

- **evidence**：T011 release rehearsal 跑过一次 §三 Week 5 §35 全验证链；fallback evidence 完整或全 PASS。
- **verify**（命令链）：
  - `npm run db:reset` → 成功
  - `npm run self-check` → PASS
  - `npm run check:boundaries` → PASS
  - `npm run check:public-release` → PASS
  - `npm run typecheck` → PASS
  - `npm run lint` → PASS
  - `npm run test` → PASS
  - `npm run build` → PASS
  - `npm run e2e` → PASS（或文档化失败的具体 fallback evidence）
  - `npm run quality:regression` → PASS
- **pass-criteria**：10 命令全 PASS，或缺失项有书面 fallback evidence → ✓
- **artifact-location**：`docs/internal/release-runbook-logs/rehearsal-<date>.md`

#### 6. Backup owner 5-31 当天可用确认

- **evidence**：T002 指定的 backup owner 书面确认 5-31 当天可达 + 应急联系方式生效。
- **verify**：
  - Backup owner 姓名 / 联系方式写入 release plan
  - 当天前 24h 内 backup owner 书面（邮件 / IM 截图）确认在线
  - 演练记录：backup owner 已实操过至少一次 `npm run release:check` + `npm run check:public-release` + `npm run check:boundaries`
- **pass-criteria**：3 项齐 → ✓
- **artifact-location**：`docs/internal/release-runbook-logs/backup-owner-availability-<release-date>.md`

### 6.2 Go 决策记录格式

发布日上午 11:00 UTC+8 owner 填写并归档到 `docs/internal/release-runbook-logs/go-decision-<release-date>.md`：

```markdown
# Release Go Decision — <YYYY-MM-DD>

| # | Evidence | Status | Artifact |
|---|----------|--------|----------|
| 1 | RDS rotation + Aliyun revoked  | ✓ / ✗ | credential-rotation-<receipt-id>.json |
| 2 | Secret history remediation     | ✓ / ✗ | secret-history-rewrite-<receipt-id>.json |
| 3 | Mirror clean + release:check   | ✓ / ✗ | public-mirror-<date>-<sha>.json |
| 4 | Public surface 一致性签字       | ✓ / ✗ | public-surface-signoff-<date>.md |
| 5 | Rehearsal 全清单 PASS          | ✓ / ✗ | rehearsal-<date>.md |
| 6 | Backup owner 5-31 可用确认      | ✓ / ✗ | backup-owner-availability-<date>.md |

Decision: **Go** / **No-Go**
Decided by: <owner-name>
Decided at: <ISO-timestamp>
Notes (any No-Go reason): ...
```

任一行 ✗ → Decision 必须为 No-Go，并附补救 PR / 推迟日期。

### 6.3 与历史"两件事"启发式的关系

§一 的"两件事"（Track A 开源可读 / Track B 云端可注册）继续是**目标**陈述，但**决策门**完全替换为本节 §6.1 的 6 项 evidence checklist。后续如增减 evidence 项，必须先改本节 + 同步 [`HELM_COMPREHENSIVE_PROJECT_REVIEW_2026-05-19.md`](../internal/HELM_COMPREHENSIVE_PROJECT_REVIEW_2026-05-19.md) §四 #10 出处。

---

## 七、与既有文档的关系

本文件不替代以下文档，只在五月窗口内统一目标与执行节奏：

1. [AGENTS.md](../../AGENTS.md)：仓库执行规范与硬边界（继承）
2. [README.md](../../README.md)：项目整体表达入口（Week 1 重写）
3. [WORKING-CONTEXT.md](../../WORKING-CONTEXT.md)：本轮已同步当前优先级与四项决策
4. [HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md](./HELM_MARKET_POSITIONING_AND_ADVANCEMENT_UPGRADE_V1.md)：市场定位与边界（§5.5 中 runtime adoption 全局禁止条款被本文件 §2.4 部分覆盖）
5. [HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md)：Phase 3 解禁详细范围与回滚剧本
6. [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)：数据保留政策草案与硬删除流程；正式公开口径待法务最终签署
7. [HELM_RELEASE_REALITY_ALIGNMENT.md](./HELM_RELEASE_REALITY_ALIGNMENT.md)：2026-05-02 公开承诺、release hard gates、需求减负与真实缺口收口；如与本计划冲突，以 release reality alignment 的 hard gate 口径为准
8. [HELM_PRIVATE_TENANT_SEPARATION_PLAN_V1.md](../internal/HELM_PRIVATE_TENANT_SEPARATION_PLAN_V1.md)：guangpu 私有化执行计划

如本文件与 [HELM_RELEASE_REALITY_ALIGNMENT.md](./HELM_RELEASE_REALITY_ALIGNMENT.md) 的 release hard gate 口径冲突，以后者为准；其余执行节奏仍以本文件 §三 五周分解为准。
