---
status: planning
owner: helm-core
created: 2026-04-28
review_after: 2026-05-28
archive_trigger:
  - HELM_CHINA_GTM_PRODUCT_ENABLEMENT_IMPLEMENTATION_REPORT 落地并完成 docs/README.md 索引切换后 30 天归档
  - 2026-07-31 之后若没有任何 pilot proof pack 或 product implementation 引用本文件则归档
---

# Helm China GTM Product Enablement Plan

## 1. 结论

Helm 中国市场 GTM 的产品改造不应该先扩成 CRM、项目管理、伙伴市场或自动化执行平台。

下一步产品侧应只围绕一个商业目标收敛：

**让 Helm 能更快证明“客户会议后的收入推进闭环”确实成立，并把每个试点沉淀成可复盘、可复用、可销售的 proof。**

因此，本计划建议把产品改造分成两条 P0 主线：

1. **Pilot Workspace Mode**：让 4 周试点从散落文档变成 Helm 内部可推进、可复核、可看指标的工作模式。
2. **Proof Pack Builder**：让试点结果默认沉淀成 evidence-backed proof pack，只有通过 review 的内容才能进入销售材料或公开案例。

P1 再补：

- Lead Capture Loop
- Demo-to-Pilot standard path
- package / pricing surface

P2 再补：

- Partner Delivery Workspace
- workflow pack template library

## 2. 继承的 current-main truth

本计划继承以下仓库边界：

1. Helm 仍是 `workspace-first / membership-backed / controlled-trial`。
2. Helm 仍是 `judgement-first / decision-first / review-before-commitment`。
3. Helm reserved tenant GTM Operating Layer 已定义 GTMLead、CustomerDemandBrief、PilotLoop、OutcomeProofPack 与 GTMAsset 的 reserved-only 方向。
4. 现有中国 GTM 销售文档已经定义 ICP、4 周试点包、定价假设和 demo-to-pilot 话术。
5. CustomerDemandBrief draft flow 已在 reserved-only / review-first 方向形成第一层原型。

## 3. 非目标

本计划不授权以下方向：

- 普通客户租户 CRM
- partner marketplace
- 自动外发销售材料
- 自动创建客户 workspace
- 自动写入客户 CRM / 项目系统
- 自动生成合同、报价或收益承诺
- 自动审批、自动结算或自动执行高风险动作
- 完整 billing engine
- 完整 workflow / orchestration platform
- 面向普通客户暴露 Helm 内部 GTM pipeline

所有写入、外发、公开案例和官方系统更新都必须保持 review-first。

## 4. 产品缺口判断

### 4.1 已经足够支撑销售的部分

当前已经足够支撑 founder-led pilot 的部分：

- 中国 ICP 和 Go / No-Go 口径
- 4 周付费试点范围
- Team / Business / Growth / Enterprise 价格假设
- discovery / demo / objection / pilot close 话术
- reserved-only GTM readout 和 CustomerDemandBrief 草稿方向
- Meeting-to-Action / action pack / follow-up draft / review boundary 的核心产品主线

这些内容不需要先继续扩写，而应进入产品化承接。

### 4.2 还不够支撑可复制 GTM 的部分

当前仍缺 6 个产品化承接点：

| 缺口 | 影响 |
| --- | --- |
| Lead 进入 Helm 后没有标准 GTM object posture | founder 仍靠个人记忆判断优先级 |
| Demo 到 pilot 缺少产品内连续路径 | demo 容易变成展示功能，而不是推进试点 |
| 4 周试点缺少产品内 workspace mode | 每周 review、指标、边界和下一步容易散落在文档外 |
| Proof pack 缺少 builder 和 review gate | proof 难以复用，销售材料容易 overclaim |
| package / pricing 缺少产品内表达 | 客户难以理解买的是 workflow pack，不是 token 或 agent 数量 |
| partner delivery 缺少内部交付视图 | 伙伴可交付能力和客户成功风险难以复利 |

## 5. P0：Pilot Workspace Mode

目标：

**把 4 周试点变成 Helm 内部一个可推进、可复核、可量化、可收口的 operating mode。**

第一版只服务 Helm reserved tenant 和受控试点，不作为普通客户自助配置入口。

### 5.1 产品形态

Pilot Workspace Mode 应在 reserved operator 视角展示：

- pilot customer / ICP fit
- pilot week: Week 0 / Week 1 / Week 2 / Week 3 / Week 4
- current loop: Meeting-to-Action / Revenue Operating Loop / Governed CRM-CS Loop
- success metrics baseline / current snapshot
- action pack status
- follow-up draft status
- manager review status
- handoff / exception status
- proof pack completeness
- blocker and next step

### 5.2 数据与对象边界

第一版优先复用现有对象和 read model：

- CustomerDemandBrief
- ActionItem / approval / review packet
- operating readout
- audit / evidence refs
- reserved-only GTM readout

不优先新增 schema。

如果后续必须新增持久化对象，先走独立 schema review，并证明不能用现有 metadata / read model / reserved-only fixture 承载。

### 5.3 验收标准

Pilot Workspace Mode 至少满足：

1. 一个 pilot 能看到当前周次、当前闭环、owner、reviewer 和 next step。
2. 每个试点必须绑定 success metrics baseline。
3. 每个 action pack / follow-up draft / handoff pack 都有 review boundary。
4. high-risk official write 只能显示为 candidate / review packet。
5. Week 4 必须生成 proof pack draft 或明确说明 proof 不成立。

## 6. P0：Proof Pack Builder

目标：

**把每个试点的结果默认收成可审计 proof，而不是让销售团队事后手工拼案例。**

Proof Pack Builder 的第一版是 internal-only / review-first，不是公开案例发布工具。

### 6.1 产品形态

Proof Pack Builder 应收集：

- customer type and team size
- pilot scope
- baseline
- before / after metric snapshot
- action pack examples
- follow-up draft examples
- handoff / exception examples
- wrong commitment incident evidence
- audit trace coverage
- unresolved gaps
- public-use posture
- claim level

### 6.2 claim level

所有 proof pack 输出必须带 claim level：

| Claim level | 含义 | 对外使用 |
| --- | --- | --- |
| `hypothesis` | 只有判断，没有足够证据 | 不进入销售强承诺 |
| `internal_proof` | 有内部证据，但未获客户确认 | 仅内部销售学习 |
| `anonymized_proof` | 可匿名使用，边界完整 | 可进入销售材料草稿 |
| `approved_public` | 已获审批和客户授权 | 可进入公开案例 |

没有 proof pack 的内容只能是 hypothesis。

### 6.3 验收标准

Proof Pack Builder 至少满足：

1. 每个 proof claim 可追溯到 evidence refs。
2. public-use posture 默认为 `internal_proof` 或更低，不默认公开。
3. wrong commitment incident 必须显式记录，目标为 0。
4. Audit Trace Coverage 必须显示，目标为 100%。
5. 对外销售材料只能引用 review 通过的 proof。

## 7. P1：Lead Capture Loop

目标：

**让所有注册、demo、推荐和试点线索进入同一条 reserved-only GTM 判断链。**

第一版应输出：

- lead summary
- ICP score
- likely use case
- urgency
- owner
- next touch
- follow-up draft candidate
- CustomerDemandBrief draft link

边界：

- 不替代 CRM。
- 不自动外发。
- 不把内部 sales notes 暴露给客户 workspace。
- 不自动创建 trial workspace。

验收指标：

- 注册到首次有效触达小于 24 小时，目标小于 2 小时。
- 80% 以上 founder-led leads 有 ICP score 和 next touch。
- demo 前必须有 CustomerDemandBrief draft 或 missing information list。

## 8. P1：Demo-to-Pilot Standard Path

目标：

**让 demo 不再展示功能清单，而是产品内固定展示一条客户会议到收入推进闭环。**

标准链路：

```text
customer meeting
  -> structured facts
  -> action pack
  -> follow-up draft
  -> opportunity judge
  -> manager attention
  -> sales-to-delivery handoff
  -> guarded write candidate
  -> exception / reconciliation
  -> audit trail
  -> pilot proposal
```

第一版可以通过 demo fixture、reserved operator readout 和 sales script 联动完成，不要求新增 broad runtime capability。

验收：

- 30 分钟 demo 不超过一条主链。
- demo 结束能直接生成 pilot proposal draft。
- 所有自动写入、自动外发和收益承诺都以 boundary note 降级。

## 9. P1：Package / Pricing Surface

目标：

**让客户理解 Helm 买的是 operating workflow pack，不是 token、agent 数量或普通 seat 工具。**

第一版只做 pricing hypothesis surface 和 sales handoff，不做完整 billing engine。

应表达：

- Team：试用和小团队入口
- Business：标准销售 / 交付协同团队
- Growth / Revenue OS：workflow pack 主力收入层
- Enterprise / Custom：系统接入、定制 workflow、伙伴交付

边界：

- 不公开 token 计费主锚点。
- 不承诺所有 workflow pack 已完整产品化。
- 不把 custom implementation 写成标准 self-serve entitlement。

## 10. P2：Partner Delivery Workspace

目标：

**让 implementation partner 交付能力进入 Helm 的内部经营闭环，而不是只靠人工群聊和表格。**

第一版只做 Helm reserved tenant 内部伙伴交付视图，不做 marketplace。

应展示：

- partner type
- delivery capability
- connector capability
- current customer match
- delivery blocker
- proof contribution
- next action
- risk

边界：

- 不做 public partner ranking。
- 不做自动结算或收益承诺。
- 不让 partner 直接访问客户内部 workspace，除非客户显式授权。

