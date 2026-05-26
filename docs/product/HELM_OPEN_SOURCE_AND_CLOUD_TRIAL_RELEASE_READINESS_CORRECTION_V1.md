---
status: active
owner: helm-core
created: 2026-04-27
review_after: 2026-07-26
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Open Source + Cloud Trial Release Readiness Correction V1

更新时间：2026-04-27
状态：Owner decisions recorded; public-claim posture superseded by HELM_RELEASE_REALITY_ALIGNMENT.md on 2026-05-02
适用范围：[HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md](./HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md)、[HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md)、[HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md) 在五月开源 + 云端公开试用前的发布前置收口
实现状态：决策已拍板；按 §四执行顺序逐步落地，每条独立 PR / 独立 commit

本文件落地 owner 在 2026-04-27 16:16 给出的 5 项关键决策与 Guangpu POC 选择。原始独立核验在前序对话中已完成（6 项 finding 全部 confirmed 或 partially confirmed）；本文件记录决策与执行路径，作为发布冻结依据。

---

## 一、Owner 决策（2026-04-27 16:16）

走**保守可发布路径**：不做 schema 扩张，不做默认外部写入，不把 Guangpu 混入公开通用层。

| # | 项 | 拍板 | 直接影响 |
|---|---|---|---|
| 1 | Retention | **A = 30/7 target draft**：30 天可用 + 7 天删除缓冲作为目标草案；不走 90/30/7 | trial data policy §2.1 / §六 checkbox 改写；launch plan §2.3 同步收口；不新增 schema enum；不新增 retention sweep cron / deletion attestation API；2026-05-02 起对外公开承诺以工作区契约和法务生效政策为准 |
| 2 | Memory/Skill 命名 | **A = docs rename**：不新建 `MemoryWritebackCandidate / SkillSuggestionCandidate` schema | docs-wide rename：`MemoryWritebackCandidate → MemoryCandidate`，`SkillSuggestionCandidate → SkillSuggestion`；Phase 3 review §1.2 #3 schema 扩张禁令继续 100% 生效 |
| 3 | Cloud target / sub-processors | **中国区优先：阿里云 cn-hangzhou** | trial data policy §五填实名 |
| 4 | Public release guard | **独立脚本**：`scripts/public-release-guard.ts` + `npm run check:public-release` | 不混进 `check:boundaries` 主链；作为公开镜像 / tag 前置硬门禁 |
| 5 | Tenant slug boundary check | **必须做** | `scripts/decision-first-boundary-check.ts` 反向阻断：`guangpu / midun / zhaojiling / aicaitest` 不得进入 shared `app/`、`features/`、`lib/`（除 `lib/extensions/`）、公开 docs、`.env.example` |

### 1.1 Sub-processor 实名列表（决策 #3）

| 类目 | 实名 | 启用姿态 |
|---|---|---|
| 数据库 | 阿里云 RDS MySQL（cn-hangzhou） | 默认启用 |
| 应用托管 | 阿里云 ECS（cn-hangzhou） | 默认启用 |
| 对象存储 | 阿里云 OSS（cn-hangzhou） | 默认启用 |
| 日志 | 阿里云 SLS（cn-hangzhou） | 默认启用 |
| 邮件 | 阿里云 DirectMail / 企业邮箱 | 默认启用 |
| LLM | OpenAI API | **默认关闭**；启用前在 UI 与政策中显式披露 |
| 支付 | Stripe / Alipay / WeChat Pay | **public trial 默认关闭**；上线商用版前不启用 |

跨境数据传输：因数据驻留 cn-hangzhou，public trial 默认无跨境传输；启用 OpenAI 时需显式 banner + consent 记录。

### 1.2 Guangpu POC 拍板

| 项 | 拍板 |
|---|---|
| Tenant scope | tenant-specific |
| tenant-key | `guangpu` |
| resource-key | `management-report-metric-anomaly` |
| Source | 优先复用现有 `extensions/guangpu/bi-report/report-skills/bi_repay_daily` |
| Source posture | QuickBI 导出 SQL / ODPS-backed BI report，只读 |
| Workspace scope | Guangpu 单 workspace；不允许跨 workspace 聚合 |
| Authority | review-only；不写 DB、不写外部系统、不进 production Must Push |
| Freshness | daily / T+1；超过 36 小时视为 stale |
| Failure | stale / missing evidence / 字段缺失 / 口径冲突 → rejected 或 watch-only；不产出行动建议 |
| Sample | 真实样例必须脱敏；不得伪造 provenance；无脱敏样例前只能 synthetic / contract dry-run，不算 Phase 0 Go |

详细 intake 计划与 8 类禁止保留字段见 [HELM_EXTERNAL_RESOURCE_KIT_GUANGPU_POC_INTAKE_PLAN_V1.md](../internal/HELM_EXTERNAL_RESOURCE_KIT_GUANGPU_POC_INTAKE_PLAN_V1.md)（internal-only）。

---

## 二、Finding 收口（基于决策 §一）

按前序独立核验的 6 项 finding + 1 附录，记录在决策下的具体收口动作与状态。

