---
status: active
owner: helm-core
created: 2026-04-26
review_after: 2026-07-25
# frontmatter backfilled by scripts/docs-frontmatter-backfill.ts on 2026-05-19
# rationale: default — no archive/dormant signal in path
---
# Helm V2.1 Market Positioning Brief

## 状态

```text
Status: Phase 0 market positioning draft
Scope: product / GTM alignment
Implementation: not approved
Schema: not approved
Customer commitment: not approved
```

本文件是 [HELM_BUSINESS_ADVANCEMENT_ARCHITECTURE_V2.1.md](./HELM_BUSINESS_ADVANCEMENT_ARCHITECTURE_V2.1.md) 的市场化定位附件，用于把 V2.1 的技术架构表达压缩成团队、客户、合作伙伴和投资人都能理解的产品北极星。

本文不批准代码实现、schema 设计、自动执行扩权、对外承诺或客户合同表述。

---

## 一句话定位

```text
Helm 是面向经营团队的推进控制台。
它持续识别必须推进的事项，给出证据、边界和建议承接方式，
把经营输入转化为可复核的行动、记忆和可复用能力。
```

更短的 GTM 表达：

```text
推进不漏，阻塞不拖，边界不失控，经验可复用。
```

---

## 市场判断

企业 AI 市场正在从单点 copilot、chatbot 和内容生成，转向 agentic workflow、enterprise agent platform、revenue intelligence 和 meeting-to-action。

但企业真正缺的不是另一个能回答问题的 AI，也不是一个马上替人自动执行的 agent。企业真正缺的是一个可信的经营推进判断层：

1. 及时发现哪些经营事项正在停滞。
2. 判断为什么现在必须推进。
3. 给出可复核证据、风险边界和下一步承接方式。
4. 在用户确认后，把行动结果沉淀为经营记忆和候选能力。

Helm V2.1 的机会在于占据这层“经营推进层”，而不是正面竞争通用 agent platform、底层 orchestration framework、单一 CRM AI 或会议记录工具。

---

## 竞争边界

| 市场玩家类型 | 代表 | Helm 不做什么 | Helm 应占据什么 |
| --- | --- | --- | --- |
| Enterprise agent platform | Salesforce Agentforce、ServiceNow AI Platform、Microsoft Copilot Studio、Google enterprise AI | 不做通用 agent 平台，不替代企业系统控制塔 | 跨系统识别经营推进信号，并把推进项压缩给经营团队 |
| Agent engineering infrastructure | OpenAI Agents SDK、LangGraph、CrewAI | 不竞争底层编排、runtime、agent lifecycle infra | 可在未来借鉴或集成，但 Helm 的产品对象是经营推进，不是 agent 搭建 |
| Revenue intelligence | Gong、Clari | 不只做销售收入管理，不把 Helm 锁死在 revenue team | 用 AdvancementSignal / MustPushItem 横跨销售、CS、交付、审批、资源和内部经营 |
| Meeting AI | Granola、Otter、Fireflies 等 | 不把会议总结当终点 | 把会议作为高价值 signal 和 evidence 来源，最终落到 Must Push 和 Review Action |

---

## 目标客户画像

优先客户不是“还没有任何系统”的企业，而是已经有一定数字化基础、但经营推进仍靠人工追问的团队。

优先画像：

1. 已经使用 CRM、会议记录、项目/交付系统、客户成功表格、飞书/企微/Slack 或资源管理系统。
2. 管理层仍然靠周会、群消息、人工汇总、Excel 或个人记忆追踪事项。
3. 线索、机会、交付、续约、审批或客户等待状态容易断裂。
4. 团队愿意接受“建议、准备、复核、分派”，但暂时不愿交出高风险自动执行权。

首批适合试点的团队：

1. Helm 自己的 GTM / 客户成功流程。
2. 销售与客户成功密集型 B2B 团队。
3. 有明确对象停滞、承诺超期、资源证据缺失的 vertical tenant。

---

## 第一条商业化试点闭环

```text
会议 / CRM / 资源状态 / Ask Helm
  -> AdvancementSignal
  -> AdvancementJudgement
  -> 3-5 个 MustPushItem
  -> 高风险项生成 ReviewRequiredAction
  -> 用户确认后生成 MemoryCandidate 或 SkillSuggestion
```

第一阶段交付物不是自动执行 Skill，而是一个高质量 Must Push 面板。

Must Push 面板必须做到：