## 11. 受影响组件

预计受影响组件如下：

| 组件 | 影响 |
| --- | --- |
| `features/internal-operating-workspace/*` | reserved-only GTM readout、pilot mode 和 proof readout 的主要承接面 |
| `lib/gtm-*` | CustomerDemandBrief、GTM readout、proof pack builder 的纯函数和测试承接 |
| `/operating` | reserved operator 的 GTM / pilot / proof 工作入口 |
| `/demo` | demo-to-pilot standard path 的演示承接 |
| `/setup` | customer confirmation / trial initialization handoff 的后续入口 |
| `/approvals` | guarded write candidate、public proof use、customer-facing copy 的 review gate |
| `docs/sales/*` | ICP、pilot、pricing、script 与产品能力的双向索引 |
| `docs/README.md` | 新 product plan 与 GTM assets 索引 |

## 12. 权衡

### 为什么先做 Pilot Workspace Mode

因为中国市场第一阶段的 GTM 成败不取决于功能数量，而取决于 3-5 个强痛客户能否在 4 周内看到 proof。Pilot Workspace Mode 能直接提升 founder-led pilot 的交付可靠性和复盘效率。

### 为什么 Proof Pack Builder 同为 P0

因为没有 proof，GTM 会长期依赖主观叙事。Proof Pack Builder 把销售材料、官网、融资叙事和招聘信任都绑定到证据，而不是绑定到功能清单。

### 为什么 Lead Capture Loop 放 P1

Lead Capture Loop 很重要，但在没有 pilot proof 之前，更多 lead 只会放大未证明链路的运营负担。应先让少量 pilot 更容易成功，再扩 lead throughput。

### 为什么 Partner Delivery Workspace 放 P2

partner delivery 能扩大交付半径，但如果先做，会把产品拉向 marketplace 和实施管理平台。应等 pilot proof 和标准 pack 成立后再接入伙伴。

## 13. 90 天产品推进顺序

| 时间 | 产品重点 | 输出 |
| --- | --- | --- |
| 0-30 天 | Pilot Workspace Mode + Proof Pack Builder 设计与 reserved prototype | pilot mode readout、proof pack draft、review boundary |
| 31-60 天 | Lead Capture Loop + Demo-to-Pilot standard path | lead score、CustomerDemandBrief handoff、pilot proposal draft |
| 61-90 天 | package surface + Partner Delivery Workspace planning prototype | workflow pack surface、partner delivery readout、first partner proof |

## 14. 成功指标

产品侧 success metrics：

| 指标 | 目标 |
| --- | --- |
| Founder-led pilot count | 30 天内 3 个强痛 pilot |
| Pilot workspace coverage | 每个 pilot 100% 有 baseline、owner、week、next step |
| Meeting-to-Action Time | 小于 5 分钟，或相对 baseline 降低 70% |
| Follow-up Latency | 降低 50% |
| Manager Review Time | 降低 30% |
| Draft Adoption Rate | 大于 60% |
| Wrong Commitment Incident | 0 |
| Audit Trace Coverage | 100% |
| Proof Pack Completion | Week 4 结束时 100% 生成 proof pack draft 或 no-proof reason |

## 15. 验证方案

### 文档切片验证

本计划落地后应至少运行：

```bash
git diff --check
npm run self-check
npm run check:boundaries
```

### 未来代码切片验证

只要进入代码实现，应根据影响面增加：

```bash
npm run typecheck
npm run lint
npm run test -- --run <targeted test files>
npm run build
```

如果触及 route、UI 或 demo flow，应补 Playwright / e2e 验证。

如果触及 schema、migration、official write、customer-visible data、approval 或 audit，则必须先做独立计划并按仓库默认全验证链处理。

## 16. 剩余风险

1. 现有 reserved-only GTM prototype 与中国销售文档之间仍需要产品内 glue layer。
2. Pilot metrics 需要真实客户 baseline，不能用 demo fixture 伪造 proof。
3. Proof pack public-use posture 需要客户授权和内部 review，不能默认公开。
4. Partner delivery 可能诱导 scope 膨胀，必须先保持 internal-only。
5. 如果过早做 package / pricing UI，可能让客户误解为所有 workflow pack 都已完整产品化。

## 17. 下一步

建议下一刀只做两个 implementation planning slice：

1. **Pilot Workspace Mode implementation plan**：限定 reserved tenant、只读 readout、reuse current objects、no schema first。
2. **Proof Pack Builder implementation plan**：限定 internal-only、review-first、claim-level required、no public publication.

这两个 slice 通过后，再进入 Lead Capture Loop 和 Demo-to-Pilot standard path。

## 18. 变更记录

| 日期 | 变化 |
| --- | --- |
| 2026-04-28 | 首版，基于中国市场 GTM 方案把产品侧 P0/P1/P2 enablement 收成执行计划 |
