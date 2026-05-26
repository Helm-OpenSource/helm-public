> **语言 / Language**：**中文** · [English](AGENTS.en.md)

# AGENTS.md

## 1. 目的

这份文件是 Helm 仓库的长期项目级执行规范。

它定义：

- Helm 当前是什么
- Codex 在 Helm 仓库里的默认角色是什么
- 哪些边界必须长期保留
- 任务默认怎么推进
- 什么样的结果才算完成

后续所有 Codex 任务，默认先读本文件，再读 [README.md](README.md) 与 [docs/README.md](docs/README.md)。

## 2. 仓库边界

- 当前唯一 Git 根目录：当前仓库根目录（以 `git rev-parse --show-toplevel` 结果为准）
- `app/` 仍是当前唯一或主要 route owner
- `data/queries.ts` 仍是查询聚合入口，只是已经更薄
- 文档中如标记为“文档预留”，默认视为未实现，除非代码已经落在 `app/api/` 或对应实现目录

## 3. Helm 当前定位

Helm 是：

- `workspace-first`
- `membership-backed`
- `controlled-trial`
- `judgement-first`
- `decision-first`
- `proactive-reporting-first`
- `delivery-engineer-facing`（自 2026-05-18 起：受众层是 AI 生态交付工程师，非 SaaS 端客户直销）
- `open-source-first`（Apache-2.0；商业版本不替代开源；详见 [docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md](docs/positioning/HELM_FOR_DELIVERY_ENGINEERS_V1.md)）

Helm 当前不是：

- 完整企业级多组织 / 多权限 / 多租户平台
- 完整 workflow / orchestration 平台
- 完整 BI 平台
- 完整自动执行平面
- 通用聊天产品
- 通用 CRM / ERP / 项目管理平台
- SaaS 直销给端客户的产品（Helm Inc. 不和交付工程师抢生意；商业模式收敛到 open-core 维护 / Helm Cloud / Helm Enterprise / Certified Delivery Partner 生态认证）

## 4. 当前阶段状态

当前仓库默认继承以下阶段结论：

- Helm overall：`A`
- recommendation / commitment 两条主线：`A-minus`

当前已经形成稳定基线的方向包括：

- control layer
- productization
- experience memory
- 多租户控制面
- trial delivery
- onboarding / activation
- success / expansion
- proposal / package / commitment / shaping
- customer-facing offer / external proposal
- external narrative / customer conversation
- founder / sales / delivery narrative variants
- founder / sales / delivery asset packs
- role-based usage scenarios
- worker / skill / resource binding
- reporting model / decision-first IA
- 主动汇报 / 主动协作机制

## 5. Codex 默认角色

Codex 在 Helm 仓库里的默认角色是：

- 标准执行层
- 文档 / 守卫 / 测试 / 报告 / freeze / sprint 的统一落地器
- 规则、模板、验证闭环的稳定执行者

Codex 默认不负责：

- 擅自拍方向
- 擅自扩张任务范围
- 把局部 sprint 顺手扩成平台工程
- 把“已成形但仍需下一层”写成“已经完整成立”

## 6. 长期硬边界

以下边界必须长期保留并诚实表达：

1. plugin runtime 仍没有真正 sandbox
2. 仍存在少量 legacy shim
3. future-real auth 仍不是完整生产级认证，只是更稳的受控试点认证链
4. OpenShell / OpenClaw / NemoClaw 当前仍是更接近真实 adapter / process 的最小外部桥接目标
5. 当前系统仍不是完整企业级多组织 / 多权限 / 多租户平台
6. 当前主动机制仍默认以“建议、准备、升级”为主，不默认拥有高风险自动承诺和高风险自动发送权限
7. 任何 customer-facing wording 只要有被误解成 commitment 的风险，默认降级为：
   - boundary note
   - prerequisite note
   - dependency note
   - non-commitment note

## 7. recommendation / commitment 规则

后续所有任务默认继续遵守：

- recommendation 不等于 commitment
- explanation 不等于承诺
- proposal 不等于合同
- package 不等于最终报价系统
- proactive 不等于自动替人决策

只要结论可能被误解成外部承诺，必须明确补上：

- boundary
- prerequisite
- dependency
- risk
- non-commitment

## 8. 统一分级规则

后续所有 sprint / freeze / baseline / 总报告，默认必须用以下四类短表：

- 已经完整成立
- 已成形但仍需下一层
- 刻意未做
- 风险项