1. 每个推进项都有证据。
2. 每个推进项都有原因。
3. 每个推进项都有边界说明。
4. 每个推进项都有一个 primary next step。
5. 高风险项默认 `review_required`。
6. 排序 deterministic，LLM 不做最终排序。

---

## 对外语言建议

推荐表达：

```text
Helm 不要求企业把执行权交给 AI。
第一阶段只解决一个问题：
系统能不能更早发现经营上必须推进的事，
并把证据、风险和下一步准备好。
```

可以说：

1. Helm 帮你发现哪些经营事项正在停滞。
2. Helm 帮你判断为什么这些事项值得推进。
3. Helm 帮你准备推进所需证据、草稿和复核项。
4. Helm 帮组织把反复出现的判断和动作沉淀为可复用能力。

不建议说：

1. Helm 是自动经营 agent。
2. Helm 可以自动替团队做决策。
3. Helm 可以自动对外承诺或发送。
4. Helm 可以替代 CRM、项目管理、会议记录或企业 agent 平台。

---

## 非目标

V2.1 市场定位不得被解释为以下目标：

1. 不做完整自动执行平面。
2. 不做完整 agent orchestration 平台。
3. 不做通用聊天产品。
4. 不做 CRM、ERP、项目管理或 BI 的替代品。
5. 不做会议记录工具。
6. 不以自动化率作为第一阶段成功指标。
7. 不把 recommendation 写成 commitment。
8. 不把 ReviewRequiredAction 写成已审批或已执行。

---

## 成功指标

第一阶段应看产品质量指标，而不是自动化展示指标。

| 指标 | 建议目标 | 含义 |
| --- | --- | --- |
| Signal false positive rate | < 20% | 无效信号占比要低 |
| Must Push accepted rate | > 60% | 用户愿意进入 primary action 或确认有价值 |
| Must Push Time-to-Trust | 下降 30% | 用户从看到推进项到愿意确认、分派或进入下一步的时间 |
| Review coverage | 100% high-risk | 高风险推进项必须有 review posture 和 boundary note |
| Boundary incident count | 0 | 不把建议误写成承诺、审批、外发或 official write |
| Duplicate / noisy signal rate | < 15% | 不用捕获量制造噪音 |

---

## 参考信号

以下来源只作为市场趋势参考，不直接构成 Helm 对外承诺。任何外部材料引用具体数字前，都必须再次核验发布日期、口径和上下文。

1. Gartner：AI spending forecast and enterprise AI demand signal。
   Source: https://www.gartner.com/en/newsroom/press-releases/2026-1-15-gartner-says-worldwide-ai-spending-will-total-2-point-5-trillion-dollars-in-2026
2. McKinsey：2025 AI survey, agents and scaling from experimentation to enterprise impact。
   Source: https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai
3. Salesforce：Agentforce 360 and enterprise agent platform direction。
   Source: https://www.salesforce.com/ap/news/press-releases/2025/10/14/welcome-to-the-agentic-enterprise-with-agentforce-360-salesforce-elevates-human-potential-in-the-age-of-ai-2/
4. ServiceNow：AI Platform, AI Control Tower, agentic enterprise orchestration。
   Source: https://newsroom.servicenow.com/press-releases/details/2025/ServiceNow-Unveils-the-New-ServiceNow-AI-Platform-to-Put-Any-AI-Any-Agent-Any-Model-to-Work-Across-the-Enterprise/default.aspx
5. OpenAI：Agents SDK and Responses API tooling direction。
   Source: https://platform.openai.com/docs/guides/agents-sdk/
6. LangGraph：long-running, stateful agent platform。
   Source: https://blog.langchain.dev/langgraph-platform-ga/
7. Clari：Revenue Context and AI agents for revenue process。
   Source: https://www.clari.com/press/clari-unveils-ai-agents-powered-by-revenue-context/
8. Gong：Revenue AI Operating System and GTM workflow orchestration。
   Source: https://www.gong.io/press/gong-unveils-new-ai-innovations-to-help-revenue-teams-drive-growth-at-scale

---

## 进入下一步的条件

本 brief 进入下一步前，必须与 V2.1 主文档、fixture pack、demo script 对齐：

1. 统一使用“经营推进控制台”而不是“自动化 agent 平台”。
2. 第一条试点闭环固定为“会议 / CRM / 资源状态 / Ask Helm -> Must Push -> Review Action”。
3. 第一阶段成功指标以 false positive、accepted rate、Time-to-Trust、review coverage、boundary incident 为核心。
4. 不批准 schema、runtime extractor、event queue、official write 或 narrow auto execution。
