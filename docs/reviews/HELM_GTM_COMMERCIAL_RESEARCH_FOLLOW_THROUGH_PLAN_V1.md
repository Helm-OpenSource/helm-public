---
status: active
owner: helm-core
created: 2026-04-14
review_after: 2026-07-13
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm GTM / Commercial Research Follow-Through Plan v1

状态：Planning-only  
Owner：Helm Core  
日期：2026-04-14

> 这份文档用于把《Helm Workspace 项目 GTM 与商业化方案深度研究报告》收口成 current-main 可执行的后续任务。它回答的是“下一步做什么”，不代表 current-main 已经转向开源 CLI / local-first / 行业版 / 企业定制版路线。

## 1. 目标

基于研究报告，给 Helm 下一阶段形成一版 repo-aligned 的工作任务包，同时保持以下现实不漂移：

- Helm 当前是 `workspace-first`、`membership-backed`、`controlled-trial`
- Helm 当前主线仍是 `homepage / dashboard / activation / feedback / pilot proof`
- Helm 当前不是通用 Agent builder、完整 workflow engine、完整 BI 平台、完整 enterprise suite
- recommendation 不等于 commitment
- 当前任何商业化判断都必须服从 current-main 的产品 truth，而不是反过来用 GTM 叙事重写产品

## 2. 总判断

这份研究报告方向上有价值，但不能原样变成 current-main 任务。

### 2.1 可直接吸收

1. `差异化主张`
   - Helm 应继续强化“可审计的决策与执行操作层”，而不是“又一个通用 Agent 平台”。
2. `设计伙伴路径`
   - 设计伙伴、PoC 包、Pilot 包、Scale 包这些 GTM 结构适合当前阶段。
3. `proof-first 商业化`
   - 比起先堆高 ARPA，更应该先把 activation、review、proof、pilot closeout 做成可展示成果。
4. `中国市场的可迁移与合规姿态`
   - 对外可以强化“多模型迁移、国产模型兼容、合规姿态诚实”，但不夸大成已完成能力。
5. `GTM 资产建设`
   - 一页纸、行业 landing、设计伙伴计划、成功指标模板，这些都适合直接进入任务队列。

### 2.2 需要改写后吸收

1. `行业版`
   - 当前更适合先做行业化对外包装、案例与 design-partner 方案，不适合先做行业主对象或行业首页。
2. `定价结构`
   - 可以吸收 `workspace + seat + usage / add-on` 的结构思路，但不应该现在就上 credits 体系或复杂价格墙。
3. `多模型 / 多云`
   - 当前更适合先做 narrow compatibility proof、adapter posture 和 demo/readout，不适合扩成模型平台。
4. `交付与培训生态`
   - 当前更适合先做 `manual pilot package + design partner cadence`，不适合直接启动认证体系或伙伴平台。

### 2.3 当前不采纳

1. 开源主线改写 current-main 产品路线
2. 把 Helm 立即转成 `CLI + local-first + OSS core` 主叙事
3. 直接立项 enterprise custom 大包：
   - VPC/私有化
   - SSO/SCIM
   - 等保/ISO/SOC 项目化交付
4. 直接建设行业版对象模型
5. 直接建设 credits billing / 云计量平台

## 3. 与 current-main 的对齐结论

| 报告建议 | current-main reality | 当前处理方式 |
| --- | --- | --- |
| 决策 OS + 治理是差异化 | 已与 current-main truth 对齐 | 直接吸收 |
| 先开源内核再做云 | current-main 已是 workspace-first 受控试点主线 | discovery-only，不改主线 |
| 云通用版靠协作/权限/审计变现 | 当前已有部分 billing / membership / governance foundation | 继续做 activation / proof，不扩面 |
| 行业版优先垂直 | 当前 vertical split 应后置 | 只做 GTM/landing/doc，不做 product object |
| 企业版 + 合规交付 | 当前还没到企业版实施阶段 | 只做 requirement inventory / honest posture |
| 多模型可迁移卖点 | 当前可做 narrow compatibility proof | 不做 broader model platform |