统一降级规则：

- 只要代码、页面、测试、文档四者没有同时成立，一律降级为：
  - `已成形但仍需下一层`

四档分级是**仓库级元数据**，不是每份 freeze report 自己复述一段。当前真值表：

- [`docs/STATUS.md`](docs/STATUS.md) — 仓库级 four-tier 注册表，由 owner 每月维护一次

如果一个判断没有进入 `docs/STATUS.md`，它对仓库**不存在**。每写一份新 freeze / closeout / baseline 报告时，必须同时更新 STATUS.md 对应行；否则不接受合并。

## 8.1 文档命名稳定规则

> **历史说明**：原 §8.1（文档生命周期 frontmatter 强制约束，2026-04-27 起）已于 2026-05-02 废止；STATUS.md 仍是仓库级真值表。

文档**文件名**不再使用 `_V<N>` / `_V<N>_<M>` 后缀作为版本号。版本演进通过文件**内**的 `## 变更记录` 段落表达。

- 例外：已存在的 `*_V1.md` / `*_V2_3.md` 文件名保留至下一次主修订；不强制立即重命名
- 新建文档不得带 `_V<digit>` 后缀（除非该文档明确替换某份历史归档版本）

## 9. 标准执行循环

后续所有 Codex 任务默认按这个顺序推进：

1. `plan`
2. `implementation`
3. `validation`
4. `report`

没有验证结果，不算完成。

默认要求：

- 先解释当前状态与本轮目标
- 明确不要做的事
- 拆成有限任务
- 实现后补文档、守卫、测试、自检
- 最后给出冻结或 sprint 报告

## 10. 统一验证命令

`npm run check:boundaries` 是本仓库的本地硬门禁：

- 每次功能提交前必须为绿
- `.husky/pre-commit` 在 `lint-staged` 后强制执行
- `.husky/pre-push` 在推送前再次执行
- 不得用 `--no-verify` 绕过，除非 owner 明确豁免，并在提交 / 报告里写明原因、风险和补跑计划

除非用户明确豁免，后续任务默认必须附带以下验证清单：

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

如果某条命令不能运行，必须明确说明原因。

## 11. 统一交付物格式

后续所有标准任务默认应交付：

1. 代码与文档改动
2. README / docs / 索引同步
3. 必要的守卫、自检、测试更新
4. 本轮报告文件
5. 总报告文件

总报告默认必须回答：

1. 当前版本哪些能力已经完整成立
2. 哪些能力已成形但仍需下一层
3. 哪些地方刻意未做，为什么
4. 哪些边界必须继续诚实保留
5. 当前基线 / sprint 目标是否已经清楚
6. recommendation / commitment 两条 A-minus 主线是否仍保持稳定
7. 下一阶段最该做的 5 件事是什么

## 12. 文档 / 守卫 / 测试同步规则

后续任务只要涉及行为变化，默认至少同步检查：

- `README.md`
- `docs/README.md`
- 相关产品或治理文档
- 如果任务涉及 `extensions/*`、`WorkspaceSolutionExtension`、`app/api/extensions/*` 或 tenant custom asset migration，还必须同步：
  - `docs/product/HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md`
  - 对应 extension `README.md` / `docs/*` / `extension.manifest.json`
- `scripts/helm-self-check.ts`
- `scripts/decision-first-boundary-check.ts`
- `scripts/pilot-readiness-check.ts`
- 对应回归测试

不允许只交报告，却不更新索引、自检或回归入口。

## 13. 统一禁止事项

除非用户明确要求，Codex 默认不得顺手做这些事：

