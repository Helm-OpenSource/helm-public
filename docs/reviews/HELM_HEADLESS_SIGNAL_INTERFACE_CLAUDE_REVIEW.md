---
status: active
owner: Product / GTM / Delivery Engineering / Engineering
created: 2026-05-20
source_requirement: ../product/HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md
review_mode: claude-read-only-requirements-review + owner-audit
review_after: 2026-08-18
# missing required fields backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-26
---

# Helm Headless Signal Interface Review

## 1. 结论

2026-05-20 对 `HELM_HEADLESS_SIGNAL_INTERFACE_REQUIREMENTS.md` 完成三层评审：

1. Claude 只读需求评审：结论 **Revise**，主要指出 facade 撞型、signal family 未具名、`preparation-only` 不硬、现有 surface 复用关系不明、non-Salesforce source 覆盖不足。
2. Owner audit：结论 **Revise harder**，指出首版和 Claude 修订版仍被 Salesforce 牵引，未站稳 Helm 已确认的 delivery-engineer toolkit / Apache-2.0 forkable / open-core no take-rate / case-management-sample / eval-gate GTM 主线。
3. 二次 owner review：结论 **Go**，确认需求已经从 Salesforce 牵引转回 delivery-engineer toolkit 主轴，可进入 Phase 1 offline contract planning；同时要求轻量收紧 4 周目标措辞、原则命名、D002 / first vertical 优先级、proposed eval 命名和 reviewer 集合区分。

最终处理：requirements 已结构性重写。Salesforce 从主轴降为外部信号之一；HSI 的主叙事改回 Helm 自己的定位：

> Apache-2.0、forkable、open-core 不抽成交付收入、vertical reference implementation、boundary encoded in eval gate、中国本地化、前置条件明确后的约 4 周受控交付目标。

当前状态：**Go to Phase 1 offline contract planning**。不得直接进入 Salesforce adapter、runtime query、hosted MCP、API 或 production connector。

## 2. Claude findings 与处理

| Finding | Claude 风险判断 | 处理 |
|---|---|---|
| Facade 命名与 Data 360 MCP 撞型 | 容易被读成 Salesforce Data 360 MCP 的只读子集 | 已保留 facade 草案但降级到 HSI-03；明确只有 pack contract 和 eval 跑通后才允许定义 facade，不提供 `execute` |
| 首批 signal family 未具名 | `Supported signal families >= 5` 是空指标 | 已锁定 6 个 source-agnostic family：`commitment_missing`、`stage_or_status_stale`、`approval_blocked`、`owner_mismatch`、`duplicate_or_conflict`、`boundary_attempt` |
| `preparation-only` 语义不硬 | 草稿、CRM stage 建议、邮件正文可能被误解为可执行 | 已新增 HSI-04：packet 不得触发 webhook / notification / external write / approval status change，不得作为执行输入 |
| 与现有 `/operating` / review packet 关系不明 | 可能形成第二套模型或 schema/runtime 扩张 | 已声明 Phase 1 facade 草案必须基于现有 `data/`、Signal Flow contract、Ask Helm action packet 和 review-first surfaces 投影，不新增 schema/runtime query |
| `Useful without Salesforce` 与内容失衡 | 可能变成 Salesforce-only 需求 | 已删除 Salesforce 独立 HSI source adapter；原则名改为 `Source-agnostic by default`；Phase 1 reference source 必须至少覆盖一个 non-Salesforce source |

## 3. Owner audit findings 与处理

| Finding | 风险判断 | 处理 |
|---|---|---|
| 差异化标语用对手字典写 | `observable / reviewable` 被 BI / BPM / observability 稀释 | 删除 `Salesforce makes X; Helm makes Y` 标语；改为 Apache-2.0 forkable operating-signal delivery kit |
| §0 没有真正 GTM 差异词 | Apache-2.0、forkable、不抽成、4 周交付、eval gate、中国本地化缺席 | §0 改成 Helm thesis，并把这些词列为不可稀释差异化关键词 |
| 真实竞对缺席 | Coze / 悟空 / Dify / LangGraph / n8n / Camunda / Temporal 才是交付工程师选型对照 | §1 新增 primary competitive frame，以 README / 1-pager 的类型对照为主 |
| 文档单点打 Salesforce | Salesforce 同时被当 source 和对手，身份混乱 | Salesforce 降级为 optional enterprise source adapter + external signal；不是 Phase 1 reference adapter |
| HSI-07 时间线空头 | 30 / 60 分钟和 1 周目标尚无 D2 smoke 证据 | HSI-08 明确当前只是目标，D2 smoke 前不能写成承诺 |
| Pack contract 太空 | 字段无最小 shape、fixture 下限、eval criteria | HSI-01 补 required fields / minimum、fixture 类别和 eval categories |
| agent / CLI / MCP client 并列混乱 | 没说明交付工程师真实工作流 | §5 先定义 fork -> fixture -> eval -> inspect -> iterate -> demo 工作流；CLI / MCP / agent client 降为后续消费形态 |
| contributor 与 Certified DP 混用 | 社区贡献者与付费认证伙伴权限 / 激励不同 | §3 与 HSI-09 拆分 Delivery engineer adopter、Pack contributor、Certified Delivery Partner |
| prepare_review_packet 可能间接执行 | packet 可能被下游当执行输入 | HSI-04 明确 packet 不得触发副作用，不得作为执行 facade 的隐式输入 |
| local-only 边界模糊 | local MCP 可能跑到客户内网或员工机器 | HSI-06 明确 local 只指交付工程师本机 repo checkout；禁止 hosted MCP、tunnel、客户员工常驻 server |
| redacted sample 缺数据保护边界 | redaction 谁做不清楚，可能让 Helm 接触 raw data | HSI-05 明确 redaction owner、manifest、PII scan、data policy、Data Protection review |
| Phase 4 owner 单点 Go/No-Go | 与 runtime adoption 六项硬前置和 5 角色 approval 冲突 | Phase 4 DoD 改为六项硬前置 + 5 角色 Required Reviewer + rollback proof，单点 owner Go/No-Go 不足够 |
| HSI-03 Salesforce 独立编号误导 | 工程量会被牵引到 Salesforce adapter | 删除 Salesforce 独立 HSI source-adapter 主线，改为通用 Source Adapter Posture |
| `eval:headless-signal-interface` 不存在 | DoD 空头 | 明确它是 proposed gate，Phase 1 第一项任务是新增 fixture schema、evaluator 和 package script，不得写成已通过 |

