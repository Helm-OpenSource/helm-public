---
status: active
owner: helm-core
created: 2026-03-31
review_after: 2026-06-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm Role / Audience Foundation v1

## 状态

这是 Helm 当前第一轮正式的 Role / Audience Foundation。
它把散落在 membership、detail chain、handoff、onboarding、settings、billing、internal operating workspace 和 narrative 里的角色语义收成同一套基础层。

## 内部角色

### 经营主线角色

1. `founder`
   - 当前最常见的最终拍板者
   - 负责跨线 judgement、优先级仲裁、关键外部表达边界
2. `sales`
   - 负责 lead、proposal、offer、follow-up 与 conversion 推进
3. `delivery`
   - 负责 walkthrough、activation、review、风险澄清和交付稳定
4. `customer success`
   - 负责保留、扩张、问题升级与 success follow-through
5. `recruiting`
   - 负责 candidate fit、面试推进、offer readiness 和关键招聘节奏
6. `partner`
   - 负责 partner fit、custom 服务接线、客户匹配与依赖风险
7. `billing admin`
   - 负责 payment、renew / restore、seat / entitlement 可读性和商业状态确认

### 组织访问角色

1. `owner`
   - 默认组织 owner，通常也是初始 self-serve trial 用户
2. `admin`
   - 组织管理与运营角色
3. `operator`
   - 负责把 judgement、handoff、review 变成稳定的执行推进
4. `reviewer`
   - 负责 review-before-send、boundary clarification、sendability 判断
5. `member`
   - 基础协作成员

## 外部 audience

当前固定 external audience 包括：

1. `customer`
2. `prospect`
3. `partner`
4. `trial organization`
5. `paid organization`
6. `candidate`
7. `custom service stakeholder`

## 谁拍板、谁接手、谁 review、谁执行

当前默认语义是：

1. `founder / owner`
   - 负责跨线拍板和高影响 decision request
2. `sales / delivery / customer success / recruiting / partner`
   - 负责各自主线的接手与持续推进
3. `reviewer`
   - 负责 sendability、non-commitment、boundary-only、review-before-send 判断
4. `operator`
   - 负责把 judgement 接成后续动作与 handoff
5. `billing admin / owner / admin`
   - 负责 renew / restore / payment truth、seat / entitlement truth 的组织层确认

## Role / Audience 如何影响页面表达

当前已经成立的页面表达规则：

1. dashboard
   - 先告诉你谁当前需要拍板、谁在等待、哪个 audience 会被下一步影响
2. detail pages / unified detail navigation
   - 当前 detail 必须说明当前 audience mode、当前 boundary、下一段 handoff 交给谁
3. settings / billing overview
   - 角色不是纯标签，而是决定谁可以看到 payment rail、renew / restore、seat / entitlement 的 operator truth
4. onboarding
   - 新 trial 用户必须知道自己是 owner / admin，当前组织是谁，下一步应该推进什么
5. internal operating workspace / role handoff
   - 每个角色都应该直接看到属于自己的 judgement、next action、boundary、evidence 和 handoff 依据

## Role / Audience 如何影响 handoff

当前 handoff truth 冻结为：

1. handoff 必须说清当前页在为谁说话
2. handoff 必须说清下一段会交给谁接手
3. handoff 必须保留 boundary、prerequisite、dependency、non-commitment note
4. customer-facing 和 internal-only 语义必须分开

## Role / Audience 如何影响 sendability / boundary

当前固定规则：

1. 对外表达默认 `review-before-send`
2. `customer-facing-with-boundary` 和 `boundary-only` 不能被 role label 冲掉
3. recommendation 不能因为角色切换就直接变成 commitment
4. membership 角色与 product role scene 相关，但当前不是完整 RBAC builder

## 当前已经成立的 role scenes

当前已经稳定成立的 role scenes 包括：

1. founder 主线
2. sales 主线
3. delivery 主线
4. customer success 主线
5. recruiting 主线
6. partner 主线
7. billing admin / owner 在 settings / payment / renew / restore 中的 operator scene
8. operator / reviewer 在 detail / handoff / boundary 里的 scene

## 当前仍然 deferred 的内容

当前仍然刻意 deferred：

1. 完整 enterprise IAM
2. 完整 org admin / permissions platform
3. 完整 HR / org chart layer
4. 完整 audience routing engine

这层当前只是 Role / Audience Foundation，不是完整组织权限平台。
