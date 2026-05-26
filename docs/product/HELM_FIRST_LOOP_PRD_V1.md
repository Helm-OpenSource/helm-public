---
status: active
owner: helm-core
created: 2026-04-13
review_after: 2026-07-12
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm First-Loop PRD v1

状态：Planning-only
Owner：Helm Core
日期：2026-04-13

> 这是一份 repo-aligned 的正式产品文档，用于冻结 Helm 当前阶段的 onboarding / first-run / first-value 判断。它定义的是下一阶段应如何收口，不代表 current-main 已经存在新的 schema、runtime contract 或完整产品闭环。

## 1. 一句话定义

Helm 的 first loop，是让一个第一次进入空 workspace 的用户，在 10-20 分钟内基于一个真实 signal，完成一次 `判断 -> 建议 -> review -> 跟进 -> memory write-back -> next visit anchor` 的最小真实行动闭环。

## 2. 为什么这是当前最重要的问题

当前 current-main 已经成立：

- formal public entry -> signup / login -> `/setup`
- `workspace-first`、`membership-backed`、`controlled-trial`
- `dashboard`、`meetings / detail`、`approvals`、`memory`、`diagnostics`、`reports`、`/operating`
- Role / Audience、Organizational Memory、Goal / Campaign 三层 foundation

但当前最关键的产品缺口仍然是：

1. 新用户第一次进入空系统时，不知道先看什么、先推进什么。
2. `/setup`、`dashboard`、`detail`、`approvals`、`memory` 之间已经分别成立，但还没有被明确收成同一条 first-value 路径。
3. 用户能完成初始化，不等于能完成第一条真实行动闭环。
4. 如果第一轮没有留下 decision trace、boundary trace 和下一次回来的锚点，Helm 很容易被误解成“有 setup、有页面、但没有第一条价值”的系统。

对当前阶段来说，这比继续扩功能更重要，因为它直接决定：

- 新 workspace 是否能从空系统进入真实经营动作
- Helm 是否能证明自己先是 horizontal operating layer，而不是抽象平台
- 后续 Vertical split 是否建立在稳定闭环上，而不是建立在空对象模型上

## 3. 为什么不能直接先做 Vertical 版本

当前不应先从 Vertical 开始，原因有 5 个：

1. Helm 当前最缺的不是行业对象名词，而是空系统进入第一条真实动作的通用路径。
2. founder / sales / delivery / customer success / operator 的 first problem 不同，但 first loop contract 相同：都要从真实 signal 进入 judgement、review、follow-through 和 write-back。
3. 如果先定义 Vertical object pack，很容易把 current-main 拉回 CRM / workflow / PM / AI service platform 叙事。
4. 当前 repo 已经有 meetings、memory、approval、goal / campaign、role handoff、operating workspace 等横向基础，更合理的动作是先把它们收成同一条 horizontal layer。
5. Vertical 版本应该建立在“first loop 已被证明能稳定跑通”之后；它负责换更贴角色或行业的话术、模板、signal ranking，不应该先替代核心 loop contract。

## 4. 用户问题定义

当前要解决的是 4 个连续问题：

### 4.1 空系统

新用户第一次进入 Helm 时，系统里可能没有完整 CRM、没有系统化知识库、没有 workflow setup，也没有足够历史数据。

### 4.2 不会开始

用户能看见 setup、dashboard 和很多产品面，但不知道“现在最值得先推进的一件事是什么”。

### 4.3 不知道价值

如果第一轮只停在配置、浏览页面或阅读解释，用户无法在第一次 session 内形成“Helm 真的帮我推进了一步”的感受。

### 4.4 不会持续回来

如果第一轮结束后没有留下 memory、decision trace、boundary trace 和下一次回来的锚点，用户第二次回来时仍会重新迷路。

## 5. 核心用户与优先角色

当前 first loop 优先服务 4 类角色：

1. `founder / owner`
   - 需要快速理解 Helm 当前帮他判断什么、为什么、下一步该拍什么板。
2. `sales`
   - 需要把一个真实跟进、机会推进或客户表达，从 signal 拉到下一步动作。
3. `delivery / customer success`
   - 需要把 onboarding walkthrough、activation follow-through、风险澄清或 success 跟进接成可复核推进链。
4. `operator / reviewer`
   - 需要守住 review-before-commitment、boundary、evidence 与 write-back，不让第一轮为了“快”而越权。

## 6. 核心 JTBD

### 6.1 founder / owner

当我第一次进入一个空的 Helm workspace 时，帮我先选出最值得推进的一条真实经营动作，并告诉我为什么是它、边界在哪、我需要做什么判断。

### 6.2 sales

当我刚进入 Helm 但还没有完整 CRM 基础时，帮我从一个真实跟进 signal 开始，而不是先要求我完成整套配置。

