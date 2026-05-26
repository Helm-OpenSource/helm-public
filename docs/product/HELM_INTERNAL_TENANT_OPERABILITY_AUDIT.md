---
status: active
owner: Product / Operations / Engineering
created: 2026-04-30
review_after: 2026-05-14
archive_trigger:
  - Helm internal tenant 完成连续 2 周 dogfood scorecard，且本文件被实跑版 runbook / dashboard contract 替代
  - Founder-led OPC 阶段结束，内部租户经营闭环改由正式运营治理文档承接
  - Helm 放弃以自身租户作为首个高强度验证场
---

# Helm 自身租户可运营性审计

## 1. 结论

Helm 自身租户必须被当作第一个高要求客户，而不是演示用 workspace。

当前仓库已经具备经营推进闭环所需的多数组件：workspace / membership、Ask Helm、memory、Business Advancement planning gate、LLM context audit、self-improvement eval、Pack A OPC 市场验证材料、founder-led OPC 协议和 public-release guard。

缺口不在单点功能，而在**统一运营闭环**：

```text
Goal / Demand
  -> Work Item
  -> Owner / Reviewer
  -> Evidence
  -> Review / Decision
  -> Outcome
  -> Memory / SkillSuggestion candidate
  -> Metric / Eval
  -> Next Must Push
```

今晚的审计结论是：Helm 自身租户已具备 dogfood 基础，但仍不能说“完整成立”。必须补上统一的 work item contract、owner / reviewer assignment、结果计量、每周 scorecard 和失败复盘，才能保证全程可追踪、可分配、可计量和结果可管理。

## 2. 审计范围

| 范围 | 包含 | 不包含 |
|---|---|---|
| 自身租户经营闭环 | Helm 项目自身的产品、GTM、开源、试点、合规、交付事项 | 通用项目管理平台 |
| 追踪 | goal、signal、decision、artifact、review、outcome、metric 的关联 | 多租户跨 workspace 聚合 |
| 分配 | owner、reviewer、due window、escalation posture | 自动派工、自动绩效评分 |
| 计量 | adoption、latency、review coverage、proof coverage、boundary incident | 完整 BI / OKR 平台 |
| 结果管理 | continue / revise / stop、memory candidate、skill candidate、next action | 自动承诺、自动外发、自动改 CRM |

## 3. 当前能力完整性矩阵

| 能力 | 当前证据 | 实用性判断 | 关键缺口 |
|---|---|---|---|
| Workspace / membership | `AGENTS.md`、`docs/STATUS.md`、existing surfaces | 可作为自身租户身份和权限基础 | 需要把 internal tenant / reserved tenant 的使用边界写入统一 operating packet |
| Operating / approvals / memory surfaces | `docs/STATUS.md` 标记多项 surface 已完整成立 | 足以承接 review-first 工作流 | 缺统一“今晚 / 本周 / 本月 Must Push”内部运营口径 |
| Business Advancement planning gates | Final Requirements、production query gate、redacted calibration gate、internal dogfood packet | 对经营推进闭环的边界足够清楚 | 仍是 disabled / planning-heavy，不能误写为 production runtime |
| Ask Helm | 当前作为 action intent 入口 | 适合承接“下一步该做什么” | 缺自身租户专属 context pack 与 traceable answer-to-work-item link |
| Company memory / self-improvement | `eval:llm-context`、`eval:self-improvement`、memory review posture | 能证明 Helm 会从反馈中形成 candidate | 缺 weekly scorecard 把 candidate delta 变成经营结果 |
| Pack A OPC materials | 候选评分、验证电话、scope call、pilot runbook、DPA / agreement templates | 足以推动第一个 design partner | 候选线索、owner、call result、proof eligibility 仍在私有侧，仓库只应保存脱敏代号和决策信号 |
| Public release / cloud trial | open-source plan、public-release hygiene closeout、RDS remediation plan | 具备五月窗口推进框架 | secret history remediation 和 live calibration 仍是风险项 |

