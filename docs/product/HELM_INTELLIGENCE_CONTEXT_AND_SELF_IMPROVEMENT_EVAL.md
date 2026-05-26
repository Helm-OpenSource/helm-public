---
status: active
owner: Product / Engineering / Data Protection
created: 2026-04-30
review_after: 2026-05-14
archive_trigger:
  - LLM context audit 被接入生产 trace schema 并完成首轮 live redacted review 后，本文件由 runtime adoption 版替代
  - self-improvement eval 完成首个真实 pilot 周度 scorecard 后，本文件由 pilot closeout 版替代
  - Helm 放弃 review-first / evidence-first 的智能成长路线时归档
---

# Helm 智能上下文与自改进评估契约

## 1. 结论

Helm 的智能不能只归因于模型智力。真正决定效果的是三层系统能力：

1. **Context quality**：每次调用 LLM 前，是否把对象、事实、承诺、阻塞、历史反馈、边界和输出 contract 放对。
2. **Agent governance**：LLM、工具、记忆、复核、候选 Skill 是否都有 trace、guardrail、review gate 和 rollback。
3. **Self-improvement loop**：系统是否能从用户反馈、复核结果、记忆缺口、context audit、SkillSuggestion 和 pilot 指标中形成可复核改进，而不是停在一次性回答。

本轮实现只授权 evaluation / trace summary / docs contract，不授权 auto-promotion、auto-send、auto-write、schema migration、production runtime adoption 或 LLM final ranking。

## 2. 吸收的 2026 agent 架构原则

| 来源 | 可吸收原则 | Helm 落点 |
|---|---|---|
| OpenAI Agents SDK | agent run 需要 trace LLM generations、tool calls、handoffs、guardrails 和 custom events；工具与 sandbox 需要标准化 guard | `LLMContextAudit` 先进入 call-log summary；后续进入结构化 trace |
| OpenAI Agents SDK guardrails | guardrail 不是一层 prompt，而是 input / output / tool / handoff 的运行时管线 | Helm 继续把 LLM 解释、tool/action、review handoff 分层，不让 prompt 承担权限控制 |
| Anthropic MCP | context 与工具连接要标准化，但 MCP / tool ecosystem 同时带来 prompt injection、tool poisoning、权限组合风险 | Helm 只吸收 MCP-style resource/tool contract，不默认信任外部 tool，不做自动权限放大 |
| LangGraph | checkpoint persistence 支持 human-in-the-loop、interrupt / approve、time travel debugging 和 fault-tolerant execution | Helm 的自改进必须可回放：signal -> candidate -> review -> measurement |
| Google ADK | context 像 source code 一样管理，sessions、memory、tool outputs、artifacts 都要结构化，token 要有位置价值 | 新增 `eval:llm-context`，用 fixture 验证上下文覆盖、token fitness 和 ablation delta |
| Microsoft Agent Framework / Governance Toolkit | workflows、events、observability、policy interceptor、approval quorum 是生产 agent 的基础 | Helm 继续用 review-first gate 和 required reviewer overlay，后续补 policy-interceptor seam |
| AWS Bedrock Agents | production agents 需要 trace、guardrails、knowledge bases 和 identity / permission boundaries | Helm 不做黑盒 agent；每条 LLM 调用和成长闭环都要有边界与身份语义 |

## 3. Context Quality Contract

每次 LLM 调用前，最少要回答：

1. **给了什么上下文**：对象身份、阶段、事实、承诺、阻塞、最近会议 / 线程、历史反馈、相似案例、边界。
2. **为什么这些上下文足够**：关键 requirement 是否命中，是否缺少会改变判断的 evidence。
3. **有没有越界素材**：不得带 raw prompt dump、secret、token、DB URL、未授权 transcript。
4. **token 是否值得**：不是越长越好，而是每个 token 都服务判断、复核或输出 contract。
5. **模型失败时能否解释**：必须能判断失败是模型智力问题、context 缺口、工具失败还是边界拦截。

本轮新增：

- `lib/llm/context-audit.ts`：纯函数 context audit，输出 `ctx score / token estimate / required context coverage / failures / warnings`。
- `executeLLMTask`：把压缩后的 context audit 摘要写入 `LLMCallLog.inputSummary` 前缀，不持久化 raw prompt。
- `evals/llm-context/context-quality-cases.json`：覆盖 briefing、recommendation explanation、BI report analysis、meeting memory extraction 和 ablation cases。
- `npm run eval:llm-context`：验证 ready context 与 ablation context 的分数差，证明 context 本身是决定性变量。