### 6.3 delivery / customer success

当我需要推进 onboarding、activation、风险澄清或 follow-through 时，帮我把第一条建议变成 review-first 的下一步，而不是给我一个泛用聊天框。

### 6.4 operator / reviewer

当系统给出第一条建议时，帮我明确它是 recommendation 还是 commitment candidate、当前是否需要 review、哪些 boundary 必须保留。

## 7. 核心产品判断

### 7.1 为什么 first loop 是 Helm 的核心 horizontal layer

因为它跨过的不是某个 Vertical 对象，而是 Helm 的核心横向合同：

1. signal intake
2. judgement
3. review-before-commitment
4. follow-through
5. memory / trace write-back
6. next visit anchor

这条合同一旦成立，founder、sales、delivery、customer success 只是在 signal 类型、对象语义和 copy 上不同，而不是在 loop 本身上不同。

### 7.2 为什么“学习 Helm、使用 Helm、熟悉 Helm”本身是一条行动闭环

因为 Helm 不应该把“学习产品”设计成教程中心或课程中心。

对 Helm 来说，学习产品的正确方式就是：

1. 选一个角色和当前目标
2. 选一个真实 signal
3. 看一条建议和它的依据
4. 做一次 review
5. 推进或明确 defer
6. 看到这次动作如何被记住、如何影响下一次回来

换句话说，用户不是先学完再使用，而是在第一条真实经营动作里完成学习、使用和熟悉。

### 7.3 为什么 first loop 必须从真实 signal 开始，而不是从配置开始

因为配置只能解释 Helm 能做什么，不能证明 Helm 已经帮用户推进了什么。

`/setup` 当前已经成立，但它的职责应该是：

- 收窄角色
- 收窄目标
- 收窄 signal posture
- 收窄默认 policy 和团队入口

而不是把 first value 延后到“全部配好以后”。
first loop 必须在第一次 session 内尽快落到一个真实 signal 上。配置是前置 narrowing，不是价值本身。

### 7.4 为什么 first loop 必须在第一次就体现 review-before-commitment

因为 Helm 当前的差异化不是“更快自动执行”，而是：

- judgement-first
- decision-first
- review-before-commitment
- recommendation != commitment

如果第一轮为了追求 wow moment 而跳过 review，用户会误解 Helm 的 authority，后续也更难建立可信边界。

### 7.5 为什么 first loop 结束后必须留下 memory / decision trace / boundary trace

因为 Helm 不是一次性建议工具，而是 operating memory system。

第一轮结束后至少要留下：

1. 这次为什么选这条 signal
2. 这次建议是什么
3. 谁 review 了什么
4. 哪些 boundary 被保留
5. 下一步动作是什么
6. 下次回来应该从哪里接着走

没有这些 trace，first loop 只会变成一次性体验，不会形成回访理由。

### 7.6 为什么 Vertical 版本应该后置，而不是先定义核心对象

因为 Vertical 应该解决“同一条 loop 在不同行业/角色里怎么更快命中高信号对象”，而不是替代：

- signal -> judgement -> review -> follow-through -> write-back

如果先定义 Vertical core objects，再回头补 loop，极容易把当前 repo 拉成：

- CRM object pack
- workflow engine
- AI service platform
- 行业化 demo 壳

这都不是当前阶段目标。

## 8. First-loop 完成定义

一次 first loop 只有在以下 6 件事都成立时，才算完成：

1. 用户明确了当前角色与当前目标。
2. 用户或系统选定了一条真实 first signal。
3. Helm 给出一条带 evidence、boundary、owner 的 first suggestion。
4. 用户进入了明确的 review posture，而不是直接被推向 commitment。
5. 用户完成了 follow-through、明确 defer，或形成了下一位 owner 的 handoff。
6. 系统留下 memory write-back、decision trace、boundary trace 和 next visit anchor。

以下情况都不算完成：

- 只完成 setup
- 只看 dashboard
- 只读说明，没有进入 review
- 只生成草稿，没有 follow-through / defer / handoff
- 没有留下回访锚点

## 9. 用户路径

| 步骤 | 用户问题 | 产品要求 | current-main 锚点 |
| --- | --- | --- | --- |
| 进入 | 我从哪里开始，不走 demo 也能进来吗？ | 从 formal public entry 进入真实 workspace，默认落到 `/setup`，不是课程中心 | public entry、signup / login、`/setup` |
| 角色选择 | Helm 当前在替谁服务？ | 先明确 `owner / founder / sales / delivery / customer success / operator / reviewer` posture | membership role、role presets、Role / Audience Foundation |
| 当前目标选择 | 我现在在打哪场仗？ | 在 setup / dashboard 明确当前最重要 goal / campaign，而不是只列配置项 | `/setup`、`/dashboard`、Goal / Campaign Foundation |
| first signal 选择 | 第一条要从哪里开始？ | 让用户从一个真实 signal 开始，而不是先做全量配置；meeting / email / CRM / report / manual signal 应属于同一类入口语义 | `dashboard`、`meetings / detail`、`operating`、current signal surfaces |
| suggestion | Helm 具体建议我做什么？ | 给出一条 first suggestion，必须带 evidence、boundary、owner 和 why now | `dashboard`、`meetings / detail`、`operating` |
| review | 这条建议是能直接做，还是要 review？ | 显式区分 recommendation、reviewed、approved、executed、official | `approvals`、detail review snapshot、page hierarchy contract |
| follow-through | 下一步真的推进了吗？ | 允许用户确认、defer、handoff 或进入 manual follow-through，不越过 review-before-commitment | `approvals`、`meetings / detail`、follow-through surfaces |
| memory write-back | 这次为什么值得被记住？ | 把 decision trace、boundary trace、action / defer 结果写回 memory | `memory`、audit、organizational memory surfaces |
| next visit anchor | 我下次回来从哪里继续？ | 给出清楚的 return anchor，而不是让用户再次扫全场 | `dashboard`、`reports`、`/operating`、diagnostics readout |

## 10. 页面级映射

### 10.1 setup / onboarding

职责不是把用户教会，而是让 first loop 有起跑线：

- 明确当前 workspace、membership role、trial posture
- 明确 persona、focus、默认 policy、teammate invite
- 尽快把用户从配置引到第一条真实 signal

`/setup` 应保持 onboarding 例外地位，但不能演化为教程中心。

### 10.2 dashboard first-run

这是 first loop 的默认主入口，第一屏需要优先回答：

1. 当前最值得先看的 first signal 是什么
2. Helm 为什么这样判断
3. 当前建议是什么
4. 当前谁需要 review / 拍板
5. 如果现在不做，下次回来该从哪里继续

### 10.3 meeting / object detail first-run

如果用户第一次不是从 dashboard 进入，而是从 meeting、contact、company、opportunity 或 handoff detail 进入，detail 必须能直接承担：

- 当前 judgement
- pending decision
- next action
- boundary
- review snapshot

### 10.4 approvals / review

这是 first loop 第一次显式体现 Helm product contract 的地方：

- review-before-commitment
- recommendation != commitment
- boundary / prerequisite / dependency / non-commitment

first loop 不应绕开这一层。

### 10.5 memory / follow-through confirmation

第一次 loop 结束后，memory 不是“历史仓库”，而是回写这次 loop 的理由链：

- 为什么是这条 signal
- 为什么是这条建议
- 哪个边界保留了
- 现在下一步挂给谁

### 10.6 diagnostics / adoption maturity

diagnostics 需要能判断 first loop 卡在哪一层：

- 没有 signal
- 有 signal 但没进入 suggestion
- 有 suggestion 但没进入 review
- 有 review 但没 follow-through
- 有 follow-through 但没 write-back / return anchor

### 10.7 reporting / operating workspace

它们不是 first entry，但要承担 first loop 的第二次到访语义：

- reporting 负责读出 first-loop adoption / maturity
- operating workspace 负责把第一轮动作并入真实经营链

## 11. Planned product objects

以下对象是 planned product objects，用于后续实现和页面合同讨论。
它们**不是** current-main 已实现 schema，也**不是**当前 Prisma / API truth。

| Planned product object | 作用 | 预期映射面 | 当前状态 |
| --- | --- | --- | --- |
| `FirstLoopIntent` | 记录当前角色、当前目标、当前进入 posture | setup / dashboard | planned only |
| `FirstLoopSignal` | 表示第一条真实 signal 候选，不要求已存在完整 CRM / knowledge base | dashboard / meetings / operating | planned only |
| `FirstLoopSuggestion` | 表示第一条建议及其 evidence、boundary、owner | dashboard / detail / approvals | planned only |
| `FirstLoopReview` | 表示第一次 review-before-commitment checkpoint | approvals / detail review snapshot | planned only |
| `FirstLoopFollowThrough` | 表示确认、defer、handoff、manual execution proof 的最小结果 | approvals / detail / memory | planned only |
| `FirstLoopAnchor` | 表示 next visit 时的继续入口与当前状态 | dashboard / reports / operating | planned only |

## 12. MVP 范围

First-loop MVP 只需要回答 6 件事：