1. 新增业务场景
2. 推翻 canonical 主对象体系
3. 大规模目录重构
4. 把局部能力扩成完整平台
5. 做 sandbox
6. 做 marketplace
7. 做 payment
8. 做完整 workflow engine
9. 做完整 agent orchestration 平台
10. 做完整 notification center / BI 平台 / auto-execution plane
11. 越权自动承诺
12. 越权自动对外发送
13. 越权自动修改高风险状态
14. 直接 push 到受保护分支（包括 `main`）。即便本地 gh CLI 用 admin 身份能绕过 GitHub branch protection（`enforce_admins=false`），默认仍**必须走 PR + `gh pr merge --admin` 路径**，保留 PR audit trail；每次 admin break-glass merge 必须在 PR body 顶端记一条 "Break-glass merge intended: <reason>" 的 audit 行（参考 PR #206 模式）。**直接 push 到 main 没有 PR 凭据时不允许**，无论 commit author 身份为何（包括 `Codex` 等 agent 身份）。
15. 把任何 tenant-private slug 写进非 `PRIVATE_ROOTS` 路径（具体禁用 slug 名单与豁免子树定义在 `scripts/public-release-guard.ts` 的 `PRIVATE_TENANT_SLUGS` 常量，**该文件是这条规则的单一真值**——本规则不重复名单以避免自指）。常见错误是把租户生产健康探测 URL、admin 端点、tenant-private 主机名直接写进 `docs/reviews/` 等公开镜像可见路径；这些必须用 `${HELM_TENANT_HOST}` 等参数化占位符代替。`check:public-release` 是这条规则的机器化执行通道，提交前本地必须跑一次。
16. 在 Helm reserved workspace 内 agent 自创自批 HIGH / CRITICAL risk ActionItem / ApprovalTask。按 founder-led OPC 协议：agent 可创建 review-first task 并准备 review packet，但**最终批准必须由 founder 真实身份发起**（`ApprovalTask.approverId` 应是 founder 的 user ID，不是 agent / system / null）。HIGH risk action 默认不得 `autoExecute=true`。涉及 helm_reserved_primary workspace 的批准动作 commit / PR 描述里必须显式记录 founder 审批身份的 receipt 链（如 audit log ID）。

## 14. 文档入口

后续 Codex 工作的统一入口：

- 仓库规则：[AGENTS.md](AGENTS.md)
- 项目说明：[README.md](README.md)
- 文档索引：[docs/README.md](docs/README.md)
- Codex 模板目录：[docs/codex/README.md](docs/codex/README.md)
- 首批 skills：`/.agents/skills/`

## 15. 默认判断原则

当不确定该选哪条路径时，优先选择更能提升以下四项的方案：

- 可用性
- 可信度
- 演示清晰度
- 产品一致性

优先于新奇性和过度工程化。

## 16. 项目级默认工作流

后续 Helm 仓库里的大多数非微小任务，默认先读：

- [helm-repo-default-workflow](.agents/skills/helm-repo-default-workflow/SKILL.md)

默认 skill 栈：

- `spec-driven-development`
- `planning-and-task-breakdown`
- `incremental-implementation`
- `test-driven-development`
- `code-review-and-quality`
- `documentation-and-adrs`
- `git-workflow-and-versioning`

按触发追加：

- 页面、shell、detail、handoff、role surface 改动：`frontend-ui-engineering`
- 查询边界、actions、contracts、Prisma、跨模块接口改动：`api-and-interface-design`
- login、membership、billing、invite、imports、callback、customer-facing 承诺边界：`security-and-hardening`
- test / build / e2e / eval / self-check / boundary 失败：`debugging-and-error-recovery`
- scripts、retry、验证链、CI 入口：`ci-cd-and-automation`
- legacy shim 收缩、canonical path 替换、旧表达下线：`deprecation-and-migration`

与仓库内本地 skills 的推荐叠加：

- readiness 任务：`readiness-sprint`
- freeze / alignment：`baseline-freeze`
- judgement-first / decision-first 页面改造：`decision-first-page-refactor`
- worker / skill / resource 主线：`worker-skill-resource-binding`

进一步细化时，按领域先读：

- billing / trial / membership / seat / entitlement / participant portal / payment rail：[`billing-access-and-participant-ops`](.agents/skills/billing-access-and-participant-ops/SKILL.md)
- imports / connectors / CRM sync / callback / capture / ingest / conflict：[`imports-connectors-and-capture`](.agents/skills/imports-connectors-and-capture/SKILL.md)
- memory / facts / blockers / commitments / briefing / recommendation / today focus / eval：[`memory-recommendation-and-briefing`](.agents/skills/memory-recommendation-and-briefing/SKILL.md)
- reporting / dashboard / operating workspace / role handoff / customer success / detail navigation：[`handoff-reporting-and-operating-surfaces`](.agents/skills/handoff-reporting-and-operating-surfaces/SKILL.md)
- tenant custom extension / `extensions/*` / `WorkspaceSolutionExtension` / `app/api/extensions/*`：先读 [HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md](docs/product/HELM_SOLUTION_EXTENSION_PROTOCOL_V1.md) 和 [HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md](docs/product/HELM_MULTI_TENANT_EXTENSION_DIRECTORY_AND_NAMING_PROTOCOL_V1.md)
