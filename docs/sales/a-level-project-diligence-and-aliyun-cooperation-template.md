---
status: active
owner: helm-core
created: 2026-03-31
review_after: 2026-06-29
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# A级项目尽调清单 + 阿里云合作模板

本模板用于把外部项目判断压成一页纸，统一回答两件事：

1. 这个项目是否值得按 `A / B / C / reject` 进入更深尽调或合作讨论
2. 如果继续推进，阿里云的技术、合规、交付和商业协同切口分别是什么

边界说明：

- 本文档必须保持为可复用的机构级模板
- 它不是已填好的 deal memo
- 它不是当前投资建议本身
- 它也不是任何既有阿里云合作、商业关系或技术集成已经成立的证明

使用原则：

- 先写真实判断，再写合作想象
- 先写当前已知，再写待验证问题
- 不把“平台想象”写成“当前能力”
- 不把“合作意向”写成“已经成立的事实”
- 优先按高频工作流切口来判断项目，尤其优先看会议 / 日程相邻的 operating loop，再看记忆层与工具连接标准
- 把 governance / controllability 当成 A 级项目的核心资格门槛，而不是后补项
- 默认不要把 Helm 或外部项目写成“广义 AI 平台优先”，而要先回答最强 workflow wedge 是什么
- This template must not imply any existing commercial relationship, technical integration, or endorsement by Alibaba Cloud unless such evidence already exists in the repo.

## 0. Document control

- Version:
- Date:
- Owner:
- Company:
- Primary contact:
- Deal/source:
- Current stage:
- Current status: `screening / diligence / partner discussion / invest committee / defer / reject`

## 1. One-page judgement

### 1.1 Current recommendation
- Current rating: `A / B / C / reject`
- Recommendation: `invest / partner / observe / reject`
- One-sentence thesis:
- Why now:
- Why this team:
- Why this fits us:

### 1.2 Strategic bucket
Choose one or more:
- 优先排序建议：`high-frequency workflow`，尤其 meeting / scheduling-adjacent operating loops；其次是 `memory layer / tooling standard`；`governance / controllability` 需要在后文单独证明，而不是被“平台叙事”替代。
- `always-on data entry`
- `high-frequency workflow`
- `memory layer / tooling standard`
- `individual AI / digital self`
- `employee digital twin`
- `companion / relationship AI`
- `expression layer`
- `agent engineering middleware`
- `data wallet / controllable data layer`

### 1.3 Why Alibaba Cloud is relevant here
- 这一段优先围绕以下 4 类 grounded cooperation story 来写：模型调用 / 兼容模型服务路径、长记忆 / 存储路径、安全 / 审计 / 合规支持、联合企业方案打包；不要先写泛平台合作想象。
- Why this project should care:
- Why Aliyun should care:
- Why the match is time-sensitive now:

## 2. A-level qualification gate

### 2.1 Must-pass gate
A project should pass this section before being called A-level.

Working bias:
- 优先给“高频工作流先成立，再往记忆层与治理层延展”的项目更高权重。
- 如果项目主要卖点仍然是 broad platform story，但没有清晰 workflow wedge、memory path 和 governance path，默认不按 A-level 处理。

- Does it clearly own a strong entry point?
- Does it have a credible path to durable memory?
- Does it have a credible action layer?
- Is governance/control real rather than cosmetic?
- Is there a realistic distribution path?
- Does the cost curve still look survivable at scale?
- Is there a clear Aliyun synergy angle?

### 2.2 Product-component coverage
Mark current state:
- Continuous capture / persistent entry:
- Long-term memory:
- Action execution:
- Presentation layer:
- Controllable governance:

Current rule:
- How many are already present?
- Which missing parts are realistically completable?

### 2.3 Scoring table

| Dimension | Score (1-5) | Why | Key risk |
|---|---:|---|---|
| Entry strength |  |  |  |
| Memory capability |  |  |  |
| Action capability |  |  |  |
| Governance capability |  |  |  |
| Distribution certainty |  |  |  |
| Cost curve |  |  |  |
| Alibaba Cloud synergy |  |  |  |

### 2.4 Overall decision rule
- A-level threshold:
- Current total:
- Verdict:
- Why not higher:
- Why not lower:

## 3. Product due diligence

### 3.1 Entry point and workflow wedge
- What is the first habit / workflow the product owns?
- Is it high-frequency?
- Is the loop short enough to create repeated learning?
- Is the data naturally structured?
- Is the entry durable or easy to platform-copy?

### 3.2 Memory layer
- What is remembered?
- How is it indexed?
- Is memory user-portable?
- What can be exported / deleted / corrected?
- How does memory improve over time?
- What is the storage cost shape?

### 3.3 Action layer
- What can the system actually do?
- What is suggestion vs execution?
- What is tool-calling vs human handoff?
- What permissions are required?
- What rollback / audit exists?

### 3.4 Governance layer
- Export:
- Delete:
- Authorization:
- Audit / traceability:
- Role / permission model:
- Human review points:
- Red-line actions that stay blocked:

### 3.5 Presentation layer (only if relevant)
- Is voice / avatar / video a real product advantage or just cosmetic?
- Is the expression layer authorized and controllable?
- Does it strengthen the operating loop or distract from it?

## 4. Technical and cloud-load diligence

### 4.1 Workload profile
- Main inference load:
- Main storage load:
- Main retrieval load:
- Peak vs steady usage pattern:
- Multi-modal requirements:
- Long-memory requirements:

### 4.2 Cloud architecture fit
- Existing model stack:
- Existing storage stack:
- Existing agent/tool stack:
- Existing observability / audit stack:
- Likely migration friction:
- OpenAI-compatible dependency level:
- Standard / connector dependency level:

### 4.3 Cost-curve analysis
- What gets expensive first?
- Does usage compound storage cost?
- Does usage compound inference cost?
- What margin profile is plausible?
- What optimization levers exist?

## 5. Go-to-market / distribution / competition

### 5.1 GTM path
- Bottom-up or enterprise-led?
- Single-user wedge or team wedge?
- Workflow integration dependencies:
- Deployment friction:
- Sales cycle length:

### 5.2 Competition
- Direct startup competitors:
- Platform incumbents:
- Built-in feature replacement risk:
- Why this project still wins:

### 5.3 Defensibility
- Data advantage:
- Workflow lock-in:
- Governance advantage:
- Channel advantage:
- Ecosystem / standard advantage:

## 6. Risk map and red lines

### 6.1 Main risks
- Privacy / consent risk:
- Regulatory risk:
- Platform dependency risk:
- Cost risk:
- Product overreach risk:
- Data residency / enterprise security risk:

### 6.2 Immediate red lines
Any one of these may block A-level treatment:
- Weak authorization model
- No audit / traceability
- No deletion/export path
- Workflow authority overstated
- Unsafe youth / companion exposure
- Heavy platform copy risk with no differentiation
- Unsustainable cost curve

## 7. Alibaba Cloud cooperation template

### 7.1 Cooperation hypothesis
Use one concise sentence:
- “If [company] uses Aliyun for [model / storage / agent / compliance], then we can jointly unlock [customer / workload / compliance / solution] because [reason].”

Grounding rule:
- 优先把合作假设收敛到：模型调用 / 兼容模型服务路径、长记忆 / 存储路径、安全 / 审计 / 合规支持、联合企业方案交付。
- 不要暗示任何已经存在的商业关系、技术集成、联合背书或阿里云 endorsement，除非 repo 里已经有明确证据。

### 7.2 Technical cooperation stack
- Model layer:
- OpenAI-compatible or Responses-compatible migration path:
- Long-memory / storage path:
- Data lake / OSS path:
- Agent orchestration path:
- Security / audit / compliance support:
- Multi-modal support if needed:

### 7.3 Joint solution packaging
- Which customer type:
- Which use case:
- Which workflow:
- What Aliyun provides:
- What the startup provides:
- What the combined story is:

### 7.4 Commercial structure
- Cloud credits / resource support:
- Joint pilot:
- Joint go-to-market:
- Co-sell / channel support:
- Strategic investment option:
- Benchmark customer strategy:

### 7.5 Pilot design
- Pilot scope:
- Time box:
- In-scope customer/users:
- Success criteria:
- Failure criteria:
- What will be manually observed:
- What is measurable now:
- What is not measurable yet:

### 7.6 Security / compliance section
- Data classification:
- Retention policy:
- Export / delete path:
- Audit path:
- Tenant isolation:
- Data residency:
- Human override / rollback:

### 7.7 No-go triggers
- If this appears, do not proceed:
- [ ]
- [ ]
- [ ]

## 8. Standard 30-minute founder diligence questions

1. What is the strongest entry point you own today?
2. Why does this wedge become durable memory rather than just data exhaust?
3. What can your system do today versus only recommend?
4. How do you separate suggestion, approval, execution, and audit?
5. What can the user export, delete, or revoke today?
6. What gets expensive first as usage grows?
7. What part of this would a platform vendor try to absorb, and why won’t that kill you?
8. What real workflow closes the loop fastest for a new user or team?
9. What would make this a strong fit for Alibaba Cloud specifically?
10. What is the single biggest thing that could block scale in the next 12 months?

## 9. Decision summary

### 9.1 Current status
- Decision:
- Confidence:
- What would upgrade this to A:
- What would downgrade this:
- Recommended next step:

### 9.2 Immediate next actions
- founder call
- technical diligence
- product walkthrough
- compliance review
- Aliyun solution workshop
- hold / observe / reject

## Appendix A. Short-form scorecard

- Entry strength:
- Memory:
- Action:
- Governance:
- Distribution:
- Cost curve:
- Aliyun synergy:
- Final level:

## Appendix B. Contact / process log

- Source:
- Intro path:
- Last meeting:
- Next meeting:
- Internal owner:
- Notes:
