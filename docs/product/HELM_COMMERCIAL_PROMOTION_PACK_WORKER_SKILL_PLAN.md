---
status: active
owner: GTM / Product / Engineering
created: 2026-04-30
review_after: 2026-05-14
archive_trigger:
  - Commercial Promotion Pack 的 Phase 1 worker stubs / fixtures / contract tests 落地后，本文件由实现 PRD 替代
  - Pack A 不再作为首批商业化 Pack 或 founder-led GTM 路径被放弃
  - 本文件内任一 Skill 被实际发布到客户或公开渠道后 30 天内，必须由实跑版 closeout 替代
---

# 商业推广 Skill Pack：Worker / Skill 选择与实现计划

## 1. 结论

商业推广 Skill Pack 的目标不是做营销自动化、CRM 替代、群发工具或广告投放系统，而是服务 Helm 当前最关键的 founder-led GTM：

```text
找到最痛的 design partner
  -> 验证真实失败事件
  -> 准备可复核 scope
  -> 推进 paid pilot
  -> 形成 proof pack
  -> 把重复成功动作沉淀为 Pack / Skill / cookbook candidate
```

它应该作为 **Internal / Founder GTM Pack** 先运行在 Helm 自身租户，用于推动 Pack A 首批试点，而不是直接对外销售。

第一版只做 bounded worker + review-first Skill：

1. 只读研究、整理、评分、草稿和 proof assembly。
2. 不自动联系客户、不自动发送、不自动承诺价格、不自动发布内容。
3. 每个输出都必须有 evidence、boundary note、owner、review posture 和 outcome metric。
4. 每个 worker 都必须能被 replay / audit / eval，不依赖黑盒 agent 自由行动。

## 2. 设计原则

| 原则 | 具体落点 |
|---|---|
| Context-first | 每个 worker 运行前必须有 ICP、当前阶段、候选 alias、公开来源、私有输入边界、输出 contract |
| Bounded agent | worker 只产出 artifact，不直接产生外部副作用 |
| Review-before-commitment | 对外文本、价格、案例、DPA、scope、proof claim 全部进入人工复核 |
| Evidence-driven | 每个判断必须关联来源：公开网页、访谈记录 alias、仓库文档、测试 / eval 输出 |
| Deterministic ranking first | 候选评分和排序使用透明权重，LLM 只能解释原因和压缩摘要 |
| Trace / replay | 每次运行留下 input summary、evidence refs、review decision、measured delta |
| Self-improvement | 反馈只进入 candidate：threshold fix、prompt context fix、template improvement、SkillSuggestion |

## 3. 与 Pack A 的关系

| 层 | Pack A | 商业推广 Pack |
|---|---|---|
| 使用者 | B2B SaaS / 企业软件客户 | Helm founder / GTM / implementation team |
| 主要目标 | 客户会议后的收入推进闭环 | 找到、验证、成交并复盘首批 design partner |
| 输出 | follow-up、priority customer、manager attention、handoff pack | candidate brief、validation brief、scope packet、follow-up draft、proof pack |
| 风险 | 客户承诺、CRM 写回、销售推进误判 | 对外 claim、误导性销售话术、隐私 / 脱敏、价格承诺 |
| 首版姿态 | customer-facing pilot pack | internal founder-led GTM pack |

商业推广 Pack 是 Pack A 的“销售和试点推进操作层”，不取代 Pack A，也不把 Pack A 扩成营销系统。

## 4. Worker 候选与首批选择

### 4.1 首批必须做（P0）