## 4. 下一阶段任务优先级

## 4.1 P0：先把进入、激活、证明跑顺

### Task P0-1：登录后首页继续去说教化，直接回到最重要的工作

**目标**  
把登录后首页进一步收紧成工作恢复面，继续落实最近确定的首页原则：

- 先看 `Top 1-3 work items`
- 再看 `Needs Your Review`
- 再看 `Resume / Continue`
- 解释、reasoning、memory 继续后置

**验收标准**

- 首页首屏不再承担产品教育和方法论解释
- returning 用户能更快回到 `当前人 / 当前事 / 当前 next step`
- new / first-loop / returning / review-heavy 四种状态更清楚

**优先原因**

研究报告反复强调“试点到规模化”的断层。对 current-main 来说，这个断层首先体现在首页和 first value，而不是行业版缺失。

### Task P0-2：压实 `/setup -> dashboard` 的 first-loop handoff

**目标**  
让新用户从 setup 不再停在配置，而是更快进入：

- 一个真实 signal
- 一条可 review 的建议
- 一次 follow-through
- 一次 memory write-back

**验收标准**

- 新用户 first-loop completion proxy 更清楚
- setup 不再像教程中心
- first signal / first suggestion / review posture 更容易被看到

**优先原因**

报告建议 Helm 卖“工作方式 + 模板 + 周节奏”，这在 current-main 上要先通过 horizontal first loop 成立。

### Task P0-3：补 activation / proof / pilot 的最小指标与 readout

**目标**  
把当前更值得看的核心指标收成最小 readout，而不是泛 analytics：

- entry -> signal -> suggestion -> review -> follow-through
- 引用率 / review 率 / proof 率
- pilot closeout 的完成情况

**验收标准**

- 能回答“用户卡在哪一步”
- 能回答“建议有没有真的进入 review / action”
- 能回答“这个 workspace 是不是已经有 first value”

**优先原因**

报告提出的设计伙伴、PoC 包、Pilot 包都需要被同一套 proof 指标支撑，否则销售只剩口头说法。

### Task P0-4：刷新 role-based demo / proof pack

**目标**  
把当前 role-based demo、截图、demo script、proof wording 刷成更统一的 GTM 资产。

**验收标准**

- Founder / Sales / Delivery 三条线各有清楚 proof
- demo 不再像“系统能力展示”，而像“推进链展示”
- 首页、dashboard、demo script、brand docs 口径一致

**优先原因**

研究报告建议前 90 天产出 quickstart / demo data / 1-pager / PoC 模板。对 current-main，demo/proof pack 是更高优先级的直接任务。

## 4.2 P1：把 GTM 和设计伙伴动作接起来

### Task P1-1：产出 Design Partner Program v1

**目标**  
定义一个 current-main 可承接的设计伙伴包，而不是空泛招募。

**建议最小结构**

- 适合谁
- 4–6 周 PoC 包
- 8–12 周 Pilot 包
- 双方投入与边界
- 成功指标
- 联合案例与反馈机制

**验收标准**

- 可以直接对外讲清楚
- 不夸大自动执行或行业能力
- 能回流到产品任务和 monthly pilot insight

### Task P1-2：把行业化先做成 GTM 包，不做 product object

**目标**  
先做 2-3 个对外行业切口版本，但它们只存在于：

- landing / one-pager
- demo material
- design partner offer
- case study / pilot pack

**建议切口**

- 战略 / 投研 / 决策支持
- 咨询 / 交付 / 客户协作
- 采购 / 供应商治理 / 合规型 review

**验收标准**

- 行业化只影响外部包装，不改核心对象体系
- 每个行业切口都能落回同一条 `signal -> judgement -> review -> follow-through -> memory`

### Task P1-3：建立 monthly pilot insight pack

**目标**  
把试点、访谈、demo、activation 和 pilot 观察收成月度 insight pack，作为 GTM 与产品之间的回路。

**验收标准**

- 每月能回答：
  - 哪类 workspace 最快激活
  - 哪类 role 最容易 first value
  - 哪些边界表达最容易误解
  - 哪些 proof 最有说服力