| # | Finding | 决策路径 | 执行项 | 状态 |
|---|---|---|---|---|
| 1 | 公共开源镜像残留私有 slug + internal docs | §一 #4 + #5 | `scripts/public-release-guard.ts`（独立 npm 命令）+ `decision-first-boundary-check.ts` 反向阻断；公开镜像生成时拆 `docs/internal/`、剥离 `extensions/guangpu/`、`app/api/extensions/guangpu/` | §四 Step 5 |
| 2 | Retention 90/30/7 vs 代码 30/7、无 `pending_deletion` | §一 #1 = A target draft | trial data policy §2.1 / §2.3 / §六 改 30/7；launch plan §2.3 同步；不改 schema；不新增 cron / API；正式公开承诺等法务签署 | §四 Step 3 |
| 3 | Phase 3p 脚本名漏前缀 | 独立机械修正 | launch plan line 79 + Phase 3 review line 119 已改正 | **已完成**（commit `4fed8625c`） |
| 4 | `MemoryWritebackCandidate / SkillSuggestionCandidate` 是幻名 | §一 #2 = A | docs-wide rename：`MemoryWritebackCandidate → MemoryCandidate`，`SkillSuggestionCandidate → SkillSuggestion`；7 份产品文档 + Phase 3 review | §四 Step 4 |
| 5 | 开源基础文件缺失（`CONTRIBUTING.md / SECURITY.md / CODE_OF_CONDUCT.md / CHANGELOG.md`）；`package.json` 仍 `"private": true` | 保持 `private: true`（仅源码公开，不发 npm） | 4 份开源基础文件单独 PR 起草；launch plan §三 Week 1 #2 已规划，作为 §一 #4 公开镜像 ready 的一部分前置 | 待 §四 Step 5 同时落 |
| 6 | 云端法律前置 TBD vs consent checkbox 已写死 90/30/7 | §一 #1 + #3 联动 | trial data policy §2.1 + §六 改 30/7 target draft + sub-processor 实名；Step 3 + 法务最终确认后 `/setup?onboarding=trial` 才允许在 production 启用 | §四 Step 3 |
| 附 | `check:public-release` guard 缺位 | §一 #4 = 独立脚本 | `scripts/public-release-guard.ts` + `npm run check:public-release` | §四 Step 5 |

---

## 三、Frozen state（自决策记录起生效）

下列状态在本文件的 §四 Step 1-6 全部 commit / push 前继续生效；任意 PR 触犯立即视为越权：

1. **不改 `prisma/schema.prisma`**（决策 §一 #1 / #2 已禁止 schema 扩张）
2. **不新增 `MemoryWritebackCandidate / SkillSuggestionCandidate / ActionIntent` 等同名 model**（§一 #2）
3. **不在 shared `app/`、`features/`、`lib/`（除 `lib/extensions/`）、`data/`、`scripts/`、公开 docs、`.env.example` 中引入 hardcoded tenant slug**（§一 #5）
4. **不把 Guangpu 数据 / SQL / 字段 / 凭据 / 内部 endpoint / 路径写入 `external-resource-kit/` 或公开主线**（§一.2）
5. **`/setup?onboarding=trial` 在 production 不可启用**（依赖 §四 Step 3 完成）
6. **公开镜像 / tag 不可在 `npm run check:public-release` 通过前发布**（依赖 §四 Step 5 完成）
7. **OpenAI API、Stripe、Alipay、WeChat Pay 在 public trial 不默认启用**（§一.1 sub-processor 表）

---

## 四、执行顺序（owner 拍定）

| Step | 动作 | 状态 |
|---|---|---|
| 1 | C.2 脚本名修正（finding 3） | **已完成** `4fed8625c` |
| 2 | 新增本 release readiness correction 决策文档 | **本 PR** |
| 3 | 更新 trial data policy：90/30/7 → 30/7，sub-processors 改成实名列表；同步 launch plan §2.3 | 进行中 |
| 4 | Memory/Skill docs rename（7 份文档） | 待 |
| 5 | 新增 `scripts/public-release-guard.ts` + `npm run check:public-release`；扩展 `decision-first-boundary-check.ts` 反向阻断；同步 4 份开源基础文件 | 待 |
| 6 | 启动 dry-run evaluator scaffold（external-resource-kit/ 通用层，无 Guangpu 数据） | 待 |

每条 step 一条独立 commit；中间触发 `npm run typecheck / lint / check:boundaries / test / build` 按影响面验证。

---

## 五、与既有文档的关系

1. [HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md](./HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md)：Step 3 同步收口 §2.3；§三 Week 1 #2、Week 3 #21、Week 4 #25-#26、Week 5 #35 在本文件 §四 完成后再视为可执行
2. [HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md](../reviews/HELM_BUSINESS_ADVANCEMENT_PHASE3_RUNTIME_ENABLEMENT_REVIEW_V1.md)：决策 §一 #2 选 A 后，§1.2 #3 schema 扩张禁令 100% 生效；§2.6 #6 boundary regression test 由本文件 §一 #5 在 Step 5 落地
3. [HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md](../legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md)：Step 3 由 90/30/7 改 30/7、§五 sub-processor 填实名；2026-05-02 起该文档保持 target draft，法务最终签署前不进入 public-eligible commitment 状态
4. [HELM_EXTERNAL_RESOURCE_SIGNAL_INTEGRATION_METHOD_V1.md](./HELM_EXTERNAL_RESOURCE_SIGNAL_INTEGRATION_METHOD_V1.md)：§4.7 概念合约表与决策 §一 #2 命名路径 A 一致；进入 Phase 1 时按本文件 Step 4 命名收口为准
5. [HELM_EXTERNAL_RESOURCE_KIT_GUANGPU_POC_INTAKE_PLAN_V1.md](../internal/HELM_EXTERNAL_RESOURCE_KIT_GUANGPU_POC_INTAKE_PLAN_V1.md)：本文件 §一.2 与该 intake plan 的解冻条件协同；owner sign-off + 脱敏样例齐备前不创建 `extensions/guangpu/management-report-metric-anomaly/`
6. [HELM_PRIVATE_TENANT_SEPARATION_PLAN_V1.md](../internal/HELM_PRIVATE_TENANT_SEPARATION_PLAN_V1.md)：决策 §一 #4 + #5 的执行细节继承该计划
7. [AGENTS.md](../../AGENTS.md) §10：`check:public-release` 暂不并入 §10 主链；六月窗口再视情况合并