## 4. Self-Improvement Contract

Helm 只有满足以下闭环，才可以说“越来越聪明”：

```text
signal
  -> feedback / observation
  -> candidate improvement
  -> human review
  -> measured delta
  -> bounded adoption
```

四条首批成长线：

| 成长线 | 输入 | 候选改进 | 复核 | 度量 |
|---|---|---|---|---|
| Recommendation feedback | 采纳、拒绝、编辑后采纳 | preference signal / evolution delta | recommendation feedback audit | 下一次采纳率 / time-to-trust |
| Memory distillation | 重复事实、矛盾、缺口 | distillation candidate | memory review decision | briefing evidence coverage / gap score |
| SkillSuggestion | 高频被采纳模式 | candidate skill / formal review queue | formal review checklist | probationary acceptance lift |
| LLM context audit | 缺失事实、承诺、边界、token 过载 | retrieval / prompt context fix candidate | prompt-context change review | ctx score delta / boundary incident |

本轮新增：

- `evals/self-improvement/learning-loop-cases.json`：覆盖推荐反馈、记忆蒸馏、SkillSuggestion、LLM context audit 四条成长线，以及一个自动晋升失败样本。
- `npm run eval:self-improvement`：验证 evidence coverage、review coverage、measured improvement、boundary incident、auto-promotion count。

## 5. 不变量

1. context audit 可以进入摘要和指标，但不保存 raw prompt。
2. self-improvement 可以生成 candidate，但不自动晋升为正式 Skill。
3. memory distillation 只能进入 review-required candidate，不能自动写 canonical fact。
4. recommendation feedback 可以影响 preference / delta，但不能让 LLM 接管排序权。
5. context 缺口可以生成改进任务，但 prompt / retrieval 变更必须 review。
6. agent 架构可借鉴 tracing、checkpoint、guardrail、sandbox、MCP、multi-agent verifier，但 Helm 不扩成通用 agent platform。

## 6. 当前验证入口

```bash
npm run eval:llm-context
npm run eval:self-improvement
npx vitest run lib/llm/context-audit.test.ts lib/evals/llm-context-evals.test.ts lib/evals/self-improvement-evals.test.ts
```

## 7. 下一层

1. 把 `LLMCallLog.inputSummary` 的 context audit prefix 迁移为结构化字段，前提是新增 schema 经过 Data Protection review。
2. 在 `/settings` 或 diagnostics 中展示 context quality trend，但只展示摘要，不展示 raw prompt。
3. 把 self-improvement eval 接入 weekly company-memory scorecard。
4. 对 Pack A pilot 增加 `context_score_delta`、`learning_loop_delta` 和 `candidate_to_review_latency`。
5. 后续如接入 MCP / external tools，先做 tool identity、capability policy、tool poisoning guard 和 trace replay。

## 8. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-04-30 | 首版：新增 LLM context audit 与 self-improvement loop eval contract，吸收 2026 agent 架构中的 tracing、guardrails、checkpoint、context-as-code 与 governance 原则 |

## 9. 参考来源

以下仅作为架构校准来源，不构成 Helm 对外能力 claim：

1. OpenAI Agents SDK evolution: https://openai.com/index/the-next-evolution-of-the-agents-sdk/
2. OpenAI Agents SDK tracing: https://openai.github.io/openai-agents-js/guides/tracing/
3. OpenAI Agents SDK guardrails: https://openai.github.io/openai-agents-python/guardrails/
4. Model Context Protocol docs: https://modelcontextprotocol.io/docs/getting-started/intro
5. LangGraph persistence: https://docs.langchain.com/oss/python/langgraph/persistence
6. Google Agent Development Kit: https://adk.dev/
7. Microsoft Agent Framework workflows: https://learn.microsoft.com/en-us/agent-framework/workflows/workflows
8. Microsoft Agent Governance Toolkit: https://opensource.microsoft.com/blog/2026/04/02/introducing-the-agent-governance-toolkit-open-source-runtime-security-for-ai-agents/
9. Amazon Bedrock agent trace: https://docs.aws.amazon.com/bedrock/latest/userguide/trace-view.html