## 4. 追踪合同

每个自身租户经营事项必须最少具备以下字段。没有这些字段，不允许升格为 Must Push，只能停留在 observation / watch-only。

| 字段 | 必填 | 说明 |
|---|---:|---|
| `workItemId` | 是 | 稳定 ID；建议格式 `helm-internal:<domain>:<yyyymmdd>:<slug>` |
| `workspaceId` | 是 | 自身租户也必须 workspace-first |
| `tenantKey` | 是 | 对 reserved / internal tenant 显式标识，避免与普通客户 workspace 混用 |
| `sourceWindowKey` | 是 | 例如 `2026-W18`、`2026-04-30-night` |
| `signalKey` | 是 | 触发信号：release hygiene、Pack A candidate、context gap、review blocker 等 |
| `severity` | 是 | `watch | normal | high | critical` |
| `owner` | 是 | 单一 accountable owner；可以是 founder / Codex / Claude / engineering / legal |
| `reviewer` | 条件必填 | high / critical 或 customer-facing claim 必填 |
| `evidenceRefs` | 是 | 文档、commit、test output、call note alias、metric snapshot |
| `decisionPosture` | 是 | `continue | revise | stop | blocked | review_required` |
| `outcomeMetric` | 是 | 至少一个可计量指标 |
| `nextAction` | 是 | 具体动作、到期窗口、承接页面或文档 |
| `boundaryNote` | 是 | recommendation / commitment、draft / send、proof / claim 等边界 |

自身租户的信号去重建议沿用 tenant signal identity：

```text
workspaceId + tenantKey + sourceWindowKey + signalKey + severity
```

## 5. 分配与评审规则

| 事项类型 | 默认 owner | 默认 reviewer | 升级条件 |
|---|---|---|---|
| Product / requirements | Codex prepares, founder decides | Product lens | 改变 runtime authority、schema、API、外部 claim |
| Engineering implementation | Claude / engineering worker | Codex Engineering lens | 触达 DB、auth、tenant、official write、connector |
| Security / release hygiene | Codex / engineering | Security lens | secret、public release、cloud trial、tenant boundary |
| Data protection | Codex prepares | Data Protection lens / external legal when needed | 真实客户数据、DPA、跨境、retention、deletion |
| GTM / Pack A pilot | founder | Product + Operations lens | paid pilot、public proof、customer-facing statement |
| Memory / intelligence | Codex / engineering | Data Protection + Product lens | raw prompt、canonical fact write、skill promotion |

最低规则：

1. 没有 owner 的事项不能进入 Must Push。
2. 没有 evidenceRefs 的事项不能进入 review。
3. 没有 outcomeMetric 的事项不能标记完成。
4. high / critical 事项没有 reviewer 时只能 `blocked`。
5. 对外承诺、自动发送、自动审批、自动 official write 一律 No-Go，除非另有独立评审和 founder 决策。

## 6. 计量框架

| 指标 | 目标 | 用途 |
|---|---:|---|
| Work item owner coverage | 100% | 防止事项无人负责 |
| Evidence coverage | ≥95% | 防止无法复盘 |
| Review coverage for high-risk items | 100% | 防止边界事故 |
| Outcome metric coverage | ≥90% | 防止“完成”不可计量 |
| Must Push orphan rate | 0 | 每个 Must Push 必须有 owner + next action |
| Boundary incident count | 0 | recommendation / commitment 等红线 |
| Time-to-first-owner | ≤24h | 防止关键事项停滞 |
| Time-to-decision for blockers | ≤72h | 防止阻塞长期悬挂 |
| Memory / Skill candidate review latency | ≤7d | 确保系统成长不堆积 |
| Weekly scorecard completion | 100% | 形成 founder-led cadence |

## 7. 自身租户首批工作流

### 7.1 每日 Must Push

输入：