1. 新用户进入真实 workspace 后，能明确自己当前角色与当前目标。
2. 系统能在空系统里给出一个 first signal 入口，而不是要求先完成完整配置。
3. dashboard 或 detail 能给出一条带 evidence / boundary / owner 的 first suggestion。
4. 用户能在第一次就进入明确 review posture。
5. 用户能完成一次 follow-through、defer 或 handoff，并留下 trace。
6. 系统能给出下一次回来的 anchor，并在 diagnostics / reporting 读出完成度。

MVP 不需要：

- 完整 Vertical object pack
- 完整 onboarding automation
- 完整 growth / analytics platform
- 完整 workflow engine
- broad auto-write / auto-send

## 13. 成功指标

以下都应作为内部产品信号使用，不作为对外承诺：

1. 新 workspace 用户在第一次 session 内进入 first signal 的比例
2. 从 first signal 到 first suggestion review 的转化率
3. 从 first suggestion 到 follow-through / defer / handoff 的转化率
4. 从首次进入到 first-loop completion 的中位时长
5. 首次完成 first loop 后，7 天内带着 anchor 回访的比例
6. diagnostics 能明确归因的 first-loop stuck cases 占比

目标不是“用户点了多少配置”，而是“用户是否在 10-20 分钟内真的跑通第一条动作闭环”。

## 14. 与未来 Vertical split 的关系

future Vertical split 应该在 first loop 之上做 4 件事：

1. 提供更贴角色或行业的话术
2. 对 first signal 做更贴场景的 ranking
3. 提供更贴对象的 suggestion template
4. 对 handoff / memory / reporting 做更贴 Vertical 的 readout

future Vertical split 不应该先做：

- 替换 horizontal first-loop contract
- 抢先定义 current-main canonical schema
- 把 Helm 写成行业 CRM / ERP / PM / workflow engine

## 15. 哪些能力已经完整成立

以下能力当前已经在 current-main 成立，可作为 first-loop PRD 的基础：

1. formal public entry -> real workspace -> `/setup` 的 self-serve 路径
2. `workspace-first`、`membership-backed`、`controlled-trial` 的基本商业与访问边界
3. `dashboard`、`meetings / detail`、`approvals`、`memory`、`diagnostics`、`reports`、`/operating` 这些产品面已经存在
4. Role / Audience、Organizational Memory、Goal / Campaign 三层 foundation 已有正式文档和页面落点
5. review-before-commitment、recommendation != commitment、boundary trace 的产品边界已成立

## 16. 哪些能力已成形但仍需下一层

以下能力已成形，但还没有被收成一条完整 first loop：

1. `/setup` 到 `dashboard` 的 first-value handoff
2. 空系统 first signal 选择口径
3. dashboard / detail / approvals / memory 之间的 first-loop 串联
4. first-loop completion 的 diagnostics / reporting readout
5. next visit anchor 的显式产品合同

## 17. 哪些地方刻意未做

当前刻意未做：

1. Vertical 行业对象与行业模板包
2. 完整 CRM / knowledge base / workflow setup 依赖
3. 把 onboarding 做成课程中心、教程中心或 LMS
4. broad auto-send、broad auto-write、broad auto-commitment
5. 完整 analytics / growth / BI platform
6. 把 planned product objects 直接写成 current-main schema

## 18. 风险项

1. 如果 first loop 继续停留在 setup completion，而不是 signal-to-action loop，用户仍然感受不到第一条价值。
2. 如果 first loop 从配置而不是 signal 开始，Helm 会更像 setup shell，而不是 judgement-first operating system。
3. 如果第一次为了显得智能而弱化 review-before-commitment，会直接伤害 Helm 的可信边界。
4. 如果 planned objects 被误读成 current schema，会造成文档和实现错位。
5. 如果太早按 Vertical 拆，会把当前主线重新拉回对象扩面和平台化。

## 19. 哪些边界必须继续诚实保留

1. Helm 当前仍是 `workspace-first`、`membership-backed`、`controlled-trial`、`judgement-first`、`decision-first`
2. recommendation 不等于 commitment
3. review-before-commitment 必须保留
4. first loop 必须服务空系统，不依赖完整 CRM / knowledge base / workflow setup
5. Helm 当前不是 LMS、通用 AI 聊天产品、通用 Agent 平台、workflow engine、CRM / ERP / PM 平台
6. 本文里的 planned product objects 不等于 current-main 已实现 schema

## 20. 建议的后续执行顺序

后续如果按最小可验证切片推进，建议顺序是：

1. 收 `/setup -> dashboard` 的 first-loop handoff 文案与结构
2. 收 dashboard first-run 的 signal / suggestion / boundary 主合同
3. 收 meeting / detail 与 approvals 的 first review posture
4. 收 memory write-back 与 next visit anchor
5. 收 diagnostics / reporting 的 adoption maturity readout

这 5 步都应继续遵守：

- planning-first
- minimal verifiable slice
- review-first
- docs / guards / validation 同步