## 4. 二次 review 后的轻量收紧

| 收紧点 | 处理 |
|---|---|
| thesis 里的 4 周可能被误读成 commitment | 改为 D2 smoke、sample pack、eval 和客户数据前置条件明确后，争取约 4 周 |
| 原则名仍带 Salesforce | 改为 `Source-agnostic by default` |
| D002 / first vertical 与 `case-management-sample` 优先级不清 | 明确 owner 确认首个真实 vertical 优先时，该 vertical 成为 first reference pack；`case-management-sample` 退为 generic baseline / comparison pack |
| HSI-07 标题像另一个 gate | 改为 `eval:headless-signal-interface` offline gate（Phase 1 落地后又从 "proposed" 收紧为 "offline"） |
| contributor triage reviewer 与 runtime Required Reviewer 混淆 | 明确前者只服务开源 pack 反馈和合并判断；runtime adoption 仍走 Engineering / Product / Security / Operations / Data Protection 5 角色 |

## 5. 当前 Go / No-Go

当前允许：

1. Phase 1 offline contract planning。
2. 设计 proposed `eval:headless-signal-interface` 或更窄的 `eval:delivery-pack-contract`。
3. 从 owner 确认的 first vertical 或 `case-management-sample` generic baseline 做 fixture / eval 起点，并至少覆盖一个 non-Salesforce source。
4. 起草 local CLI preview 命令，但不得实现 hosted MCP / API / production connector。
5. 对 D002 美业或其他 owner 优先 vertical 做 first reference pack 决策。

当前禁止：

1. Salesforce adapter 优先实现。
2. API route。
3. schema 或 migration。
4. production query adoption。
5. hosted MCP server。
6. Salesforce / HubSpot / IM production credentials。
7. Helm 默认接触客户 raw data。
8. official write、auto-send、auto-approve、silent CRM write。
9. owner 单点放行 runtime adoption。
10. LLM final ranking 或 LLM-controlled state transition。

## 6. Remaining risks

1. D002 美业 vertical 在当前 worktree 中未找到 canonical requirements 文件；如果 owner 已在其他分支确认 D002 优先级，HSI Phase 1 应立即改以该 vertical 为第一 reference pack。
2. ~~`eval:headless-signal-interface` 尚未实现~~ 2026-05-20 Phase 1 offline 脚手架已落地：fixture（2 packs / 6 family / 15 boundary 覆盖 HSI-03 八类 forbidden facade 每类至少一条 / 8 non-scripted）、deterministic evaluator（含 `forbiddenFacadesMissing` 结构性断言）、CLI、`npm run eval:headless-signal-interface`、9 个 vitest contract test 全绿、§7 五项 incident counter 全部 0；仍属 offline 契约证明，Phase 2 local CLI preview / Phase 3 source adapter calibration / Phase 4 runtime adoption 未授权。
3. Fresh-clone / D2 smoke 尚未跑通；30 分钟 onboarding 只能作为目标路径。
4. Salesforce 官方材料仍可作为外部趋势输入，但不得再成为 HSI 文档篇幅主轴。

## 7. Change log

| 日期 | 变化 |
|---|---|
| 2026-05-20 | 首版：记录 Claude 对 Helm Headless Signal Interface 需求的只读评审，并确认 P1/P2 已回写 requirements |
| 2026-05-20 | 吸收 owner audit：确认 Claude 修订仍不足，requirements 结构性重写为 Helm delivery-engineer toolkit 主轴；Salesforce 降级为外部信号；补 D2 smoke / data policy / six-hard-prereq / 5-role review 边界 |
| 2026-05-20 | 记录二次 owner review Go，并同步轻量收紧：4 周目标前置条件、source-agnostic 原则名、first vertical 优先规则、proposed eval 标题、contributor triage 与 runtime Required Reviewer 区分 |
| 2026-05-20 | Phase 1 offline 脚手架落地：HSI-01 pack manifest TS + HSI-03 facade types（read-only / preparation-only），9 boundary case 与 8 non-scripted case 全覆盖，`eval:headless-signal-interface` 8 contract test 通过、五项 incident counter 全部 0；D002 美业仍待 owner 真值；Phase 2+ 未授权 |
| 2026-05-20 | 审计 follow-up：补全 HSI-03 八类 forbidden facade 的 boundary case 覆盖（9 → 15）、evaluator 加 `forbiddenFacadesMissing` 结构性断言、§4 表中 HSI-07 标题更新为 "offline gate"（替代 "proposed gate"），同步 §6.2 状态记录 |