## 4.3 P2：收窄商业化与生态前置研究

### Task P2-1：冻结 pricing hypothesis pack，而不是先做 pricing implementation

**目标**  
基于报告给出的定价锚点，做一版 narrow pricing hypothesis：

- `workspace` 作为主商业单位
- `seat / collaborator / entitlement` 作为第二层
- `add-on / usage` 作为 future rail

**验收标准**

- 不引入 credits 实现
- 不重写 current billing truth
- 只形成对外叙事与内部判断依据

### Task P2-2：做 narrow multi-model portability proof

**目标**  
把“多模型可迁移”先做成 narrow proof，而不是 broad adapter platform。

**建议范围**

- OpenAI-compatible posture 文档
- DashScope / Ark / Hunyuan 的 demo adapter / config proof
- 一页对外说明：Helm 为什么强调 migration posture

**验收标准**

- 不扩成模型平台
- 不引入新大依赖或 broader execution surface
- 对外表达保持 honest

### Task P2-3：做 enterprise requirement inventory，不做 enterprise build-out

**目标**  
把报告里的企业定制与合规要求收成 requirement inventory：

- 什么是 current-main 已有基础
- 什么是已成形但仍需下一层
- 什么是明确未做
- 什么是未来 enterprise gate

**验收标准**

- 不把 requirement inventory 写成交付承诺
- 不提前立项私有化/SSO/SCIM/等保 implementation
- 只作为后续 enterprise readiness 输入

## 5. 推荐的执行顺序

建议按 4 个 batch 推进，而不是一次性铺开：

### Batch 1：Activation / Home / First Value

- P0-1
- P0-2
- P0-3

### Batch 2：Demo / Proof / Pilot Package

- P0-4
- P1-1
- P1-3

### Batch 3：GTM Packaging

- P1-2
- P2-1

### Batch 4：Portability / Enterprise Discovery

- P2-2
- P2-3

## 6. 当前已经完整成立

- workspace-first / membership-backed / controlled-trial 商业边界
- signup / login / setup / trial organization 初始化
- billing / entitlement / lifecycle 第一轮 foundation
- dashboard / approvals / memory / operating / reports 的基础产品面
- China GTM package、brand messaging、homepage/dashboard messaging 与 first-loop/home rules 的 planning baseline

## 7. 已成形但仍需下一层

- 首页首屏状态仲裁与 `Top 1-3` 排序
- `/setup -> dashboard` 的 first-loop handoff
- activation / proof / pilot 指标 readout
- role-based proof pack 与 demo 资产
- design partner / monthly insight 的产品回流机制
- pricing hypothesis 的对外口径

## 8. 刻意未做

- 开源内核 / local-first / CLI pivot
- 行业版对象模型
- enterprise custom implementation
- broader model platform
- pricing engine / credits rail
- training / certification / partner marketplace

## 9. 风险项

1. `被研究报告带偏`
   - 如果直接照搬 `开源内核 -> 云 -> 行业版 -> 企业版`，会把 current-main 拉离当前最重要的 activation 与 proof 主线。
2. `过早行业化`
   - 如果先做行业对象和行业首页，会削弱 Helm 的 horizontal first-loop 与 home surface 主线。
3. `过早企业化`
   - 如果先讲 SSO/SCIM/VPC/等保，会过度承诺并吞掉当前执行资源。
4. `过早定价工程化`
   - 如果太早实现 credits / full pricing rail，会把商业假设误写成商业真值。

## 10. 下一步建议

建议后续 30 天只先做下面 5 件事：

1. 登录后首页继续去说教化，直接回到最重要的工作
2. 压实 `/setup -> dashboard` 的 first-loop handoff
3. 补 activation / review / proof 的最小 readout
4. 刷新 role-based demo / proof pack
5. 产出 Design Partner Program v1

只有这 5 件事站稳后，再进入：

- 行业化 GTM 包
- pricing hypothesis pack
- multi-model portability proof
- enterprise requirement inventory