| Worker | Skill 名称 | 输入 | 输出 | 质量门 | 不做 |
|---|---|---|---|---|---|
| ICP Desk Research Worker | `commercial.icp_desk_research` | alias、官网链接、公开网页、ICP playbook | 脱敏候选 brief：行业、规模、产品、可能 buyer、工具迹象、可验证问题 | 公开字段完整率 ≥90%；不得含隐私联系人 | 不抓取登录后数据，不写真实客户名入仓 |
| Candidate Scorecard Worker | `commercial.design_partner_scorecard` | 公开 brief、创始人私有备注的脱敏摘要、评分规则 | 100 分评分 + Top / Pool / Nurture / No-Go 建议 | 必须覆盖痛点、owner、数据、proof、付费、边界六维 | 不替 founder 终选 |
| Validation Call Prep Worker | `commercial.validation_call_brief` | scorecard、候选疑点、call script | 30 分钟验证电话 brief + 必问问题 + 戳穿假设点 | 每个候选至少 3 个 falsification questions | 不承诺 demo、价格或试点 |
| Meeting-to-Proof Worker | `commercial.meeting_to_proof_signal` | 访谈纪要 / 手工记录 / call note alias | pain / owner / data / proof / budget / boundary 信号 | 必须区分事实、推断、待确认 | 不把未确认口头内容写成客户承诺 |
| Pilot Scope Packet Worker | `commercial.pilot_scope_packet` | Top 候选、scope call notes、runbook、DPA 模板 | Week 0 scope packet：数据清单、owner、review cadence、success metrics、stop conditions | 每个 success metric 有 measurement source | 不生成最终合同条款，不替法务 |
| Proof Pack Assembly Worker | `commercial.proof_pack_assembly` | pilot scorecard、匿名指标、review notes、客户授权状态 | proof pack candidate：指标、图表、故事线、不可说清单 | proof claim 必须有 evidence + approval status | 不自动发布公众号 / 知乎 / ClawHub |

### 4.2 第二批可做（P1）

| Worker | 价值 | 进入条件 |
|---|---|---|
| Review-first Follow-up Draft Worker | 验证电话后生成 founder 可改的跟进草稿 | P0 call notes 已稳定，且 draft / send 边界通过审计 |
| Channel Content Draft Worker | 把 proof pack 改写为公众号 / 知乎 / README 草稿 | 法务确认脱敏和案例授权边界 |
| Implementation Engineer Match Worker | 为 Pack A pilot 匹配内部 / 种子认证工程师 | 第一个 design partner 确认，Week 0 接入复杂度明确 |
| Partner Motion Brief Worker | 为阿里云 / 腾讯 / 火山等合作方准备 one-pager | 首个 proof pack 有 public-safe 版本 |

### 4.3 当前不做（P2 / No-Go）

| 能力 | 决策 | 原因 |
|---|---|---|
| 自动外呼 / 自动邮件 / 自动 IM | No-Go | 直接触碰外部副作用和品牌风险 |
| 自动改 CRM / 创建商机 | No-Go | 首批 GTM 仍是 founder-led，不引入 CRM 污染 |
| 自动报价 / 自动合同生成 | No-Go | proposal 不等于合同，价格需要 founder / legal review |
| 自动发布文章 / ClawHub Skill | No-Go | proof / claim 必须先过脱敏和授权 |
| 广告投放优化 | Deferred | 当前首批成交不靠 paid acquisition |
| 通用 agent swarm 自由研究 | No-Go | 容易制造噪音；只允许 bounded worker 和 verifier |

## 5. Skill contract

每个商业推广 Skill 必须有以下 frontmatter。注意：这不是 Pack A customer-facing SKILL.md，而是 Helm internal GTM Pack 的 Skill。

```yaml
---
name: commercial.<skill_slug>
pack: commercial-promotion
version: 0.1.0
visibility: internal
helm:
  multi_tenant: true
  recommendation_only: true
  audit_required: true
  workspace_scope: reserved_tenant
  external_side_effects: false
  review_required_for:
    - customer_facing_text
    - price_or_contract
    - public_claim
    - legal_or_dpa
    - data_processing_statement
requires:
  permissions: [public:web:read, docs:read, private_notes:alias_only]
  forbidden_inputs: [raw_customer_pii, credentials, unredacted_transcript, private_email_body_without_consent]
outputs:
  artifact: markdown | json
  posture: watch_only | review_required | ready_for_founder_decision
---
```