- release / security blockers
- Pack A candidate tracker 脱敏代号
- Business Advancement dogfood observations
- LLM context / self-improvement eval failures
- customer-facing proof / claim readiness

输出：

- 1 个最高优先级
- 最多 4 个 Must Push
- 每项都有 owner、evidence、boundary、next action、outcome metric

### 7.2 每周 Founder Scorecard

每周固定回答：

1. 哪些事项推进了经营结果？
2. 哪些事项只是产出了文档但没有实跑？
3. 哪些 owner / reviewer 阻塞了节奏？
4. 哪些 evidence 证明 Helm 比上一周更聪明、更可复用？
5. 哪些 public / customer-facing claim 仍然不能说？

### 7.3 失败复盘

触发条件：

- Must Push 连续 2 次被用户忽略
- owner 未响应超过 72 小时
- high-risk item 无 reviewer
- false positive 进入 Top 5
- 边界 note 缺失
- LLM context audit 分数下降且没有解释

复盘输出只能是：

- revise threshold
- add evidence requirement
- add reviewer
- downgrade to watch-only
- create MemoryCandidate / SkillSuggestionCandidate

不得直接：

- 自动晋升 Skill
- 自动写 canonical memory
- 自动外发客户信息
- 自动修改 official business state

## 8. 实施路径

| 阶段 | 目标 | 交付物 | Go / No-Go |
|---|---|---|---|
| Phase 0 | 文档收口 | 本文件 + STATUS / README 索引 | Go |
| Phase 1 | Fixture / scorecard | 10-20 条自身租户脱敏 work item fixtures + weekly scorecard 模板 | 无 owner / metric 的 fixture 不进入 Must Push |
| Phase 2 | Read-only internal board | 从 fixture / docs / eval output 生成内部运营 readout | 只读，不写 runtime，不写 schema |
| Phase 3 | Internal dogfood | 连续 2 周人工复核 Must Push 与 scorecard | boundary incident >0 立即 stop |
| Phase 4 | Runtime proposal | 如 Phase 3 通过，再起 API / schema / page PRD | 需 founder approval + Evidence Gate |

## 9. 四档状态

| 档位 | 条目 |
|---|---|
| 已完整成立 | 基础 workspace / membership、多个核心 surface、founder-led OPC 协议、context / self-improvement eval 入口 |
| 已成形但仍需下一层 | 自身租户统一 work item contract、owner / reviewer assignment、weekly scorecard、result-managed readout |
| 刻意未做 | 自动派工、自动承诺、自动外发、自动 official write、完整 workflow / BI / CRM 替代 |
| 风险项 | 私有客户线索不可入仓、public claim 过早、docs 与 runtime 边界混写、无 recurring cadence、secret history remediation 未彻底关闭 |

## 10. 下一步

1. 使用 [HELM_INTERNAL_TENANT_WEEKLY_SCORECARD_TEMPLATE.md](HELM_INTERNAL_TENANT_WEEKLY_SCORECARD_TEMPLATE.md) 开始记录每周 scorecard，只存脱敏 ID 和计量字段。
2. 为 Pack A OPC Week 1 候选和 Business Advancement dogfood observation 建 10-20 条 fixture。
3. 将 `eval:llm-context` 与 `eval:self-improvement` 摘要接入每周 scorecard，不展示 raw prompt。
4. 做 read-only internal operating board 的 PRD，但明确 Phase 1 不做 schema / runtime write。
5. 每周固定一次 founder decision packet，把 continue / revise / stop 与 owner assignment 留痕。

## 11. 变更记录

| 日期 | 变化 |
|---|---|
| 2026-04-30 | Phase 1 第一刀：补充 weekly scorecard 模板入口，仍保持 docs / fixture / eval-only，不进入 runtime write |
| 2026-04-30 | 首版：把 Helm 自身租户作为第一个高要求客户审计，定义可追踪、可分配、可计量、可管理结果的最小运营闭环 |