## 6. Worker 接口计划

当前只批准 planning contract，不批准 runtime implementation。后续如进入代码，统一接口建议如下：

```typescript
interface CommercialPromotionWorker<TInput, TOutput> {
  workerId: CommercialPromotionWorkerId;
  run(input: TInput, context: CommercialPromotionContext): Promise<CommercialPromotionArtifact<TOutput>>;
  validateInput(input: TInput, context: CommercialPromotionContext): ValidationResult;
  classifyBoundary(output: TOutput): BoundaryAssessment;
}

interface CommercialPromotionContext {
  workspaceId: string;
  tenantKey: "helm-internal";
  actorId: string;
  sourceWindowKey: string;
  reviewPosture: "watch_only" | "review_required" | "founder_decision_required";
  evidencePolicy: "public_only" | "alias_private_notes" | "redacted_customer_data";
}

interface CommercialPromotionArtifact<T> {
  artifactId: string;
  output: T;
  evidenceRefs: string[];
  boundaryNote: string;
  recommendedNextAction: string;
  requiredReviewer?: "founder" | "legal" | "data_protection" | "engineering" | "product";
  outcomeMetric: string;
}
```

## 7. 首批 Skill 详细口径

### 7.1 `commercial.icp_desk_research`

目标：由 alias + 官网链接补齐公开安全字段，避免 founder 等待私域信息才启动候选池。

输出字段：

- alias
- website
- ICP category
- company size estimate
- product / buyer hypothesis
- sales complexity signal
- likely CRM / IM / meeting stack evidence
- proof potential
- data access friction
- source URLs
- open questions

验收：

- 不包含真实联系人、手机号、邮箱、微信、未公开姓名。
- 每个推断必须标为 `observed | inferred | unknown`。
- 每个候选至少 3 条可验证公开来源或明确标记 `insufficient_public_evidence`。

### 7.2 `commercial.design_partner_scorecard`

目标：把候选压成可比较的 Top / Pool / Nurture / No-Go。

评分：

- Pain / failure event：25
- Business owner：20
- Data availability：20
- Proof value：15
- Paid pilot willingness：15
- Boundary fit：5

验收：

- deterministic score，不允许 LLM 直接给最终排序。
- LLM 只能生成原因摘要和风险提示。
- 低于 75 分不得推荐为第一个 design partner，除非 founder 明确例外并记录理由。

### 7.3 `commercial.validation_call_brief`

目标：让每次 30 分钟电话不是“介绍产品”，而是验证假设。

输出：

- 3 个必须验证的失败事件问题
- 2 个 owner / budget 问题
- 2 个数据接入问题
- 2 个 proof / case authorization 问题
- 2 个 boundary acceptance 问题
- 预期 No-Go 信号

验收：

- 至少 3 个问题必须是 falsification question。
- 不出现“我们能保证”“我们会自动帮你”等承诺词。

### 7.4 `commercial.meeting_to_proof_signal`

目标：把验证电话记录转为经营推进信号。

输出：

- `painSignal`
- `ownerSignal`
- `dataSignal`
- `proofSignal`
- `budgetSignal`
- `boundarySignal`
- `nextReviewAction`

验收：

- 所有信号必须分为 `confirmed | likely | unconfirmed`。
- `unconfirmed` 不能进入 public proof 或 contract scope。

### 7.5 `commercial.pilot_scope_packet`

目标：把 Top 候选推进到 Week 0 可执行范围。

输出：

- data checklist
- owner / reviewer map
- review cadence
- success metrics
- stop conditions
- DPA / agreement readiness
- implementation engineer coverage
- founder attendance requirements

验收：

- 每个 success metric 必须有 source、baseline、target、review owner。
- DPA / legal 字段只能输出 `review_required`，不能输出 `approved`。

### 7.6 `commercial.proof_pack_assembly`

目标：把 pilot 结果整理为 proof candidate，而不是提前市场化夸大。

输出：

- metric summary
- before / after narrative
- anonymized workflow diagram
- customer quote candidate
- claim allowlist
- claim denylist
- public / semi-public / private 三档素材包

验收：

- 没有客户授权的内容只能 `private`。
- 所有数字必须指向 review note 或 scorecard evidence。
- public claim 必须 `founder + legal/data protection` 双复核。

## 8. 实现阶段

| 阶段 | 范围 | 产物 | 禁止 |
|---|---|---|---|
| Phase 0 | 本文档规划 | worker / skill selection plan | runtime code |
| Phase 1 | Fixtures + offline evaluator | `evals/commercial-promotion/worker-artifact-cases.json`、`npm run eval:commercial-promotion`、boundary tests；后续补 20 个候选 alias fixtures | 外部网络自动行动 |
| Phase 2 | Worker stubs | `lib/helm-v2/commercial-promotion/*` 纯函数 worker stubs + tests | schema / API / UI |
| Phase 3 | Internal Helm tenant dogfood | 用自身租户候选池生成 review-only artifacts | customer-facing auto-send |
| Phase 4 | Pack A pilot support | 绑定第一个 design partner 的 Week 0 / Week 1 artifact | public claim auto-publish |
| Phase 5 | Cookbook / open-source support | 脱敏 proof pack 进入 cookbook candidate | 未授权发布 |

## 9. 质量门

| 门 | Go 条件 | No-Go 条件 |
|---|---|---|
| Data safety | 只保存 alias、公开来源、脱敏摘要 | 真实客户名单、未授权联系人、未脱敏 transcript 入仓 |
| Boundary | 每个 artifact 有 boundary note | 草稿写成已发送、proof 写成已授权、scope 写成合同 |
| Measurement | 每个 worker 有 outcome metric | 只产出漂亮文案，没有计量结果 |
| Replay | input summary + evidenceRefs 可复盘 | 无法解释评分或建议来源 |
| Review | high-risk artifact 有 reviewer | public claim / price / legal 文本无复核 |
| GTM usefulness | 支持 founder 30 天内完成 8-10 通验证电话、Top 2-3 scope call | 产物不能降低 founder 时间成本 |

## 10. 与自改进闭环的连接

商业推广 Pack 不应停留在一次性研究。每个 worker 的运行结果都要反馈到 Helm 的成长闭环：

| 反馈 | Candidate | Review | Metric |
|---|---|---|---|
| 候选评分误判 | score weight adjustment candidate | founder / product review | Top candidate conversion |
| 电话问题无效 | call script template candidate | GTM review | verified failure event count |
| proof 不可公开 | proof eligibility threshold candidate | legal / data protection review | public-safe proof rate |
| scope 反复缺字段 | pilot scope template candidate | operations review | Week 0 readiness completeness |
| 草稿被 founder 大改 | wording template candidate | product / founder review | draft adoption rate |

任何 candidate 都不能自动晋升为 formal Skill。必须先有 human review、measured delta 和 bounded adoption。

## 11. 今晚拍板建议

1. 采用 **Internal Commercial Promotion Pack** 定位，不对外销售，不写成营销自动化。
2. P0 锁定 6 个 worker：desk research、scorecard、call prep、meeting-to-proof、pilot scope、proof pack。
3. 第一阶段只允许 fixtures / evaluator / pure worker stubs，不做 API、schema、UI、CRM 写回或外部发送。
4. 所有真实客户信息留在私有笔记或客户系统，仓库只保存 alias、公开字段、脱敏决策信号。
5. 30 天目标不是市场占有率，而是：20 个候选 alias、8-10 通验证电话、Top 2-3 scope call、1 个 paid pilot ready、0 boundary incident。

## 12. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-04-30 | Phase 1 第一刀：新增 commercial promotion offline evaluator 与 P0 worker artifact fixtures，验证 review-first、alias-only、deterministic scorecard、no external side effect 边界 |
| 2026-04-30 | 首版：定义商业推广 Skill Pack 的 P0 worker / skill 选择、边界、质量门和分阶段实现计划 |
